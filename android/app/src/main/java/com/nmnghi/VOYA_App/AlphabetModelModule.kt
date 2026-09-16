package com.nmnghi.VOYA_App

import com.facebook.react.bridge.*
import org.json.JSONObject
import org.pytorch.executorch.EValue
import org.pytorch.executorch.Module
import org.pytorch.executorch.Tensor
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import kotlin.math.exp

/** Local alphabet runtime. Word inference remains in HandLandmarksModule. */
class AlphabetModelModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    companion object {
        private const val MODEL_ID = "asl_static_alphabet_26class_fp32"
        private const val MODEL_FILE = "$MODEL_ID.pte"
        private const val METADATA_FILE = "$MODEL_ID.json"
        private const val MODEL_SHA256 = "22437659ab7682b995dadf3dd9f13e83e7321048436a278be0a94350fdabd18f"
        private const val CLASS_COUNT = 26
    }

    private val worker = Executors.newSingleThreadExecutor()
    // Access only on worker: Module.forward and destroy must never overlap.
    private var model: Module? = null
    private var labels: List<String> = emptyList()
    private var normalizationMean = FloatArray(0)
    private var normalizationStd = FloatArray(0)

    override fun getName() = "AlphabetModel"

    private fun submit(promise: Promise, action: () -> Unit) {
        try {
            worker.execute {
                try {
                    action()
                } catch (error: Exception) {
                    promise.reject("ALPHABET_PTE_FAILED", error.message, error)
                } catch (error: LinkageError) {
                    promise.reject("ALPHABET_RUNTIME_UNAVAILABLE",
                        "ExecuTorch requires a rebuilt 64-bit Android app: ${error.message}", error)
                }
            }
        } catch (error: RejectedExecutionException) {
            promise.reject("ALPHABET_CLOSED", "Alphabet runtime has been closed", error)
        }
    }

    @ReactMethod
    fun initialize(promise: Promise) = submit(promise) {
        ensureModel()
        promise.resolve(Arguments.createMap().apply {
            putString("id", MODEL_ID)
            putString("runtime", "executorch")
            putInt("sequenceLength", 1)
            putInt("featureDimension", AlphabetPreprocessor.FEATURE_DIMENSION)
            putInt("classCount", CLASS_COUNT)
            putString("normalizationVersion", "featurewise_standardization_v1")
        })
    }

    @ReactMethod
    fun predict(frame: ReadableArray, promise: Promise) = submit(promise) {
        require(frame.size() == AlphabetPreprocessor.FEATURE_DIMENSION) {
            "ASL static model expects exactly 63 coordinates"
        }
        ensureModel()
        val raw = FloatArray(AlphabetPreprocessor.FEATURE_DIMENSION) {
            frame.getDouble(it).toFloat()
        }
        val input = AlphabetPreprocessor.normalize(raw, normalizationMean, normalizationStd)
        val logits = forward(ensureModel(), input)
        val index = logits.indices.maxByOrNull { logits[it] }!!
        val max = logits[index]
        val denominator = logits.sumOf { exp((it - max).toDouble()) }
        promise.resolve(Arguments.createMap().apply {
            putString("modelId", MODEL_ID)
            putInt("classIndex", index)
            putString("label", labels[index])
            putString("label_key", labels[index])
            putDouble("confidence", 1.0 / denominator)
        })
    }

    private fun forward(module: Module, input: FloatArray): FloatArray {
        val outputs = module.forward(EValue.from(Tensor.fromBlob(input, longArrayOf(1, 63))))
        require(outputs.size == 1) { "ASL static model must return one logits tensor" }
        val tensor = outputs[0].toTensor()
        require(tensor.shape().contentEquals(longArrayOf(1, CLASS_COUNT.toLong()))) {
            "ASL static model output must have shape [1, 26]"
        }
        return tensor.dataAsFloatArray.also { logits ->
            require(logits.size == CLASS_COUNT && logits.all { it.isFinite() }) {
                "ASL static model returned invalid logits"
            }
        }
    }

    private fun ensureModel(): Module {
        model?.let { return it }
        val metadata = JSONObject(reactApplicationContext.assets.open(METADATA_FILE)
            .bufferedReader(Charsets.UTF_8).use { it.readText() })
        require(metadata.getString("format") == "executorch_pte")
        require(metadata.getString("precision") == "float32")
        require(metadata.getString("backend") == "xnnpack")
        require(metadata.getString("model_type") == "asl_static_mlp")
        require(metadata.getInt("num_classes") == CLASS_COUNT)
        for ((key, expected) in listOf("input" to listOf(1, 63), "output" to listOf(1, 26))) {
            val spec = metadata.getJSONObject(key)
            val shape = spec.getJSONArray("shape")
            require((0 until shape.length()).map { shape.getInt(it) } == expected)
        }

        val labelMap = metadata.getJSONObject("label_map")
        require(labelMap.length() == CLASS_COUNT)
        val orderedLabels = MutableList(CLASS_COUNT) { "" }
        for (label in labelMap.keys()) {
            val index = labelMap.getInt(label)
            require(index in 0 until CLASS_COUNT && orderedLabels[index].isEmpty()) {
                "Invalid or duplicate alphabet class index $index"
            }
            orderedLabels[index] = label
        }
        require(orderedLabels == ('A'..'Z').map { it.toString() }) {
            "ASL label_map must map A..Z to indices 0..25"
        }
        labels = orderedLabels

        val normalization = metadata.getJSONObject("normalization")
        fun floatArray(key: String): FloatArray {
            val values = normalization.getJSONArray(key)
            require(values.length() == AlphabetPreprocessor.FEATURE_DIMENSION) {
                "normalization.$key must contain 63 values"
            }
            return FloatArray(values.length()) { values.getDouble(it).toFloat() }
        }
        normalizationMean = floatArray("mean")
        normalizationStd = floatArray("std")
        // Validate the complete preprocessing contract before loading the PTE.
        AlphabetPreprocessor.normalize(normalizationMean, normalizationMean, normalizationStd)

        // ExecuTorch loads a real filesystem path. Use a content-addressed,
        // verified private copy so app updates cannot reuse stale model bytes.
        val sha = MODEL_SHA256
        val file = File(reactApplicationContext.filesDir, "$MODEL_ID-$sha.pte")
        fun hash(path: File): String {
            val digest = MessageDigest.getInstance("SHA-256")
            path.inputStream().use { stream ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val count = stream.read(buffer)
                    if (count < 0) break
                    digest.update(buffer, 0, count)
                }
            }
            return digest.digest().joinToString("") { "%02x".format(it) }
        }
        if (!file.exists() || hash(file) != sha) {
            val temp = File(file.path + ".tmp")
            try {
                reactApplicationContext.assets.open(MODEL_FILE).use { source ->
                    temp.outputStream().use { source.copyTo(it) }
                }
                require(hash(temp) == sha) { "Bundled ASL static model checksum mismatch" }
                check(temp.renameTo(file)) { "Cannot install bundled ASL static model" }
            } finally {
                temp.delete()
            }
        }
        val loaded = Module.load(file.absolutePath)
        try {
            // Warm up and fail during initialization for incompatible exports,
            // missing kernels or wrong shapes, before accepting camera frames.
            forward(loaded, FloatArray(AlphabetPreprocessor.FEATURE_DIMENSION))
            model = loaded
            return loaded
        } catch (error: Throwable) {
            loaded.destroy()
            throw error
        }
    }

    override fun invalidate() {
        if (worker.isShutdown) return
        worker.execute {
            model?.destroy()
            model = null
        }
        worker.shutdown()
        super.invalidate()
    }
}
