package com.nmnghi.VOYA_App

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.*
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/** Check all three native runtimes when changing the Android system image. */
@RunWith(AndroidJUnit4::class)
class RecognitionCompatibilityTest {
    @Test fun wordModeStillLoadsItsRegisteredTfliteModel() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val module = HandLandmarksModule(BridgeReactContext(context))
        fun call(action: (Promise) -> Unit): WritableMap {
            val result = CompletableFuture<WritableMap>()
            action(PromiseImpl(
                Callback { args -> result.complete(args[0] as WritableMap) },
                Callback { args -> result.completeExceptionally(AssertionError(args.contentToString())) }
            ))
            return result.get(30, TimeUnit.SECONDS)
        }
        try {
            val config = call { module.getTcnModelConfig("word", it) }
            val frames = Arguments.createArray().apply {
                repeat(config.getInt("sequenceLength")) {
                    pushArray(Arguments.createArray().apply {
                        repeat(config.getInt("featureDimension")) { pushDouble(0.0) }
                    })
                }
            }
            val prediction = call { module.predictTcnForModel(frames, "word", it) }
            val registry = JSONObject(context.assets.open("tflite_models.json")
                .bufferedReader().use { it.readText() })
            val modelId = registry.getJSONObject("modes").getString("word")
            assertEquals(modelId, prediction.getString("modelId"))
            val labelFile = registry.getJSONObject("models").getJSONObject(modelId).getString("labelsFile")
            val labels = JSONObject(context.assets.open(labelFile).bufferedReader().use { it.readText() })
            assertEquals(labels.getString(prediction.getInt("classIndex").toString()), prediction.getString("label"))
            assertTrue(prediction.getDouble("confidence").isFinite())
            assertTrue(prediction.getDouble("confidence") in 0.0..1.0)
        } finally {
            module.onCatalystInstanceDestroy()
        }
    }

    @Test fun mediapipeHandLandmarkerLoadsAndProcessesAnImage() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val options = HandLandmarker.HandLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath("hand_landmarker.task").build())
            .setNumHands(2)
            .build()
        val landmarker = HandLandmarker.createFromOptions(context, options)
        val bitmap = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        val image = BitmapImageBuilder(bitmap).build()
        try {
            assertTrue(landmarker.detect(image).landmarks().isEmpty())
        } finally {
            landmarker.close()
            image.close()
            bitmap.recycle()
        }
    }
}
