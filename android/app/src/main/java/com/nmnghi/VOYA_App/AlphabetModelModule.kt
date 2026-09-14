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
        private const val MODEL_ID = "handgcn_alphabet_20260914_094314"
        private const val MODEL_FILE = "$MODEL_ID.pte"
        private const val CLASS_COUNT = 30
    }

    private val worker = Executors.newSingleThreadExecutor()
    // Access only on worker: Module.forward and destroy must never overlap.
    private var model: Module? = null
    private var labels: List<Pair<String, String>> = emptyList()

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
            putInt("sequenceLength", AlphabetPreprocessor.SEQUENCE_LENGTH)
            putInt("featureDimension", AlphabetPreprocessor.FEATURE_DIMENSION)
            putInt("classCount", CLASS_COUNT)
            putString("normalizationVersion", "hands126_v1")
        })
    }

    @ReactMethod
    fun predict(frames: ReadableArray, promise: Promise) = submit(promise) {
        require(frames.size() == 60) { "HandGCN expects exactly 60 frames" }
        val input = FloatArray(60 * 126)
        for (t in 0 until 60) {
            val frame = requireNotNull(frames.getArray(t)) { "Frame $t is null" }
            require(frame.size() == 126) { "Frame $t must contain 126 coordinates" }
            val raw = FloatArray(126) { frame.getDouble(it).toFloat() }
            AlphabetPreprocessor.normalizeFrame(raw).copyInto(input, t * 126)
        }
        val logits = forward(ensureModel(), input)
        val index = logits.indices.maxByOrNull { logits[it] }!!
        val max = logits[index]
        val denominator = logits.sumOf { exp((it - max).toDouble()) }
        promise.resolve(Arguments.createMap().apply {
            putString("modelId", MODEL_ID)
            putInt("classIndex", index)
            putString("label", labels[index].first)
            putString("label_key", labels[index].second)
            putDouble("confidence", 1.0 / denominator)
        })
    }

    private fun forward(module: Module, input: FloatArray): FloatArray {
        val outputs = module.forward(EValue.from(Tensor.fromBlob(input, longArrayOf(1, 60, 126))))
        require(outputs.size == 1) { "HandGCN must return one logits tensor" }
        val tensor = outputs[0].toTensor()
        require(tensor.shape().contentEquals(longArrayOf(1, CLASS_COUNT.toLong()))) {
            "HandGCN output must have shape [1, 30]"
        }
        return tensor.dataAsFloatArray.also { logits ->
            require(logits.size == CLASS_COUNT && logits.all { it.isFinite() }) {
                "HandGCN returned invalid logits"
            }
        }
    }

    private fun ensureModel(): Module {
        model?.let { return it }
        val metadata = JSONObject(reactApplicationContext.assets.open("$MODEL_FILE.metadata.json")
            .bufferedReader(Charsets.UTF_8).use { it.readText() })
        require(metadata.getString("format") == "voya-executorch-handgcn-v1")
        require(metadata.getString("normalization_version") == "hands126_v1")
        require(metadata.getInt("seq_len") == 60 && metadata.getInt("feature_dim") == 126)
        require(metadata.getInt("num_classes") == CLASS_COUNT)
        for ((key, expected) in listOf("input" to listOf(1, 60, 126), "output" to listOf(1, 30))) {
            val spec = metadata.getJSONObject(key)
            val shape = spec.getJSONArray("shape")
            require(spec.getString("dtype") == "float32")
            require((0 until shape.length()).map { shape.getInt(it) } == expected)
        }
        val labelArray = metadata.getJSONArray("idx_to_label")
        require(labelArray.length() == CLASS_COUNT)
        labels = (0 until CLASS_COUNT).map {
            val label = labelArray.getJSONObject(it)
            label.getString("label_original") to label.getString("label_key")
        }
        require(labels.all { it.first.isNotBlank() && it.second.isNotBlank() })

        // ExecuTorch loads a real filesystem path. Use a content-addressed,
        // verified private copy so app updates cannot reuse stale model bytes.
        val sha = metadata.getString("pte_sha256")
        require(sha.matches(Regex("[0-9a-f]{64}")))
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
                require(hash(temp) == sha) { "Bundled HandGCN model checksum mismatch" }
                check(temp.renameTo(file)) { "Cannot install bundled HandGCN model" }
            } finally {
                temp.delete()
            }
        }
        val loaded = Module.load(file.absolutePath)
        try {
            // Warm up and fail during initialization for incompatible exports,
            // missing kernels or wrong shapes, before accepting camera frames.
            forward(loaded, FloatArray(60 * 126))
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
