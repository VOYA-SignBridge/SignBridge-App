package com.nmnghi.VOYA_App.alphabet

import android.content.Context
import android.os.Build
import org.json.JSONObject
import org.pytorch.executorch.EValue
import org.pytorch.executorch.Module as ExecuTorchModule
import org.pytorch.executorch.Tensor as ExecuTorchTensor
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.nio.channels.FileChannel
import java.security.MessageDigest
import kotlin.math.exp

/** Same CPU runtime and preprocessing used by the app and Android golden tests. */
class AlphabetRuntime(private val context: Context, requestedModelId: String? = null) : Closeable {
    private val assets = context.assets
    val id: String
    val config: JSONObject
    val labels: List<String>
    val modelSha256: String
    private val interpreter: Interpreter?
    private val executorchModule: ExecuTorchModule?
    private val runtimeType: String
    private val outputType: String

    init {
        val registry =
            JSONObject(assets.open("tflite_models.json").bufferedReader().use { it.readText() })
        val modes = registry.getJSONObject("modes")
        val models = registry.getJSONObject("models")
        val configuredId = modes.getString("alphabetHandgcn") // use alphabetHandgcn for test!!!
        val configuredRuntime = models.getJSONObject(configuredId).optString("runtime", "tflite")
        val supportsExecuTorch = Build.SUPPORTED_ABIS.any { it == "arm64-v8a" || it == "x86_64" }
        id =
            if (requestedModelId == null && configuredRuntime == "executorch" && !supportsExecuTorch) {
                modes.optString("alphabetX86Fallback", configuredId)
            } else {
                configuredId
            }
        config = models.getJSONObject(id)
        runtimeType = config.optString("runtime", "tflite")
        require(
            config.getString("normalizationVersion") in setOf(
                AlphabetPreprocessing.VERSION,
                AlphabetPreprocessing.HANDGCN_VERSION
            )
        )
        require(
            runtimeType in setOf(
                "tflite",
                "executorch"
            )
        ) { "$id: unsupported runtime '$runtimeType'" }
        require(
            config.getInt("sequenceLength") == 60 &&
                    config.getInt("featureDimension") == 126 &&
                    config.getInt("classCount") == 30
        ) { "$id: expected input [1,60,126] and output [1,30]" }
        outputType = config.getString("outputType")
        require(
            (outputType == "logits" && config.getBoolean("applySoftmax")) ||
                    (outputType == "probabilities" && !config.getBoolean("applySoftmax"))
        ) { "$id: outputType/applySoftmax mismatch" }
        require(config.getInt("sampleFps") == 30)

        modelSha256 = assetSha(config.getString("modelFile"))
        require(modelSha256 == config.getString("modelSha256")) { "$id: model SHA-256 mismatch" }
        require(assetSha(config.getString("labelsFile")) == config.getString("labelsSha256")) {
            "$id: labels SHA-256 mismatch"
        }
        val labelJson = JSONObject(
            assets.open(config.getString("labelsFile")).bufferedReader(Charsets.UTF_8)
                .use { it.readText() }
        )
        require(labelJson.length() == 30)
        labels = (0 until 30).map { index ->
            val value = labelJson.get(index.toString())
            when (value) {
                is JSONObject -> value.getString("label_original")
                is String -> value
                else -> error("$id: unsupported label at index $index")
            }
        }
        validateHandGcnMetadataIfPresent(labelJson)
        require(labels.toSet().size == 30 && labels.none { it.isBlank() }) { "$id: invalid class mapping" }

        if (runtimeType == "tflite") {
            val buffer = assets.openFd(config.getString("modelFile")).use { fd ->
                FileInputStream(fd.fileDescriptor).use { stream ->
                    stream.channel.map(
                        FileChannel.MapMode.READ_ONLY,
                        fd.startOffset,
                        fd.declaredLength
                    )
                }
            }
            val candidate = Interpreter(
                buffer,
                Interpreter.Options().setNumThreads(config.getInt("numThreads"))
            )
            try {
                validateTflite(candidate)
            } catch (e: Exception) {
                candidate.close()
                throw e
            }
            interpreter = candidate
            executorchModule = null
        } else {
            require(supportsExecuTorch) {
                "$id: ExecuTorch Android requires arm64-v8a or x86_64; device=${Build.SUPPORTED_ABIS.joinToString()}"
            }
            validateExecuTorchSidecarIfPresent()
            val modelFile = materializeExecuTorchAsset(config.getString("modelFile"), modelSha256)
            val candidate = ExecuTorchModule.load(modelFile.absolutePath)
            try {
                candidate.loadMethod("forward")
                require(runExecuTorch(candidate, Array(60) { FloatArray(126) }).size == 30)
            } catch (e: Exception) {
                candidate.close()
                throw e
            }
            interpreter = null
            executorchModule = candidate
        }
    }

