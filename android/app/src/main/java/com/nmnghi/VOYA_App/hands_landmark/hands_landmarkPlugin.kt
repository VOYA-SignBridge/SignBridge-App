package com.nmnghi.VOYA_App.hands_landmark

import android.util.Log
import com.google.mediapipe.framework.image.MPImage
import com.nmnghi.VOYA_App.HandLandmarkerHolder
import com.nmnghi.VOYA_App.toMPImage
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

class hands_landmarkPlugin(
    proxy: VisionCameraProxy,
    options: Map<String, Any>?
) : FrameProcessorPlugin() {

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val landmarker = HandLandmarkerHolder.handLandmarker ?: return "not_initialized"

        return try {
            val mpImage: MPImage = frame.imageProxy.toMPImage()
            val timestamp = System.currentTimeMillis()
            landmarker.detectAsync(mpImage, timestamp)
            "sent_to_mediapipe"
        } catch (e: Exception) {
            Log.e("hands_landmark", "Error processing frame", e)
            "error: ${e.message}"
        }
    }
}
