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
        private const val TCN_REGISTRY_FILE = "tflite_models.json"
        private const val HAND_FEATURE_DIM = 126
        private const val HANDS126_NORMALIZATION_VERSION = "hands126_v1"
        private const val HAND_LANDMARK_COUNT = 21
        private const val HAND_FEATURES_PER_LANDMARK = 3
        private const val HAND_FEATURES_PER_HAND = 63
        private const val NORMALIZATION_EPSILON = 1e-6f
        
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
    private var activeTcnModelId: String? = null
    private var tcnLabels: Map<Int, String> = emptyMap()
    private val tcnRegistry: TcnRegistry by lazy { loadTcnRegistry() }

    private data class TcnModelConfig(
        val id: String,
        val displayName: String,
        val modelFile: String,
        val labelsFile: String,
        val sequenceLength: Int,
        val featureDimension: Int,
        val classCount: Int,
        val signatureKey: String,
        val frameInputName: String,
        val lengthInputName: String?,
        val outputName: String,
        val applySoftmax: Boolean,
        val mirrorInput: Boolean,
        val swapHandedness: Boolean,
        val normalizationVersion: String,
        val numThreads: Int
    )

    private data class TcnRegistry(
        val defaultModelId: String,
        val modes: Map<String, String>,
        val models: Map<String, TcnModelConfig>
    )

    override fun getName() = "HandLandmarks"

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun predictTcn(frames: ReadableArray, promise: Promise) {
        predictTcnInternal(frames, null, promise)
    }

    @ReactMethod
    fun predictTcnForModel(frames: ReadableArray, modelKey: String, promise: Promise) {
        predictTcnInternal(frames, modelKey, promise)
    }

    @ReactMethod
    fun getTcnModelConfig(modelKey: String, promise: Promise) {
        try {
            promise.resolve(modelConfigToWritableMap(resolveTcnModel(modelKey)))
        } catch (e: Exception) {
            promise.reject("TCN_CONFIG_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun getTcnModels(promise: Promise) {
        try {
            val result = Arguments.createMap()
            result.putString("defaultModel", tcnRegistry.defaultModelId)

            val modes = Arguments.createMap()
            tcnRegistry.modes.forEach { (mode, modelId) -> modes.putString(mode, modelId) }
            result.putMap("modes", modes)

            val models = Arguments.createArray()
            tcnRegistry.models.values.forEach { models.pushMap(modelConfigToWritableMap(it)) }
            result.putArray("models", models)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("TCN_CONFIG_FAILED", e.message, e)
        }
    }

    private fun predictTcnInternal(frames: ReadableArray, modelKey: String?, promise: Promise) {
        try {
            val config = resolveTcnModel(modelKey)

            if (frames.size() != config.sequenceLength) {
                promise.reject(
                    "INVALID_TCN_INPUT",
                    "Model '${config.id}' expects ${config.sequenceLength} frames, received ${frames.size()}"
                )
                return
            }

            val input = Array(1) {
                Array(config.sequenceLength) { FloatArray(config.featureDimension) }
            }

            for (frameIndex in 0 until config.sequenceLength) {
                val frame = frames.getArray(frameIndex)
                    ?: throw IllegalArgumentException("Frame $frameIndex is null")

                if (frame.size() != config.featureDimension) {
                    throw IllegalArgumentException(
                        "Frame $frameIndex must contain ${config.featureDimension} values, received ${frame.size()}"
                    )
                }

                input[0][frameIndex] = prepareTcnFrame(frame, config)
            }

            val output = Array(1) { FloatArray(config.classCount) }
            val inputs = hashMapOf<String, Any>(
                config.frameInputName to input
            )
            config.lengthInputName?.let {
                inputs[it] = intArrayOf(config.sequenceLength)
            }
            val outputs = hashMapOf<String, Any>(config.outputName to output)

            val labelsForPrediction = synchronized(tcnLock) {
                ensureTcnInterpreter(config).runSignature(inputs, outputs, config.signatureKey)
                tcnLabels
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

            val confidence = if (config.applySoftmax) {
                var sumExp = 0.0
                for (logit in logits) {
                    sumExp += exp((logit - maxLogit).toDouble())
                }
                1.0 / sumExp
            } else {
                maxLogit.toDouble()
            }

            val result = Arguments.createMap()
            result.putString("modelId", config.id)
            result.putInt("classIndex", classIndex)
            result.putString("label", labelsForPrediction[classIndex] ?: classIndex.toString())
            result.putDouble("confidence", confidence)
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
            HandLandmarkerHolder.handLandmarker = buildLandmarker(context, useGpu = false)
            Log.d("HandLandmarks", "Model initialized (CPU)")
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

    private fun ensureTcnInterpreter(config: TcnModelConfig): Interpreter {
        if (activeTcnModelId == config.id) {
            tcnInterpreter?.let { return it }
        }

        tcnInterpreter?.close()
        tcnInterpreter = null
        activeTcnModelId = null

        val modelBuffer = loadAssetModel(config.modelFile)
        val loadedLabels = loadTcnLabels(config.labelsFile)
        require(loadedLabels.size == config.classCount) {
            "${config.id}: labels contain ${loadedLabels.size} entries, expected ${config.classCount}"
        }
        val missingLabelIndices = (0 until config.classCount).filterNot(loadedLabels::containsKey)
        require(missingLabelIndices.isEmpty()) {
            "${config.id}: labels are missing indices ${missingLabelIndices.joinToString()}"
        }
        tcnLabels = loadedLabels

        return Interpreter(
            modelBuffer,
            Interpreter.Options().setNumThreads(config.numThreads)
        ).also {
            tcnInterpreter = it
            activeTcnModelId = config.id
            Log.d("HandLandmarks", "TCN model '${config.id}' initialized")
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

    private fun loadTcnLabels(labelsFile: String): Map<Int, String> {
        val labelsJson = reactApplicationContext.assets.open(labelsFile)
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

    private fun loadTcnRegistry(): TcnRegistry {
        val registryJson = reactApplicationContext.assets.open(TCN_REGISTRY_FILE)
            .bufferedReader(Charsets.UTF_8)
            .use { it.readText() }
        val root = JSONObject(registryJson)
        val modelsJson = root.getJSONObject("models")
        val models = mutableMapOf<String, TcnModelConfig>()
        val modelIds = modelsJson.keys()

        while (modelIds.hasNext()) {
            val id = modelIds.next()
            val json = modelsJson.getJSONObject(id)
            models[id] = TcnModelConfig(
                id = id,
                displayName = json.optString("displayName", id),
                modelFile = json.getString("modelFile"),
                labelsFile = json.getString("labelsFile"),
                sequenceLength = json.getInt("sequenceLength"),
                featureDimension = json.getInt("featureDimension"),
                classCount = json.getInt("classCount"),
                signatureKey = json.optString("signatureKey", "serving_default"),
                frameInputName = json.optString("frameInputName", "inputs"),
                lengthInputName = json.optString("lengthInputName", "lengths")
                    .takeIf { it.isNotBlank() },
                outputName = json.optString("outputName", "output_0"),
                applySoftmax = json.optBoolean("applySoftmax", true),
                mirrorInput = json.optBoolean("mirrorInput", false),
                swapHandedness = json.optBoolean("swapHandedness", false),
                normalizationVersion = json.optString(
                    "normalizationVersion",
                    HANDS126_NORMALIZATION_VERSION
                ),
                numThreads = json.optInt("numThreads", 4).coerceAtLeast(1)
            ).also { validateTcnModelConfig(it) }
        }

        val modes = mutableMapOf<String, String>()
        root.optJSONObject("modes")?.let { modesJson ->
            val modeNames = modesJson.keys()
            while (modeNames.hasNext()) {
                val mode = modeNames.next()
                modes[mode] = modesJson.getString(mode)
            }
        }

        val defaultModelId = root.getString("defaultModel")
        require(models.containsKey(defaultModelId)) {
            "Default TFLite model '$defaultModelId' is not declared in $TCN_REGISTRY_FILE"
        }
        modes.forEach { (mode, modelId) ->
            require(models.containsKey(modelId)) {
                "Mode '$mode' references unknown TFLite model '$modelId'"
            }
        }

        return TcnRegistry(defaultModelId, modes, models)
    }

    private fun validateTcnModelConfig(config: TcnModelConfig) {
        require(config.sequenceLength > 0) { "${config.id}: sequenceLength must be positive" }
        require(config.featureDimension == HAND_FEATURE_DIM) {
            "${config.id}: this landmark pipeline requires featureDimension=$HAND_FEATURE_DIM"
        }
        require(config.classCount > 0) { "${config.id}: classCount must be positive" }
        require(config.normalizationVersion == HANDS126_NORMALIZATION_VERSION) {
            "${config.id}: unsupported normalizationVersion '${config.normalizationVersion}'"
        }
    }

    private fun resolveTcnModel(modelKey: String?): TcnModelConfig {
        val key = modelKey?.takeIf { it.isNotBlank() } ?: tcnRegistry.defaultModelId
        val modelId = tcnRegistry.modes[key] ?: key
        return tcnRegistry.models[modelId]
            ?: throw IllegalArgumentException(
                "Unknown TFLite model or mode '$key'. Available models: ${tcnRegistry.models.keys.joinToString()}"
            )
    }

    private fun modelConfigToWritableMap(config: TcnModelConfig): WritableMap {
        return Arguments.createMap().apply {
            putString("id", config.id)
            putString("displayName", config.displayName)
            putInt("sequenceLength", config.sequenceLength)
            putInt("featureDimension", config.featureDimension)
            putInt("classCount", config.classCount)
            putBoolean("mirrorInput", config.mirrorInput)
            putBoolean("swapHandedness", config.swapHandedness)
            putString("normalizationVersion", config.normalizationVersion)
        }
    }

    private fun prepareTcnFrame(frame: ReadableArray, config: TcnModelConfig): FloatArray {
        val raw = FloatArray(config.featureDimension) { index ->
            frame.getDouble(index).toFloat()
        }

        val handOrderAdjusted = if (config.swapHandedness) swapHandBlocks126(raw) else raw
        val oriented = if (config.mirrorInput) mirrorHands126(handOrderAdjusted) else handOrderAdjusted
        return normalizeHands126V1(oriented)
    }

    private fun swapHandBlocks126(raw: FloatArray): FloatArray {
        require(raw.size == HAND_FEATURE_DIM) {
            "Hand block swap expects $HAND_FEATURE_DIM features, received ${raw.size}"
        }

        return FloatArray(HAND_FEATURE_DIM).apply {
            System.arraycopy(raw, HAND_FEATURES_PER_HAND, this, 0, HAND_FEATURES_PER_HAND)
            System.arraycopy(raw, 0, this, HAND_FEATURES_PER_HAND, HAND_FEATURES_PER_HAND)
        }
    }

    private fun mirrorHands126(raw: FloatArray): FloatArray {
        val mirrored = FloatArray(HAND_FEATURE_DIM)
        for (targetHand in 0 until 2) {
            val sourceHand = 1 - targetHand
            val sourceOffset = sourceHand * HAND_FEATURES_PER_HAND
            val targetOffset = targetHand * HAND_FEATURES_PER_HAND

            for (landmark in 0 until HAND_LANDMARK_COUNT) {
                val source = sourceOffset + landmark * HAND_FEATURES_PER_LANDMARK
                val target = targetOffset + landmark * HAND_FEATURES_PER_LANDMARK
                val landmarkPresent = raw[source] != 0f || raw[source + 1] != 0f || raw[source + 2] != 0f
                if (!landmarkPresent) continue

                mirrored[target] = 1f - raw[source]
                mirrored[target + 1] = raw[source + 1]
                mirrored[target + 2] = raw[source + 2]
            }
        }
        return mirrored
    }

    /**
     * Matches the hands126_v1 preprocessing used by the training/collector pipeline:
     * each hand is wrist-centred and independently scaled in XY, while Z is unchanged.
     * Missing hands and missing landmark triples remain all-zero padding.
     */
    private fun normalizeHands126V1(raw: FloatArray): FloatArray {
        require(raw.size == HAND_FEATURE_DIM) {
            "hands126_v1 expects $HAND_FEATURE_DIM features, received ${raw.size}"
        }

        val normalized = FloatArray(HAND_FEATURE_DIM)
        for (hand in 0 until 2) {
            val offset = hand * HAND_FEATURES_PER_HAND
            val present = BooleanArray(HAND_LANDMARK_COUNT)
            for (landmark in 0 until HAND_LANDMARK_COUNT) {
                val source = offset + landmark * HAND_FEATURES_PER_LANDMARK
                present[landmark] = raw[source] != 0f || raw[source + 1] != 0f || raw[source + 2] != 0f
            }
            if (present.none { it }) continue

            val wristX = raw[offset]
            val wristY = raw[offset + 1]
            val centeredX = FloatArray(HAND_LANDMARK_COUNT)
            val centeredY = FloatArray(HAND_LANDMARK_COUNT)
            var minX = Float.POSITIVE_INFINITY
            var maxX = Float.NEGATIVE_INFINITY
            var minY = Float.POSITIVE_INFINITY
            var maxY = Float.NEGATIVE_INFINITY
            var hasScalePoint = false

            for (landmark in 0 until HAND_LANDMARK_COUNT) {
                if (!present[landmark]) continue
                val source = offset + landmark * HAND_FEATURES_PER_LANDMARK
                val x = raw[source] - wristX
                val y = raw[source + 1] - wristY
                centeredX[landmark] = x
                centeredY[landmark] = y

                if (landmark > 0 && x * x + y * y > NORMALIZATION_EPSILON * NORMALIZATION_EPSILON) {
                    minX = minOf(minX, x)
                    maxX = maxOf(maxX, x)
                    minY = minOf(minY, y)
                    maxY = maxOf(maxY, y)
                    hasScalePoint = true
                }
            }

            val scale = if (hasScalePoint) {
                maxOf(maxX - minX, maxY - minY).takeIf { it > NORMALIZATION_EPSILON } ?: 1f
            } else {
                1f
            }

            for (landmark in 0 until HAND_LANDMARK_COUNT) {
                if (!present[landmark]) continue
                val target = offset + landmark * HAND_FEATURES_PER_LANDMARK
                normalized[target] = centeredX[landmark] / scale
                normalized[target + 1] = centeredY[landmark] / scale
                normalized[target + 2] = raw[target + 2]
            }
        }
        return normalized
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
                activeTcnModelId = null
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
