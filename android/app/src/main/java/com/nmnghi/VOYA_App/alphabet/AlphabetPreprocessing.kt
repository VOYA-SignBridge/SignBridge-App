package com.nmnghi.VOYA_App.alphabet

/** Raw MediaPipe Left/Right slots in, training serving tensor out. Alphabet only. */
object AlphabetPreprocessing {
    const val VERSION = "alphabet_hands126_v1"

    fun prepare(raw: FloatArray, swapHandedness: Boolean, mirrorX: Boolean): FloatArray {
        require(raw.size == 126 && raw.all { it.isFinite() }) { "Alphabet requires 126 finite raw coordinates" }
        val out = FloatArray(126)
        for (targetHand in 0..1) {
            val sourceOffset = (if (swapHandedness) 1 - targetHand else targetHand) * 63
            val targetOffset = targetHand * 63
            var handPresent = false
            for (j in 0 until 63) handPresent = handPresent || raw[sourceOffset + j] != 0f
            if (!handPresent) continue
            val wristX = if (mirrorX) 1f - raw[sourceOffset] else raw[sourceOffset]
            val wristY = raw[sourceOffset + 1]
            val xs = FloatArray(21)
            val ys = FloatArray(21)
            var minX = Float.POSITIVE_INFINITY
            var maxX = Float.NEGATIVE_INFINITY
            var minY = Float.POSITIVE_INFINITY
            var maxY = Float.NEGATIVE_INFINITY
            var hasScale = false
            for (j in 0..20) {
                val p = sourceOffset + j * 3
                val x = (if (mirrorX) 1f - raw[p] else raw[p]) - wristX
                val y = raw[p + 1] - wristY
                xs[j] = x
                ys[j] = y
                if (x * x + y * y > 1e-12f) {
                    minX = minOf(minX, x)
                    maxX = maxOf(maxX, x)
                    minY = minOf(minY, y)
                    maxY = maxOf(maxY, y)
                    hasScale = true
                }
            }
            val span = if (hasScale) maxOf(maxX - minX, maxY - minY) else 1f
            val scale = if (span > 1e-6f) span else 1f
            for (j in 0..20) {
                val p = targetOffset + j * 3
                out[p] = xs[j] / scale
                out[p + 1] = ys[j] / scale
                out[p + 2] = raw[sourceOffset + j * 3 + 2]
            }
        }
        require(out.all { it.isFinite() }) { "Alphabet normalization overflow" }
        return out
    }
}
