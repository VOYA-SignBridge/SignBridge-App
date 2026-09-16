package com.nmnghi.VOYA_App

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.pytorch.executorch.EValue
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import java.io.File
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.exp

/** Executes the actual packaged ASL PTE/JNI and checks the JSON runtime contract. */
@RunWith(AndroidJUnit4::class)
class AlphabetRuntimeTest {
    private fun metadata(): JSONObject {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        return JSONObject(context.assets.open("asl_static_alphabet_26class_fp32.json")
            .bufferedReader().use { it.readText() })
    }

    private fun normalization(metadata: JSONObject): Pair<FloatArray, FloatArray> {
        val normalization = metadata.getJSONObject("normalization")
        fun values(key: String): FloatArray {
            val array = normalization.getJSONArray(key)
            return FloatArray(array.length()) { array.getDouble(it).toFloat() }
        }
        return values("mean") to values("std")
    }

    @Test fun packagedPteRunsWithDeclaredInputAndOutputShapes() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val metadata = metadata()
        val file = File(context.cacheDir, "asl-static-alphabet-runtime-test.pte")
        context.assets.open("asl_static_alphabet_26class_fp32.pte").use { source ->
            file.outputStream().use { source.copyTo(it) }
        }
        val model = Module.load(file.path)
        try {
            val (mean, std) = normalization(metadata)
            val input = AlphabetPreprocessor.normalize(mean, mean, std)
            val output = model.forward(
                EValue.from(Tensor.fromBlob(input, longArrayOf(1, 63)))
            )[0].toTensor()
            assertArrayEquals(longArrayOf(1, 26), output.shape())
            assertEquals(26, output.dataAsFloatArray.size)
            assertTrue(output.dataAsFloatArray.all { it.isFinite() })
        } finally {
            model.destroy()
            file.delete()
        }
    }

    @Test fun reactNativeBridgeNormalizesAndDecodesJsonLabelMap() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val metadata = metadata()
        val module = AlphabetModelModule(BridgeReactContext(context))
        fun call(action: (Promise) -> Unit): WritableMap {
            val result = CompletableFuture<WritableMap>()
            val promise = PromiseImpl(
                Callback { args -> result.complete(args[0] as WritableMap) },
                Callback { args -> result.completeExceptionally(AssertionError(args.contentToString())) }
            )
            action(promise)
            return result.get(30, TimeUnit.SECONDS)
        }

        try {
            val config = call(module::initialize)
            assertEquals("asl_static_alphabet_26class_fp32", config.getString("id"))
            assertEquals("executorch", config.getString("runtime"))
            assertEquals(1, config.getInt("sequenceLength"))
            assertEquals(63, config.getInt("featureDimension"))
            assertEquals(26, config.getInt("classCount"))

            val (mean, _) = normalization(metadata)
            val frame = Arguments.createArray().apply {
                mean.forEach { pushDouble(it.toDouble()) }
            }
            val prediction = call { module.predict(frame, it) }
            val index = prediction.getInt("classIndex")
            val labelMap = metadata.getJSONObject("label_map")
            val expectedLabel = labelMap.keys().asSequence()
                .first { labelMap.getInt(it) == index }
            assertEquals(expectedLabel, prediction.getString("label"))
            assertEquals(expectedLabel, prediction.getString("label_key"))
            assertTrue(prediction.getDouble("confidence") in 0.0..1.0)

            // Compare bridge argmax/softmax against the same packaged model on
            // normalized zero input, proving preprocessing and label decoding.
            val file = File(context.cacheDir, "asl-static-alphabet-bridge-test.pte")
            context.assets.open("asl_static_alphabet_26class_fp32.pte").use { source ->
                file.outputStream().use { source.copyTo(it) }
            }
            val direct = Module.load(file.path)
            try {
                val logits = direct.forward(EValue.from(
                    Tensor.fromBlob(FloatArray(63), longArrayOf(1, 63))
                ))[0].toTensor().dataAsFloatArray
                val best = logits.indices.maxByOrNull { logits[it] }!!
                assertEquals(best, index)
                val confidence = 1.0 / logits.sumOf { exp((it - logits[best]).toDouble()) }
                assertEquals(confidence, prediction.getDouble("confidence"),
                    2e-4 + 2e-4 * abs(confidence))
            } finally {
                direct.destroy()
                file.delete()
            }
        } finally {
            module.invalidate()
        }
    }
}
