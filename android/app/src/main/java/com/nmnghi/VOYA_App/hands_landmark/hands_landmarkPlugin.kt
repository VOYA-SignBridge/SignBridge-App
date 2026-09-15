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
    private var alphabetCameraBaseNs: Long? = null
    private var alphabetWallBaseMs = 0L
    private var lastSubmittedTimestamp = 0L

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val landmarker = HandLandmarkerHolder.handLandmarker ?: return "not_initialized"

        return try {
            val mpImage: MPImage = frame.imageProxy.toMPImage()
            val timestamp = if (HandLandmarkerHolder.alphabetCaptureEnabled) {
                val cameraNs = frame.imageProxy.imageInfo.timestamp
                if (alphabetCameraBaseNs == null || cameraNs < alphabetCameraBaseNs!!) {
                    alphabetCameraBaseNs = cameraNs
                    alphabetWallBaseMs = System.currentTimeMillis()
                }
                maxOf(alphabetWallBaseMs + (cameraNs - alphabetCameraBaseNs!!) / 1_000_000L, lastSubmittedTimestamp + 1L)
            } else {
                alphabetCameraBaseNs = null
                System.currentTimeMillis()
            }
            landmarker.detectAsync(mpImage, timestamp)
            lastSubmittedTimestamp = timestamp
            "sent_to_mediapipe"
        } catch (e: Exception) {
            Log.e("hands_landmark", "Error processing frame", e)
            "error: ${e.message}"
        }
    }
}
