// ── Dữ liệu từ dataset nhóm (labels.xlsx) ──────────────────────────────
const DIALECT_VOCAB = {
  'hoa-de': [
    'rang muối', 'tôm', 'lột da cá', 'lột vỏ tôm',
    'lấy chỉ tôm', 'cắt kỳ', 'đánh vẩy cá', 'cắt đầu cá'
  ],
  'can-tho': [
    'nhân viên', 'máy khoan', 'khoan', 'đồ đạc',
    'cà phê', 'chào cờ', 'phục vụ', 'vào lớp'
  ],
  'spa': [
    'nặn mụn', 'úp móng'
  ],
  'trung': [
    'Miến Điện'
  ],
  'bang-chu-cai': [
    'A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'K', 'L',
    'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V',
    'X', 'Y', 'Z'
  ]
}

// ── Dialect labels thân thiện để hiển thị UI ───────────────────────────
export const DIALECT_LABELS = {
  'hoa-de': 'Nghề cá / Hòa Đê',
  'can-tho': 'Cần Thơ phổ thông',
  'spa': 'Nghề spa',
  'trung': 'Địa danh',
  'bang-chu-cai': 'Bảng chữ cái'
}

// ── Hàm chính: build system prompt ─────────────────────────────────────
export function buildSystemPrompt(options = {}) {
  const {
    dialect = null,       // dialect của người dùng (từ dataset)
    userDictionary = {},  // từ điển cá nhân do người hỗ trợ thêm
    speakerPronoun = 'tôi',
    listenerPronoun = 'bạn',
    addSubject = true,
  } = options

  // Phần từ vựng chuyên ngành theo dialect
  const dialectWords = dialect ? (DIALECT_VOCAB[dialect] || []) : []
  const dialectSection = dialectWords.length > 0
    ? `\nNgười dùng thuộc nhóm "${DIALECT_LABELS[dialect] || dialect}".` +
    `\nCác từ chuyên ngành hay gặp: ${dialectWords.join(', ')}.`
    : ''

  // Phần từ điển cá nhân
  const dictEntries = Object.entries(userDictionary)
  const dictSection = dictEntries.length > 0
    ? `\nTừ điển riêng của người dùng:\n${dictEntries.map(([k, v]) => `- "${k}" nghĩa là "${v}"`).join('\n')
    }\nƯu tiên dùng từ điển này khi phù hợp. Nếu có tên riêng, hãy dùng tên riêng thay vì từ chung.`
    : ''

  const subjectSection = addSubject
    ? `Cách xưng hô do người dùng chọn:
  - Người đang ký tự xưng là "${speakerPronoun}".
  - Gọi người nghe là "${listenerPronoun}".
  Khi câu nói về người đang ký và thiếu chủ ngữ, được thêm "${speakerPronoun}".
  Khi là câu hỏi hoặc yêu cầu hướng tới người nghe và thiếu chủ ngữ, được thêm "${listenerPronoun}".`
    : `Người dùng chọn không tự động thêm chủ ngữ. Không thêm đại từ nếu input không có chủ ngữ.`

  const subjectExamples = addSubject
    ? `- ["đi", "chợ", "mua", "cá"] với người đang ký là "${speakerPronoun}" → ${capitalize(speakerPronoun)} đi chợ mua cá.
  - ["cà phê", "uống", "không"] với người nghe là "${listenerPronoun}" → ${capitalize(listenerPronoun)} có uống cà phê không?`
    : `- ["đi", "chợ", "mua", "cá"] → Đi chợ mua cá.`

  return `Bạn là biên dịch viên chuyển các đơn vị ý nghĩa từ ngôn ngữ ký hiệu thành đúng một câu tiếng Việt tự nhiên.
  Input là danh sách từ/cụm từ mang ý nghĩa, không phải thứ tự từ bắt buộc.

  Quy tắc:
  1. Bảo toàn đầy đủ ý nghĩa của mọi từ/cụm từ trong input, nhưng được sắp xếp lại trật tự.
  2. Được thêm từ ngữ pháp tối thiểu như có, đã, đang, sẽ, bị, được, một, các và dấu câu để câu tự nhiên.
  3. Nếu input đã có chủ ngữ hoặc một danh từ rõ ràng làm chủ thể, phải ưu tiên chủ ngữ đó và không thay bằng đại từ mặc định.
  4. Không thêm người, đồ vật, hành động, địa điểm, thời gian hoặc sự kiện không có trong input.
  5. Không giải thích, không dùng lời mở đầu, không đặt câu trong dấu ngoặc kép. Chỉ trả về đúng một câu.

  ${subjectSection}

  Ví dụ:
  - ["cơm", "tôi", "ăn"] → Tôi ăn cơm.
  - ["máy khoan", "hỏng"] → Máy khoan bị hỏng.
  ${subjectExamples}
  ${dialectSection}${dictSection}`
}

// ── Build user message ──────────────────────────────────────────────────
export function buildUserMessage(tokens, options = {}) {
  const input = `Các từ nhận diện được: ${JSON.stringify(tokens)}`
  if (!options.previousSentence) return input

  if (options.needsNaturalRewrite) {
    return `${input}
Câu trước chỉ lặp lại nguyên thứ tự ký hiệu: ${JSON.stringify(options.previousSentence)}.
Đây không phải câu tiếng Việt tự nhiên. Bắt buộc xác định chủ ngữ, vị ngữ và bổ ngữ; sắp xếp lại theo ngữ pháp tiếng Việt.
Ví dụ: ["tôi", "cơm", "ăn"] phải viết thành "Tôi ăn cơm.", không được trả về "tôi cơm ăn".`
  }

  return `${input}
Câu trước chưa bảo toàn các ý: ${JSON.stringify(options.missingTokens || [])}.
Câu trước: ${JSON.stringify(options.previousSentence)}.
Hãy sửa lại thành đúng một câu tự nhiên, có đủ các ý còn thiếu và không thêm thông tin mới.`
}

function capitalize(value) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
