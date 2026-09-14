package com.nmnghi.VOYA_App

import kotlin.math.sqrt

/** Exact hands126_v1 from processed/shared/normalization.py (not the legacy TFLite variant). */
internal object AlphabetPreprocessor {
    const val SEQUENCE_LENGTH = 60
    const val FEATURE_DIMENSION = 126

    fun normalizeFrame(raw: FloatArray): FloatArray {
        require(raw.size == FEATURE_DIMENSION) { "Expected 126 coordinates" }
        require(raw.all { it.isFinite() }) { "Coordinates must be finite float32 values" }
        val out = raw.copyOf()
        for (offset in intArrayOf(0, 63)) {
            if ((offset until offset + 63).all { raw[it] == 0f }) continue
            var minX = Float.POSITIVE_INFINITY
            var minY = Float.POSITIVE_INFINITY
            var maxX = Float.NEGATIVE_INFINITY
            var maxY = Float.NEGATIVE_INFINITY
            for (point in 0 until 21) {
                val i = offset + point * 3
                val x = raw[i] - raw[offset]
                val y = raw[i + 1] - raw[offset + 1]
                out[i] = x
                out[i + 1] = y
                // numpy includes every translated point, even an originally
                // zero triple in a nonempty hand. Only a WHOLE absent hand skips.
                if (sqrt(x * x + y * y) > 1e-6f) {
                    minX = minOf(minX, x)
                    maxX = maxOf(maxX, x)
                    minY = minOf(minY, y)
                    maxY = maxOf(maxY, y)
                }
            }
            val scale = maxOf(maxX - minX, maxY - minY)
            if (scale > 1e-6f) {
                for (point in 0 until 21) {
                    val i = offset + point * 3
                    out[i] /= scale
                    out[i + 1] /= scale
                }
            }
        }
        require(out.all { it.isFinite() }) { "Normalization produced non-finite coordinates" }
        return out
    }
}
