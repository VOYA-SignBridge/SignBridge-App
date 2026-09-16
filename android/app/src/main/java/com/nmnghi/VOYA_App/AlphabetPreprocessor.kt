package com.nmnghi.VOYA_App

/** Feature-wise standardization declared by asl_static_alphabet_26class_fp32.json. */
internal object AlphabetPreprocessor {
    const val FEATURE_DIMENSION = 63

    fun normalize(raw: FloatArray, mean: FloatArray, std: FloatArray): FloatArray {
        require(raw.size == FEATURE_DIMENSION) { "Expected 63 hand-landmark coordinates" }
        require(mean.size == FEATURE_DIMENSION && std.size == FEATURE_DIMENSION) {
            "Alphabet normalization must contain 63 means and standard deviations"
        }
        require(raw.all { it.isFinite() }) { "Coordinates must be finite float32 values" }
        require(mean.all { it.isFinite() } && std.all { it.isFinite() && it > 0f }) {
            "Alphabet normalization contains invalid values"
        }
        return FloatArray(FEATURE_DIMENSION) { index ->
            (raw[index] - mean[index]) / std[index]
        }.also { normalized ->
            require(normalized.all { it.isFinite() }) {
                "Alphabet normalization produced non-finite coordinates"
            }
        }
    }
}
