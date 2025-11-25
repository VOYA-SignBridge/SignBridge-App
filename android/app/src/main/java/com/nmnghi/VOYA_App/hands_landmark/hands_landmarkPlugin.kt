package com.nmnghi.VOYA_App.hands_landmark

import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.nmnghi.VOYA_App.HandLandmarkerHolder
import com.nmnghi.VOYA_App.toBitmap 
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import androidx.camera.core.ImageProxy

class hands_landmarkPlugin(proxy: com.mrousavy.camera.frameprocessors.VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val landmarker = HandLandmarkerHolder.handLandmarker ?: return "not_initialized"

        try {
            // Frame của Vision Camera mặc định là ImageProxy
            val bitmap = frame.imageProxy.toBitmap()
            val mpImage: MPImage = BitmapImageBuilder(bitmap).build()
            val timestamp = System.currentTimeMillis()

            landmarker.detectAsync(mpImage, timestamp)
            return "sent_to_mediapipe"
        } catch (e: Exception) {
            Log.e("hands_landmark", "Error processing frame", e)
            return "error: ${e.message}"
        }
    }
}