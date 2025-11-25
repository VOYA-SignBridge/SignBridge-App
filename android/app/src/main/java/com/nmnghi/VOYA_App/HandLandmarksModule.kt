package com.nmnghi.VOYA_App

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarkerResult
import com.facebook.react.modules.core.DeviceEventManagerModule

class HandLandmarksModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        init {
            try {
                System.loadLibrary("mediapipe_tasks_vision_jni")
                Log.d("HandLandmarks", "MediaPipe library loaded successfully")
            } catch (e: UnsatisfiedLinkError) {
                Log.e("HandLandmarks", "FAILED to load MediaPipe library: ${e.message}")
            }
        }
    }

    override fun getName() = "HandLandmarks"

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactApplicationContext.hasActiveCatalystInstance()) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun initModel() {
        if (HandLandmarkerHolder.handLandmarker != null) {
            sendEvent("onHandLandmarksStatus", Arguments.createMap().apply { putString("status", "already_initialized") })
            return
        }

        try {
            val context: Context = reactApplicationContext
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath("hand_landmarker.task")
                .build()

            val options = HandLandmarker.HandLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setNumHands(1)
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setResultListener { result, _ -> processResult(result) }
                .build()

            HandLandmarkerHolder.handLandmarker = HandLandmarker.createFromOptions(context, options)

            sendEvent("onHandLandmarksStatus", Arguments.createMap().apply { putString("status", "initialized") })
        } catch (e: Exception) {
            Log.e("HandLandmarks", "Init failed", e)
            sendEvent("onHandLandmarksError", Arguments.createMap().apply { putString("error", e.message) })
        }
    }

    private fun processResult(result: HandLandmarkerResult) {
        if (result.landmarks().isEmpty()) return

        val landmarksArray = Arguments.createArray()
        for (hand in result.landmarks()) {
            val handArray = Arguments.createArray()
            for ((i, lm) in hand.withIndex()) {
                val map = Arguments.createMap()
                map.putInt("index", i)
                map.putDouble("x", lm.x().toDouble())
                map.putDouble("y", lm.y().toDouble())
                map.putDouble("z", lm.z().toDouble())
                handArray.pushMap(map)
            }
            landmarksArray.pushArray(handArray)
        }

        val params = Arguments.createMap()
        params.putArray("landmarks", landmarksArray)
        sendEvent("onHandLandmarksDetected", params)
    }
}