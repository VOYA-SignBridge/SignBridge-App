package com.nmnghi.VOYA_App.alphabet

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker.HandLandmarkerOptions
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import kotlin.math.abs
import kotlin.math.max

@RunWith(AndroidJUnit4::class)
class AlphabetParityTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    private fun bytes(name: String) = instrumentation.context.assets.open("alphabet/$name").use { it.readBytes() }
    private fun hash(data: ByteArray) = MessageDigest.getInstance("SHA-256").digest(data).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun floats(data: ByteArray): FloatArray {
        require(data.size % 4 == 0)
        val b = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        return FloatArray(b.remaining()).also { b.get(it) }
    }
    private fun frame(values: FloatArray, sample: Int, t: Int) = values.copyOfRange((sample * 60 + t) * 126, (sample * 60 + t + 1) * 126)

    private class Metrics {
        var maxAbs = 0.0
        var sumAbs = 0.0
        var maxRelative = 0.0
        var sumRelative = 0.0
        var values = 0
        var samples = 0
        var agreements = 0
        var allclose = true
        val changed = JSONArray()
        fun add(expected: DoubleArray, actual: FloatArray, sample: String) {
            samples++
            if (expected.indices.maxByOrNull { expected[it] } == actual.indices.maxByOrNull { actual[it] }) agreements++
            else changed.put(sample)
            for (j in expected.indices) {
                val error = abs(expected[j] - actual[j])
                val relative = error / max(abs(expected[j]), 1e-6)
                maxAbs = max(maxAbs, error)
                sumAbs += error
                maxRelative = max(maxRelative, relative)
                sumRelative += relative
                values++
                allclose = allclose && actual[j].isFinite() && error <= 1e-4 + 1e-4 * abs(expected[j])
            }
        }
        fun json() = JSONObject().put("sampleCount", samples).put("argmaxAgreement", agreements.toDouble() / samples)
            .put("maxAbsoluteError", maxAbs).put("meanAbsoluteError", sumAbs / values)
            .put("maxRelativeError", maxRelative).put("meanRelativeError", sumRelative / values)
            .put("relativeDenominatorFloor", 1e-6).put("allclose", allclose).put("changedArgmax", changed)
    }

    @Test
    fun goldenRawToLabelsAndNormalizedToLogits() {
        val golden = JSONObject(bytes("golden.json").toString(Charsets.UTF_8))
        val rawBytes = bytes("raw.f32")
        val inputBytes = bytes("input.f32")
        assertEquals(golden.getString("rawSha256"), hash(rawBytes))
        assertEquals(golden.getString("inputSha256"), hash(inputBytes))
        val raw = floats(rawBytes)
        val input = floats(inputBytes)
        val names = golden.getJSONArray("sampleNames")
        val rawCount = golden.optInt("rawSampleCount", raw.size / (60 * 126))
        assertEquals(names.length() * 60 * 126, input.size)
        assertEquals(rawCount * 60 * 126, raw.size)
        val pt = Metrics()
        val lite = Metrics()
        val endToEnd = Metrics()
        val outputs = JSONArray()
        var maxPreprocessError = 0.0
        var latencyNs = 0L
        AlphabetRuntime(
            instrumentation.targetContext,
            "bigru_attention_alphabet_20260914_092530_executorch_1dca17c6"
        ).use { runtime ->
            assertEquals("bigru_attention_alphabet_20260914_092530_executorch_1dca17c6", runtime.id)
            assertEquals(golden.getString("modelSha256"), runtime.modelSha256)
            for (index in 0..29) assertEquals(golden.getJSONObject("labels").getString(index.toString()), runtime.labels[index])
            for (s in 0 until names.length()) {
                val clip = Array(60) { t -> frame(input, s, t) }
                val start = System.nanoTime()
                val logits = runtime.predictNormalized(clip)
                latencyNs += System.nanoTime() - start
                val expectedPt = golden.getJSONArray("pytorchLogits").getJSONArray(s)
                val runtimeLogitsKey = if (golden.has("runtimeLogits")) "runtimeLogits" else "tfliteLogits"
                val expectedLite = golden.getJSONArray(runtimeLogitsKey).getJSONArray(s)
                pt.add(DoubleArray(30) { expectedPt.getDouble(it) }, logits, names.getString(s))
                lite.add(DoubleArray(30) { expectedLite.getDouble(it) }, logits, names.getString(s))
                if (s < rawCount) {
                    val rawClip = Array(60) { t -> frame(raw, s, t) }
                    rawClip.forEachIndexed { t, f ->
                        val prepared = runtime.prepare(f)
                        for (j in 0 until 126) maxPreprocessError = max(maxPreprocessError, abs(prepared[j].toDouble() - clip[t][j]))
                    }
                    endToEnd.add(DoubleArray(30) { expectedPt.getDouble(it) }, runtime.predictRaw(rawClip), names.getString(s))
                }
                val index = runtime.classIndex(logits)
                assertEquals(golden.getJSONObject("labels").getString(index.toString()), runtime.labels[index])
                assertTrue(runtime.confidence(logits) in 0.0..1.0)
                outputs.put(JSONObject().put("sample", names.getString(s)).put("logits", JSONArray(logits.map { it.toDouble() }))
                    .put("classIndex", index).put("label", runtime.labels[index]))
            }
            val report = JSONObject().put("modelId", runtime.id).put("modelSha256", runtime.modelSha256)
                .put("androidVsPytorch", pt.json()).put("androidVsPythonTflite", lite.json()).put("rawEndToEndVsPytorch", endToEnd.json())
                .put("maxPreprocessingError", maxPreprocessError).put("labelsVerified", 30)
                .put("meanInferenceMs", latencyNs.toDouble() / names.length() / 1e6)
                .put("device", android.os.Build.MODEL).put("abis", JSONArray(android.os.Build.SUPPORTED_ABIS.toList()))
                .put("outputs", outputs)
            File(instrumentation.targetContext.filesDir, "alphabet-parity.json").writeText(report.toString(2))
        }
        assertTrue("Python/Kotlin preprocessing mismatch: $maxPreprocessError", maxPreprocessError <= 2e-6)
        for (m in listOf(pt, lite, endToEnd)) {
            assertTrue("Logit parity failed: ${m.json()}", m.allclose)
            assertEquals("Argmax mismatch: ${m.json()}", m.samples, m.agreements)
        }
    }

    @Test
    fun activeBigruProbabilityModelLoadsAndRuns() {
        AlphabetRuntime(instrumentation.targetContext, "model_bigru").use { runtime ->
            assertEquals("model_bigru", runtime.id)
            assertEquals("dc868da1644295ff10976f3eeee0681be13e6168f7da228611126312c0a50638", runtime.modelSha256)
            val output = runtime.predictNormalized(Array(60) { FloatArray(126) })
            val expected = floatArrayOf(
                .00010507562f, .000008498184f, .000051238785f, .15392947f, .00001254765f,
                .00018254435f, .00030755135f, .00014508562f, .00007534142f, .045719083f,
                .14204301f, .078937136f, .005789892f, .009718032f, .012895528f,
                .2085425f, .000002856129f, .000015609639f, .000052120533f, .08851448f,
                .10213509f, .017676404f, .0013437769f, .0050186752f, .08028318f,
                .009147534f, .02799831f, .00039920147f, .00885693f, .000093252354f
            )
            assertEquals(30, output.size)
            for (index in output.indices) assertEquals(expected[index], output[index], 1e-6f)
            assertEquals(1f, output.sum(), 1e-5f)
            assertTrue(output.all { it in 0f..1f })
            assertEquals(output.maxOrNull()!!.toDouble(), runtime.confidence(output), 1e-7)
        }
    }

    @Test
    fun activeVoyaTcnExecuTorchModelLoadsAndRuns() {
        AlphabetRuntime(instrumentation.targetContext).use { runtime ->
            assertEquals("voya_tcn_alphabet_30class_fp32_executorch_d7a6bee0", runtime.id)
            assertEquals("d7a6bee0b62477a1602ed2b24529e2e873d01463c8acb95c0a77cd6179caea12", runtime.modelSha256)
            val output = runtime.predictNormalized(Array(60) { FloatArray(126) })
            val expected = floatArrayOf(
                -0.68861175f, -2.9636488f, -7.0857635f, -2.1051788f, -1.2842485f,
                2.3700378f, -1.3669834f, -2.7827787f, -0.39232472f, -2.9953728f,
                -0.9656015f, -3.5497155f, -3.4380293f, -3.5851183f, -2.0609958f,
                -0.4022182f, -0.38979983f, -1.6478817f, -3.4459302f, 0.024447229f,
                1.7034023f, 0.8247658f, 1.1668481f, -0.09364464f, 0.5468408f,
                1.1562471f, 1.9906325f, -3.9413989f, -3.0832064f, -4.002048f
            )
            assertEquals(30, output.size)
            for (index in output.indices) assertEquals(expected[index], output[index], 1e-5f)
            assertEquals(5, runtime.classIndex(output))
            assertTrue(runtime.confidence(output) in 0.0..1.0)
        }
    }

    @Test
    fun handLandmarkerNativeLibraryLoadsOnX86_64() {
        val options = HandLandmarkerOptions.builder()
            .setBaseOptions(BaseOptions.builder().setModelAssetPath("hand_landmarker.task").build())
            .setNumHands(2)
            .build()
        HandLandmarker.createFromOptions(instrumentation.targetContext, options).use { landmarker ->
            assertNotNull(landmarker)
        }
    }

    @Test
    fun legacyPlainTensorProbabilityModelLoadsAndRuns() {
        AlphabetRuntime(instrumentation.targetContext, "model").use { runtime ->
            assertEquals("model", runtime.id)
            assertEquals("910de8cf5d73a244e1fbc1b791230cf21b484189c9ee0568a8806140ca716cd0", runtime.modelSha256)
            val output = runtime.predictNormalized(Array(60) { FloatArray(126) })
            val expected = floatArrayOf(
                .01726797968f, .01435745601f, .02821303345f, .02346978337f, .02087986469f,
                .02105567418f, .02084993944f, .04055106267f, .02332900465f, .02850115299f,
                .0181315057f, .01558285207f, .03782382607f, .01801200211f, .03426160663f,
                .1187128201f, .03905569389f, .01509803906f, .01367387082f, .07726921886f,
                .1133991852f, .05687724799f, .04562859237f, .02444506995f, .03159425035f,
                .01604584791f, .02231574617f, .02359935082f, .01323239412f, .02676585875f
            )
            assertEquals(30, output.size)
            for (index in output.indices) assertEquals(expected[index], output[index], 1e-5f)
            assertEquals(1f, output.sum(), 1e-3f)
            assertTrue(output.all { it in 0f..1f })
            assertEquals(output.maxOrNull()!!.toDouble(), runtime.confidence(output), 1e-7)
        }
    }

    @Test
    fun handOrderingAndNegativeZ() {
        val raw = FloatArray(126)
        for (landmark in 0..20) {
            raw[landmark * 3] = .6f + landmark * .01f
            raw[landmark * 3 + 1] = .7f - landmark * .02f
            raw[landmark * 3 + 2] = landmark * -.03f
        }
        val prepared = AlphabetPreprocessing.prepare(raw, swapHandedness = true, mirrorX = false)
        assertTrue(prepared.take(63).all { it == 0f })
        assertEquals(0f, prepared[63], 0f)
        assertEquals(-.03f, prepared[68], 0f)
        assertTrue(prepared.drop(63).any { it != 0f })
        val mirrored = AlphabetPreprocessing.prepare(raw, swapHandedness = true, mirrorX = true)
        assertEquals(-prepared[66], mirrored[66], 1e-6f)
        assertEquals(prepared[67], mirrored[67], 1e-6f)
        assertEquals(prepared[68], mirrored[68], 0f)
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsNonFiniteRawInput() {
        AlphabetPreprocessing.prepare(FloatArray(126).apply { this[3] = Float.NaN }, true, false)
    }
}
