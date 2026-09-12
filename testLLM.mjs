import 'dotenv/config'
import { MODELS } from './src/llm/modelConfig.js'
import { buildSystemPrompt, buildUserMessage } from './src/llm/promptBuilder.js'

const ACTIVE_MODEL = MODELS.qwen_7b  // ← đổi dòng này để test model khác

const GROQ_API_KEY   = process.env.EXPO_PUBLIC_GROQ_API_KEY
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY
const OLLAMA_URL     = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

// ── Test cases ────────────────────────────────────────────────────────
const TEST_CASES = [
  {
    name: 'Đảo trật tự khi đã có chủ ngữ',
    tokens: ['cơm', 'tôi', 'ăn'],
    expectedWords: ['tôi', 'ăn', 'cơm'],
    expectedOrder: ['tôi', 'ăn', 'cơm'],
  },
  {
    name: 'Thêm chủ ngữ người đang ký',
    tokens: ['đi', 'chợ', 'mua', 'cá'],
    speakerPronoun: 'tớ',
    listenerPronoun: 'cậu',
    expectedWords: ['tớ', 'đi', 'chợ', 'mua', 'cá'],
    expectedOrder: ['tớ', 'đi', 'chợ', 'mua', 'cá'],
  },
  {
    name: 'Dùng người nghe trong câu hỏi',
    tokens: ['cà phê', 'uống', 'không'],
    speakerPronoun: 'tớ',
    listenerPronoun: 'cậu',
    expectedWords: ['cậu', 'cà phê', 'uống', 'không'],
    expectedOrder: ['cậu', 'uống', 'cà phê', 'không'],
  },
  {
    name: 'Ưu tiên danh từ làm chủ thể',
    tokens: ['máy khoan', 'hỏng'],
    expectedWords: ['máy khoan', 'hỏng'],
    forbiddenWords: ['tôi', 'bạn'],
  },
  {
    name: 'Không tự thêm chủ ngữ',
    tokens: ['đi', 'chợ', 'mua', 'cá'],
    addSubject: false,
    expectedWords: ['đi', 'chợ', 'mua', 'cá'],
    forbiddenWords: ['tôi', 'bạn'],
  },
  {
    name: 'Đảo trật tự khi đã có chủ ngữ',
    tokens: ['tôi', 'cơm', 'ăn'],
    expectedWords: ['tôi', 'ăn', 'cơm'],
    expectedOrder: ['tôi', 'ăn', 'cơm'],
  },
  {
    name: 'Đảo trật tự khi đã có chủ ngữ',
    tokens: [],
    expectedWords: [],
    expectedOrder: [],
  },
]

const normalize = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()

function evaluateOutput(output, testCase) {
  const normalized = normalize(output)
  const missing = (testCase.expectedWords || []).filter((word) => !normalized.includes(normalize(word)))
  const forbidden = (testCase.forbiddenWords || []).filter((word) => normalized.includes(normalize(word)))
  let previousIndex = -1
  const wrongOrder = (testCase.expectedOrder || []).some((word) => {
    const index = normalized.indexOf(normalize(word), previousIndex + 1)
    if (index < 0) return true
    previousIndex = index
    return false
  })
  return {
    passed: missing.length === 0 && forbidden.length === 0 && !wrongOrder,
    missing,
    forbidden,
    wrongOrder,
  }
}

// ── Callers ───────────────────────────────────────────────────────────
async function callGroq(tokens, options, modelId) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: modelId, max_tokens: 100, temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt(options) },
        { role: 'user',   content: buildUserMessage(tokens, options) }
      ]
    })
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Groq HTTP ${res.status}: ${e.error?.message || ''}`) }
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

async function callGemini(tokens, options, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildSystemPrompt(options) }] },
      contents: [{ role: 'user', parts: [{ text: buildUserMessage(tokens, options) }] }],
      generationConfig: { maxOutputTokens: 100, temperature: 0.3 }
    })
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Gemini HTTP ${res.status}: ${JSON.stringify(e)}`) }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text.trim()
}

async function callOllama(tokens, options, modelId) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 60000)  // 10s cho model local
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        system: buildSystemPrompt(options),
        prompt: buildUserMessage(tokens, options),
        stream: false,
        options: { temperature: 0.3, num_predict: 80 }
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.response.trim()
  } finally { clearTimeout(t) }
}

// ── Router ────────────────────────────────────────────────────────────
async function callModel(tokens, options) {
  const { provider, id: modelId } = ACTIVE_MODEL
  switch (provider) {
    case 'groq':   return callGroq(tokens, options, modelId)
    case 'gemini': return callGemini(tokens, options, modelId)
    case 'ollama': return callOllama(tokens, options, modelId)
    default: throw new Error(`Provider không hỗ trợ: ${provider}`)
  }
}

// ── Run all ───────────────────────────────────────────────────────────
async function runAll() {
  console.log(`Test ${ACTIVE_MODEL.label} (${ACTIVE_MODEL.provider}) — ${ACTIVE_MODEL.id}\n`)
  if (ACTIVE_MODEL.provider === 'ollama') {
    console.log(`Ollama URL: ${OLLAMA_URL}\n`)
  }

  let passed = 0, failed = 0, totalMs = 0

  for (const tc of TEST_CASES) {
    const options = {
      dialect: tc.dialect || null,
      userDictionary: tc.userDictionary || {},
      speakerPronoun: tc.speakerPronoun || 'tôi',
      listenerPronoun: tc.listenerPronoun || 'bạn',
      addSubject: tc.addSubject !== false,
    }
    try {
      const start  = Date.now()
      const result = await callModel(tc.tokens, options)
      const ms     = Date.now() - start
      totalMs += ms
      const evaluation = evaluateOutput(result, tc)
      if (evaluation.passed) passed++
      else failed++
      console.log('Test   :', tc.name)
      console.log('Input  :', tc.tokens)
      if (tc.dialect)                                 console.log('Dialect:', tc.dialect)
      if (Object.keys(options.userDictionary).length) console.log('Dict   :', options.userDictionary)
      console.log(`Output : ${result}  ⏱ ${ms}ms`)
      console.log(evaluation.passed ? '✅ Đạt' : `❌ Chưa đạt — thiếu: [${evaluation.missing.join(', ')}], thừa: [${evaluation.forbidden.join(', ')}], sai thứ tự: ${evaluation.wrongOrder}`)
    } catch (err) {
      failed++
      console.log('Input  :', tc.tokens)
      console.log('❌ Lỗi :', err.message)
    }
    console.log('─'.repeat(40))
  }

  console.log(`Kết quả: ${passed}/${TEST_CASES.length} đạt, ${failed} chưa đạt, tổng ${totalMs}ms`)
  if (failed > 0) process.exitCode = 1
}

runAll().catch(console.error)