    private fun assetSha(name: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        assets.open(name).use { stream ->
            val chunk = ByteArray(65536)
            while (true) {
                val count = stream.read(chunk)
                if (count < 0) break
                digest.update(chunk, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
    }

    private fun fileSha(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { stream ->
            val chunk = ByteArray(65536)
            while (true) {
                val count = stream.read(chunk)
                if (count < 0) break
                digest.update(chunk, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
    }

    private fun materializeExecuTorchAsset(assetName: String, expectedSha: String): File {
        val directory = File(context.codeCacheDir, "alphabet-executorch").apply { mkdirs() }
        val target = File(directory, "$expectedSha.pte")
        if (!target.isFile || fileSha(target) != expectedSha) {
            assets.open(assetName).use { input -> target.outputStream().use(input::copyTo) }
        }
        require(fileSha(target) == expectedSha) { "$id: copied PTE SHA-256 mismatch" }
        return target
    }

    private fun validateExecuTorchSidecarIfPresent() {
        if (!config.has("metadataFile")) return
        val metadataFile = config.getString("metadataFile")
        require(assetSha(metadataFile) == config.getString("metadataSha256")) { "$id: metadata SHA-256 mismatch" }
        val metadata = JSONObject(
            assets.open(metadataFile).bufferedReader(Charsets.UTF_8).use { it.readText() })
        require(
            metadata.getInt("seq_len") == 60 && metadata.getInt("feature_dim") == 126 && metadata.getInt(
                "num_classes"
            ) == 30
        )
        require(metadata.getJSONObject("input").getJSONArray("shape").let {
            it.length() == 3 && it.getInt(0) == 1 && it.getInt(1) == 60 && it.getInt(2) == 126
        })
        require(metadata.getJSONObject("output").getJSONArray("shape").let {
            it.length() == 2 && it.getInt(0) == 1 && it.getInt(1) == 30
        })
        val metadataLabels = metadata.optJSONObject("idx_to_label") ?: return
        for (index in 0 until 30) {
            require(
                metadataLabels.getJSONObject(index.toString())
                    .getString("label_original") == labels[index]
            )
        }
    }

    private fun validateHandGcnMetadataIfPresent(labelJson: JSONObject) {
        if (config.optString("normalizationVersion") != AlphabetPreprocessing.HANDGCN_VERSION) return
        val filename = config.getString("metadataFile")
        require(assetSha(filename) == config.getString("metadataSha256")) { "$id: metadata SHA-256 mismatch" }
        val metadata =
            JSONObject(assets.open(filename).bufferedReader(Charsets.UTF_8).use { it.readText() })
        require(metadata.getString("artifact_format") == "tflite")
        require(metadata.getString("model_type") == "HandGCN_Lite")
        val contract = metadata.getJSONObject("training_contract")
        require(
            contract.getInt("seq_len") == 60 && contract.getInt("feature_dim") == 126 && contract.getInt(
                "num_classes"
            ) == 30
        )
        val prep = contract.getJSONObject("preprocess_contract")
        require(prep.getString("landmark_order") == "MP_Left(63)+MP_Right(63)")
        require(prep.getString("coordinate_space") == "mediapipe_normalized")
        require(prep.getString("coordinate_order") == "xyz")
        require(prep.getString("frontend_mirroring") == "visual_only")
        require(metadata.getJSONObject("input").getJSONArray("shape").let {
            it.length() == 3 && it.getInt(0) == 1 && it.getInt(1) == 60 && it.getInt(2) == 126
        })
        require(metadata.getJSONObject("output").getJSONArray("shape").let {
            it.length() == 2 && it.getInt(0) == 1 && it.getInt(1) == 30
        })
        val mapping = contract.getJSONObject("idx_to_label")
        for (i in 0 until 30) {
            require(
                mapping.getJSONObject(i.toString()).getString("class_uid") ==
                        labelJson.getJSONObject(i.toString()).getString("class_uid")
            ) { "$id: label identity mismatch at $i" }
            require(mapping.getJSONObject(i.toString()).getString("label_original") == labels[i]) {
                "$id: metadata label mismatch at $i"
            }
        }
    }

    private fun validateTflite(runtime: Interpreter) {
        val signatureKey = config.getString("signatureKey")
        val inputName = config.getString("frameInputName")
        val outputName = config.getString("outputName")
        val (inputTensor, outputTensor) = if (signatureKey.isNotBlank()) {
            require(runtime.signatureKeys.toSet() == setOf(signatureKey)) { "$id: signature mismatch" }
            require(
                runtime.getSignatureInputs(signatureKey).toSet() == setOf(inputName)
            ) { "$id: input signature mismatch" }
            require(
                runtime.getSignatureOutputs(signatureKey).toSet() == setOf(outputName)
            ) { "$id: output signature mismatch" }
            runtime.getInputTensorFromSignature(inputName, signatureKey) to
                    runtime.getOutputTensorFromSignature(outputName, signatureKey)
        } else {
            require(runtime.inputTensorCount == 1 && runtime.outputTensorCount == 1) {
                "$id: plain tensor model must have exactly one input and one output"
            }
            runtime.getInputTensor(0) to runtime.getOutputTensor(0)
        }
        require(
            inputTensor.shape().contentEquals(intArrayOf(1, 60, 126))
        ) { "$id: input shape mismatch" }
        require(
            outputTensor.shape().contentEquals(intArrayOf(1, 30))
        ) { "$id: output shape mismatch" }
        val expectedInput = config.optString("inputTensorName")
        val expectedOutput = config.optString("outputTensorName")
        require(
            (expectedInput.isBlank() || inputTensor.name() == expectedInput) &&
                    (expectedOutput.isBlank() || outputTensor.name() == expectedOutput)
        ) { "$id: tensor name mismatch" }
        for (tensor in listOf(inputTensor, outputTensor)) {
            require(tensor.dataType() == DataType.FLOAT32) { "$id: expected FP32" }
            require(tensor.quantizationParams().scale == 0f && tensor.quantizationParams().zeroPoint == 0) {
                "$id: unexpected quantization"
            }
        }
    }

    fun prepare(raw: FloatArray): FloatArray = if (
        config.getString("normalizationVersion") == AlphabetPreprocessing.HANDGCN_VERSION
    ) {
        AlphabetPreprocessing.prepareHandGcn(raw, config.getBoolean("swapHandedness"))
    } else {
        AlphabetPreprocessing.prepare(
            raw,
            config.getBoolean("swapHandedness"),
            config.getBoolean("mirrorInput")
        )
    }

    fun predictRaw(frames: Array<FloatArray>): FloatArray =
        predictNormalized(Array(frames.size) { prepare(frames[it]) })

    /** Internal/debug entry: input is already normalized, so do not normalize a second time. */
    @Synchronized
    fun predictNormalized(frames: Array<FloatArray>): FloatArray {
        require(frames.size == 60 && frames.all { it.size == 126 && it.all(Float::isFinite) }) {
            "$id: expected finite [60,126]"
        }
        val result = if (runtimeType == "executorch") {
            runExecuTorch(requireNotNull(executorchModule), frames)
        } else {
            val output = arrayOf(FloatArray(30))
            val signatureKey = config.getString("signatureKey")
            val runtime = requireNotNull(interpreter)
            if (signatureKey.isBlank()) {
                runtime.run(arrayOf(frames), output)
            } else {
                runtime.runSignature(
                    mapOf(config.getString("frameInputName") to arrayOf(frames)),
                    mapOf(config.getString("outputName") to output),
                    signatureKey
                )
            }
            output[0]
        }
        require(result.size == 30 && result.all { it.isFinite() }) { "$id: invalid [1,30] output" }
        if (outputType == "probabilities") {
            require(result.all { it in 0f..1f } && kotlin.math.abs(result.sum() - 1f) <= 1e-3f) {
                "$id: output declared as probabilities but values are not a probability distribution"
            }
        }
        return result
    }

    private fun runExecuTorch(runtime: ExecuTorchModule, frames: Array<FloatArray>): FloatArray {
        val flattened = FloatArray(60 * 126)
        for (time in frames.indices) {
            System.arraycopy(frames[time], 0, flattened, time * 126, 126)
        }
        val input = ExecuTorchTensor.fromBlob(flattened, longArrayOf(1, 60, 126))
        val outputs = runtime.forward(EValue.from(input))
        require(outputs.size == 1 && outputs[0].isTensor) { "$id: forward() must return one tensor" }
        val tensor = outputs[0].toTensor()
        require(
            tensor.shape().contentEquals(longArrayOf(1, 30))
        ) { "$id: ExecuTorch output shape mismatch" }
        return tensor.dataAsFloatArray
    }

    fun classIndex(logits: FloatArray): Int = logits.indices.maxByOrNull { logits[it] }!!

    fun confidence(logits: FloatArray): Double {
        if (outputType == "probabilities") return logits[classIndex(logits)].toDouble()
        val max = logits.maxOrNull()!!.toDouble()
        return 1.0 / logits.sumOf { exp(it.toDouble() - max) }
    }

    @Synchronized
    override fun close() {
        interpreter?.close()
        executorchModule?.close()
    }
}
