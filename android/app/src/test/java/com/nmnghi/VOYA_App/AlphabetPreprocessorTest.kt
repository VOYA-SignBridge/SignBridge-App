package com.nmnghi.VOYA_App

import org.junit.Assert.*
import org.junit.Test
import com.google.gson.JsonParser

class AlphabetPreprocessorTest {
    @Test fun matchesPythonServerNormalization() {
        val text = javaClass.getResource("/alphabet-normalization.json")!!.readText()
        val cases = JsonParser.parseString(text).asJsonObject.getAsJsonArray("cases")
        for (case in cases) {
            val obj = case.asJsonObject
            val raw = obj.getAsJsonArray("raw").map { it.asFloat }.toFloatArray()
            val expected = obj.getAsJsonArray("normalized").map { it.asFloat }.toFloatArray()
            assertArrayEquals(expected, AlphabetPreprocessor.normalizeFrame(raw), 1e-6f)
        }
    }

    @Test fun rejectsMalformedInput() {
        for (invalid in listOf(FloatArray(125), FloatArray(126) { Float.NaN }, FloatArray(126) { Float.POSITIVE_INFINITY })) {
            assertThrows(IllegalArgumentException::class.java) { AlphabetPreprocessor.normalizeFrame(invalid) }
        }
    }
}
