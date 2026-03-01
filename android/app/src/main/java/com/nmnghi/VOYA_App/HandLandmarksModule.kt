package com.nmnghi.VOYA_App

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

class HandLandmarksModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val THROTTLE_INTERVAL_MS = 50L
        private const val NO_HAND_DEBOUNCE_MS = 150L
        
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

    override fun getName() = "HandLandmarks"

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
            
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath("hand_landmarker.task")
                .build()

            val options = HandLandmarker.HandLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setNumHands(2)
                .setMinHandDetectionConfidence(0.4f)
                .setMinHandPresenceConfidence(0.4f)
                .setMinTrackingConfidence(0.5f)
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setResultListener { result, _ -> 
                    processResult(result)
                }
                .setErrorListener { error ->
                    Log.e("HandLandmarks", "MediaPipe error: ${error.message}")
                }
                .build()

            HandLandmarkerHolder.handLandmarker = HandLandmarker.createFromOptions(context, options)
            
            Log.d("HandLandmarks", "Model initialized successfully")
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

            if (result.landmarks().isEmpty()) {
                if (currentTime - lastHandDetectedTime.get() > NO_HAND_DEBOUNCE_MS) {
                    sendEvent("onHandLandmarksDetected", Arguments.createMap().apply {
                        putArray("landmarks", Arguments.createArray())
                        putInt("handCount", 0)
                    })
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
                    map.putDouble("x", (lm.x() * 1000).toInt() / 1000.0)
                    map.putDouble("y", (lm.y() * 1000).toInt() / 1000.0)
                    map.putDouble("z", (lm.z() * 1000).toInt() / 1000.0)
                    handArray.pushMap(map)
                }
                
                landmarksArray.pushArray(handArray)
            }

            val params = Arguments.createMap()
            params.putArray("landmarks", landmarksArray)
            params.putInt("handCount", result.landmarks().size)
            
            if (frameCount.get() % 30L == 0L) {
                Log.d("HandLandmarks", "Frames: ${frameCount.get()} | Hands: ${result.landmarks().size}")
            }
            
            sendEvent("onHandLandmarksDetected", params)
            
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
            Log.d("HandLandmarks", "Cleanup successful")
        } catch (e: Exception) {
            Log.e("HandLandmarks", "Cleanup error: ${e.message}")
        }
    }
}