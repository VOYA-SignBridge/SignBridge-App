package com.nmnghi.VOYA_App

import org.junit.Assert.*
import org.junit.Test
class AlphabetPreprocessorTest {
    @Test fun appliesFeatureWiseMeanAndStandardDeviation() {
        val mean = FloatArray(63) { index -> index / 100f }
        val std = FloatArray(63) { index -> (index + 1) / 10f }
        val raw = FloatArray(63) { index -> mean[index] + 2f * std[index] }
        assertArrayEquals(FloatArray(63) { 2f }, AlphabetPreprocessor.normalize(raw, mean, std), 1e-6f)
    }

    @Test fun rejectsMalformedInput() {
        val valid = FloatArray(63)
        val mean = FloatArray(63)
        val std = FloatArray(63) { 1f }
        assertThrows(IllegalArgumentException::class.java) {
            AlphabetPreprocessor.normalize(FloatArray(62), mean, std)
        }
        assertThrows(IllegalArgumentException::class.java) {
            AlphabetPreprocessor.normalize(FloatArray(63) { Float.NaN }, mean, std)
        }
        assertThrows(IllegalArgumentException::class.java) {
            AlphabetPreprocessor.normalize(valid, mean, FloatArray(63))
        }
    }
}
