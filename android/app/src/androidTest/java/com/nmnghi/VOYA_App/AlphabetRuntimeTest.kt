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

/** Executes the actual packaged PTE/JNI and compares it with the original PT. */
@RunWith(AndroidJUnit4::class)
class AlphabetRuntimeTest {
    @Test fun packagedPteMatchesOriginalPytorchCheckpoint() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val cases = JSONObject(instrumentation.context.assets.open("alphabet-golden.json")
            .bufferedReader().use { it.readText() }).getJSONArray("cases")
        val file = File(context.cacheDir, "alphabet-runtime-test.pte")
        context.assets.open("handgcn_alphabet_20260914_094314.pte").use { source ->
            file.outputStream().use { source.copyTo(it) }
        }
        val model = Module.load(file.path)
        try {
            for (caseIndex in 0 until cases.length()) {
                val case = cases.getJSONObject(caseIndex)
                val raw = case.getJSONArray("raw")
                val input = FloatArray(60 * 126)
                for (t in 0 until 60) {
                    AlphabetPreprocessor.normalizeFrame(FloatArray(126) { raw.getDouble(t * 126 + it).toFloat() })
                        .copyInto(input, t * 126)
                }
                val output = model.forward(EValue.from(Tensor.fromBlob(input, longArrayOf(1, 60, 126))))[0].toTensor()
                assertArrayEquals(longArrayOf(1, 30), output.shape())
                val expected = case.getJSONArray("logits")
                val actual = output.dataAsFloatArray
                for (i in actual.indices) {
                    val value = expected.getDouble(i).toFloat()
                    assertEquals("case=$caseIndex logit=$i", value, actual[i], 2e-4f + 2e-4f * kotlin.math.abs(value))
                }
            }
        } finally {
            model.destroy()
            file.delete()
        }
    }

    @Test fun reactNativeBridgeInitializesAndDecodesMetadataLabels() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
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
            assertEquals("executorch", call(module::initialize).getString("runtime"))
            val frames = Arguments.createArray()
            repeat(60) {
                frames.pushArray(Arguments.createArray().apply { repeat(126) { pushDouble(0.0) } })
            }
            val prediction = call { module.predict(frames, it) }
            val labels = JSONObject(context.assets.open("handgcn_alphabet_20260914_094314.pte.metadata.json")
                .bufferedReader().use { it.readText() }).getJSONArray("idx_to_label")
            val expected = labels.getJSONObject(prediction.getInt("classIndex"))
            assertEquals(expected.getString("label_original"), prediction.getString("label"))
            assertEquals(expected.getString("label_key"), prediction.getString("label_key"))
            assertTrue(prediction.getDouble("confidence") in 0.0..1.0)
            val golden = JSONObject(InstrumentationRegistry.getInstrumentation().context.assets
                .open("alphabet-golden.json").bufferedReader().use { it.readText() })
                .getJSONArray("cases").getJSONObject(0).getJSONArray("logits")
            val logits = (0 until golden.length()).map { golden.getDouble(it) }
            val best = logits.indices.maxByOrNull { logits[it] }!!
            assertEquals(best, prediction.getInt("classIndex"))
            val confidence = 1.0 / logits.sumOf { kotlin.math.exp(it - logits[best]) }
            assertEquals(confidence, prediction.getDouble("confidence"), 2e-4)
        } finally {
            module.invalidate()
        }
    }
}
