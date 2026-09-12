// src/services/llm/modelConfig.js

export const MODELS = {
  // ── Groq (test local) ──────────────────────
  groq_llama_8b: {
    provider: 'groq',
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1-8B'
  },
  groq_llama_70b: {
    provider: 'groq',
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3-70B'
  },

  // ── Google (test local) ────────────────────
  gemini_flash: {
    provider: 'gemini',
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash'
  },
  gemini_2_flash: {
    provider: 'gemini',
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash'
  },

  // ── Ollama (server trường) ─────────────────
  qwen_7b: {
    provider: 'ollama',
    id: 'qwen2.5:7b-instruct',
    label: 'Qwen2.5-7B'
  },
  qwen_14b: {
    provider: 'ollama',
    id: 'qwen2.5:14b-instruct',
    label: 'Qwen2.5-14B'
  },
  vinallama: {
    provider: 'ollama',
    id: 'vinallama',
    label: 'Vinallama-7B'
  },
}

// Model đang dùng — đổi dòng này để switch
export const ACTIVE_MODEL = MODELS.qwen_7b