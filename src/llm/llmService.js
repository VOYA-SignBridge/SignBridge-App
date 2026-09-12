import { buildSystemPrompt, buildUserMessage } from './promptBuilder.js'
import { ACTIVE_MODEL } from './modelConfig.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY
const LLM_PROVIDER = process.env.EXPO_PUBLIC_LLM_PROVIDER || ACTIVE_MODEL.provider
const GROQ_MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL || 'llama-3.1-8b-instant'
const OLLAMA_BASE_URL = process.env.EXPO_PUBLIC_OLLAMA_BASE_URL?.replace(/\/$/, '')
const OLLAMA_MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL || ACTIVE_MODEL.id
const OLLAMA_TIMEOUT_MS = 30000

// Thêm dialect vào signature
export async function buildSentence(tokens, options = {}) {
  // options = { dialect, userDictionary }
  if (!tokens || tokens.length === 0) return ''

  const cleanTokens = tokens.map((token) => String(token).trim()).filter(Boolean)
  if (cleanTokens.length === 0) return ''

  const firstSentence = cleanSentence(await callProvider(cleanTokens, options))
  const firstMissing = findMissingTokens(firstSentence, cleanTokens)
  if (isAcceptableSentence(firstSentence, cleanTokens, firstMissing)) return firstSentence

  // Ask once for a focused correction. Invalid output is surfaced as an error.
  const retryOptions = {
    ...options,
    previousSentence: firstSentence,
    missingTokens: firstMissing,
    needsNaturalRewrite: isBareGlossEcho(firstSentence, cleanTokens),
  }
  const correctedSentence = cleanSentence(await callProvider(cleanTokens, retryOptions))
  const correctedMissing = findMissingTokens(correctedSentence, cleanTokens)
  if (isAcceptableSentence(correctedSentence, cleanTokens, correctedMissing)) {
    return correctedSentence
  }

  throw new Error('LLM could not produce an acceptable Vietnamese sentence')
}

async function callProvider(tokens, options) {
  if (LLM_PROVIDER === 'ollama') return callOllama(tokens, options)
  if (LLM_PROVIDER === 'groq') return callGroq(tokens, options)
  throw new Error(`Unsupported LLM provider: ${LLM_PROVIDER}`)
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
}

function normalizeWords(value) {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function findMissingTokens(sentence, tokens) {
  const normalizedSentence = normalize(sentence)
  const sentenceWords = new Set(normalizeWords(sentence))

  return tokens.filter((token) => {
    const normalizedToken = normalize(token)
    if (normalizedSentence.includes(normalizedToken)) return false

    const tokenWords = normalizeWords(token)
    return tokenWords.length === 0 || !tokenWords.every((word) => sentenceWords.has(word))
  })
}

function isAcceptableSentence(sentence, tokens, missingTokens) {
  if (!sentence || missingTokens.length > 0) return false
  if (isBareGlossEcho(sentence, tokens)) return false
  const inputWordCount = tokens.flatMap(normalizeWords).length
  const outputWordCount = normalizeWords(sentence).length
  return outputWordCount <= inputWordCount + 10
}

function isBareGlossEcho(sentence, tokens) {
  if (tokens.length < 2) return false
  const sentenceWords = normalizeWords(sentence)
  const glossWords = tokens.flatMap(normalizeWords)
  return sentenceWords.join(' ') === glossWords.join(' ')
}

function cleanSentence(value) {
  return String(value ?? '')
    .trim()
    .replace(/^(?:câu hoàn chỉnh|kết quả|output)\s*:\s*/i, '')
    .replace(/^["“]|["”]$/g, '')
    .trim()
}

async function callGroq(tokens, options) {
  if (!GROQ_API_KEY) {
    throw new Error('EXPO_PUBLIC_GROQ_API_KEY is not configured')
  }

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 100,
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt(options) },
        { role: 'user',   content: buildUserMessage(tokens, options) }
      ]
    })
  })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

async function callOllama(tokens, options) {
  if (!OLLAMA_BASE_URL) {
    throw new Error('EXPO_PUBLIC_OLLAMA_BASE_URL is not configured')
  }

  const controller = new AbortController()
  // A local model can need several seconds to load on the first request.
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system: buildSystemPrompt(options),
        prompt: buildUserMessage(tokens, options),
        stream: false,
        options: { temperature: 0.1, num_predict: 60 }
      })
    })
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
    const data = await res.json()
    return data.response.trim()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Ollama request timed out')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
