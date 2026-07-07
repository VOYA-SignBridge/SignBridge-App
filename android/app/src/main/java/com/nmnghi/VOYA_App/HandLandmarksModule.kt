package com.nmnghi.VOYA_App

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.exp
import kotlin.math.round
import com.nmnghi.VOYA_App.HandLandmarkerHolder


class HandLandmarksModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val THROTTLE_INTERVAL_MS = 50L
        private const val NO_HAND_DEBOUNCE_MS = 150L
        private const val TCN_MODEL_FILE = "tcn_20260624_232642.tflite"
        private const val TCN_LABELS_FILE = "tcn_20260624_232642_display_labels.json"
        private const val TCN_SEQUENCE_LENGTH = 60
        private const val TCN_FEATURE_DIM = 126
        private const val TCN_CLASS_COUNT = 42
        
        init {
            try {
                System.loadLibrary("mediapipe_tasks_vision_jni")
                Log.d("HandLandmarks", "MediaPipe library loaded")
            } catch (e: UnsatisfiedLinkError) {
                Log.e("HandLandmarks", "Failed to load MediaPipe: ${e.message}")
            }
        }
    }

    private val lastProcessedTime = AtomicLong(0L)
    private val lastHandDetectedTime = AtomicLong(0L)
    private val isProcessing = AtomicBoolean(false)
    private val frameCount = AtomicLong(0L)
    private val tcnLock = Any()
    private var tcnInterpreter: Interpreter? = null
    private var tcnLabels: Map<Int, String> = emptyMap()

    override fun getName() = "HandLandmarks"

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun predictTcn(frames: ReadableArray, promise: Promise) {
        try {
            if (frames.size() != TCN_SEQUENCE_LENGTH) {
                promise.reject(
                    "INVALID_TCN_INPUT",
                    "Expected $TCN_SEQUENCE_LENGTH frames, received ${frames.size()}"
                )
                return
            }

            val input = Array(1) { Array(TCN_SEQUENCE_LENGTH) { FloatArray(TCN_FEATURE_DIM) } }

            for (frameIndex in 0 until TCN_SEQUENCE_LENGTH) {
                val frame = frames.getArray(frameIndex)
                    ?: throw IllegalArgumentException("Frame $frameIndex is null")

                if (frame.size() != TCN_FEATURE_DIM) {
                    throw IllegalArgumentException(
                        "Frame $frameIndex must contain $TCN_FEATURE_DIM values, received ${frame.size()}"
                    )
                }

                for (featureIndex in 0 until TCN_FEATURE_DIM) {
                    input[0][frameIndex][featureIndex] = frame.getDouble(featureIndex).toFloat()
                }
            }

            val output = Array(1) { FloatArray(TCN_CLASS_COUNT) }
            val inputs = hashMapOf<String, Any>(
                "inputs" to input,
                "lengths" to intArrayOf(TCN_SEQUENCE_LENGTH)
            )
            val outputs = hashMapOf<String, Any>("output_0" to output)

            synchronized(tcnLock) {
                ensureTcnInterpreter().runSignature(inputs, outputs, "serving_default")
            }

            val logits = output[0]
            var classIndex = 0
            var maxLogit = logits[0]
            for (i in 1 until logits.size) {
                if (logits[i] > maxLogit) {
                    maxLogit = logits[i]
                    classIndex = i
                }
            }

            var sumExp = 0.0
            for (logit in logits) {
                sumExp += exp((logit - maxLogit).toDouble())
            }

            val result = Arguments.createMap()
            result.putInt("classIndex", classIndex)
            result.putString("label", tcnLabels[classIndex] ?: classIndex.toString())
            result.putDouble("confidence", 1.0 / sumExp)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("HandLandmarks", "TCN prediction failed", e)
            promise.reject("TCN_PREDICTION_FAILED", e.message, e)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactApplicationContext.hasActiveCatalystInstance()) {
            try {
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            } catch (e: Exception) {
                Log.e("HandLandmarks", "Error sending event: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun initModel() {
        if (HandLandmarkerHolder.handLandmarker != null) {
            Log.d("HandLandmarks", "Model already initialized")
            sendEvent("onHandLandmarksStatus", Arguments.createMap().apply {
                putString("status", "already_initialized")
            })
            return
        }

        try {
            val context: Context = reactApplicationContext
            HandLandmarkerHolder.handLandmarker = buildLandmarker(context, useGpu = true)
            Log.d("HandLandmarks", "Model initialized (GPU)")
            sendEvent("onHandLandmarksStatus", Arguments.createMap().apply {
                putString("status", "initialized")
            })
        } catch (gpuError: Exception) {
            Log.w("HandLandmarks", "GPU delegate failed (${gpuError.message}), falling back to CPU")
            try {
                val context: Context = reactApplicationContext
                HandLandmarkerHolder.handLandmarker = buildLandmarker(context, useGpu = false)
                Log.d("HandLandmarks", "Model initialized (CPU fallback)")
                sendEvent("onHandLandmarksStatus", Arguments.createMap().apply {
                    putString("status", "initialized")
                })
            } catch (e: Exception) {
                Log.e("HandLandmarks", "Init failed", e)
                sendEvent("onHandLandmarksError", Arguments.createMap().apply {
                    putString("error", e.message ?: "Unknown error")
                })
            }
        }
    }

    private fun buildLandmarker(context: Context, useGpu: Boolean): HandLandmarker {
        val baseOptions = BaseOptions.builder()
            .setModelAssetPath("hand_landmarker.task")
            .apply { if (useGpu) setDelegate(Delegate.GPU) }
            .build()

        val options = HandLandmarker.HandLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setNumHands(2)
            .setMinHandDetectionConfidence(0.5f)
            .setMinHandPresenceConfidence(0.45f)
            .setMinTrackingConfidence(0.5f)
            .setRunningMode(RunningMode.LIVE_STREAM)
            .setResultListener { result, _ -> processResult(result) }
            .setErrorListener { error -> Log.e("HandLandmarks", "MediaPipe error: ${error.message}") }
            .build()

        return HandLandmarker.createFromOptions(context, options)
    }

    private fun ensureTcnInterpreter(): Interpreter {
        tcnInterpreter?.let { return it }

        val modelBuffer = loadAssetModel(TCN_MODEL_FILE)
        tcnLabels = loadTcnLabels()

        return Interpreter(
            modelBuffer,
            Interpreter.Options().setNumThreads(4)
        ).also {
            tcnInterpreter = it
            Log.d("HandLandmarks", "TCN model initialized")
        }
    }

    private fun loadAssetModel(assetName: String): MappedByteBuffer {
        val fileDescriptor = reactApplicationContext.assets.openFd(assetName)
        FileInputStream(fileDescriptor.fileDescriptor).use { inputStream ->
            val channel = inputStream.channel
            return channel.map(
                FileChannel.MapMode.READ_ONLY,
                fileDescriptor.startOffset,
                fileDescriptor.declaredLength
            )
        }
    }

    private fun loadTcnLabels(): Map<Int, String> {
        val labelsJson = reactApplicationContext.assets.open(TCN_LABELS_FILE)
            .bufferedReader(Charsets.UTF_8)
            .use { it.readText() }
        val json = JSONObject(labelsJson)
        val labels = mutableMapOf<Int, String>()
        val keys = json.keys()

        while (keys.hasNext()) {
            val key = keys.next()
            labels[key.toInt()] = json.getString(key)
        }

        return labels
    }

    private fun processResult(result: HandLandmarkerResult) {
        val currentTime = System.currentTimeMillis()
        
        if (currentTime - lastProcessedTime.get() < THROTTLE_INTERVAL_MS) {
            return
        }
        
        if (!isProcessing.compareAndSet(false, true)) {
            return
        }
        
        try {
            frameCount.incrementAndGet()
            lastProcessedTime.set(currentTime)

            val params = Arguments.createMap()
            params.putInt("handCount", result.landmarks().size)

            if (result.landmarks().isEmpty()) {
                if (currentTime - lastHandDetectedTime.get() > NO_HAND_DEBOUNCE_MS) {
                    params.putArray("landmarks", Arguments.createArray())
                    sendEvent("onHandLandmarksDetected", params)
                }
                return
            }

            lastHandDetectedTime.set(currentTime)

            val landmarksArray = Arguments.createArray()
            
            for (hand in result.landmarks()) {
                val handArray = Arguments.createArray()
                
                hand.forEachIndexed { idx, lm ->
                    val map = Arguments.createMap()
                    map.putInt("index", idx)
                    map.putDouble("x", round(lm.x() * 1000.0) / 1000.0)
                    map.putDouble("y", round(lm.y() * 1000.0) / 1000.0)
                    map.putDouble("z", round(lm.z() * 1000.0) / 1000.0)

                    handArray.pushMap(map)
                }
                
                landmarksArray.pushArray(handArray)
            }

            params.putArray("landmarks", landmarksArray)
            
            if (frameCount.get() % 30L == 0L) {
                Log.d("HandLandmarks", "Frames: ${frameCount.get()} | Hands: ${result.landmarks().size}")
            }
            
            sendEvent("onHandLandmarksDetected", params)
            
            if (result.landmarks().isNotEmpty()) {
                val frame126 = extract126(result)
                val arr = Arguments.createArray()
                frame126.forEach { arr.pushDouble(it.toDouble()) }
                
                val frameParams = Arguments.createMap()
                frameParams.putArray("frame", arr)
                frameParams.putInt("handCount", result.landmarks().size)
                sendEvent("onHandFrame126", frameParams)
            }
            
        } catch (e: Exception) {
            Log.e("HandLandmarks", "Error processing", e)
        } finally {
            isProcessing.set(false)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        try {
            HandLandmarkerHolder.handLandmarker?.close()
            HandLandmarkerHolder.handLandmarker = null
            synchronized(tcnLock) {
                tcnInterpreter?.close()
                tcnInterpreter = null
            }
            Log.d("HandLandmarks", "Cleanup successful")
        } catch (e: Exception) {
            Log.e("HandLandmarks", "Cleanup error: ${e.message}")
        }
    }

   private fun extract126(result: HandLandmarkerResult): FloatArray {
    val left = FloatArray(63)
    val right = FloatArray(63)

    val handednessList = result.handedness() ?: return FloatArray(126)

    handednessList.forEachIndexed { idx, categories ->
        if (categories.isEmpty()) return@forEachIndexed

        val handedness = categories[0].categoryName().lowercase()
        val target = when (handedness) {
            "left" -> left
            "right" -> right
            else -> return@forEachIndexed
        }

        val landmarks = result.landmarks()[idx]
        for (i in 0 until 21) {
            val lm = landmarks[i]
            target[i * 3] = lm.x()
            target[i * 3 + 1] = lm.y()
            target[i * 3 + 2] = lm.z()
        }
    }

    return FloatArray(126).apply {
        System.arraycopy(left, 0, this, 0, 63)
        System.arraycopy(right, 0, this, 63, 63)
    }
}

}
