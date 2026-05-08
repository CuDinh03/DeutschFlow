import { genderPalette, inferGenderFromGermanText } from '@/lib/constants'

export type WordItem = { id: string; word: string; color: string; shadow: string; text: string }
export type SessionType = 'GRAMMAR' | 'READING' | 'LISTENING' | 'GENERAL'
export type AnswerType = 'ORDER_DRAG' | 'INDEX' | 'TEXT'
export type ExerciseItem = {
  id: string
  title: string
  question: string
  options: string[]
  format?: string | null
  correctOptionIndex?: number | null
  expectedAnswerNormalized?: string | null
  audioGerman?: string | null
}
export type GameQuestion = {
  id: string
  category: string
  level: string
  prompt: string
  answerType: AnswerType
  joiner: '|' | ' '
  answerCanonical: string
  correctOptionIndex?: number | null
  optionCanonicals?: string[]
  pool: WordItem[]
  audioGerman?: string | null
}

const COLORS = [
  { color: '#FFCD00', shadow: '#C9A200', text: '#1A1A1A' },
  { color: '#4A90E2', shadow: '#2C6BA8', text: '#FFFFFF' },
  { color: '#7C4DFF', shadow: '#5A2ED4', text: '#FFFFFF' },
  { color: '#FF7043', shadow: '#D94F2A', text: '#FFFFFF' },
  { color: '#00BCD4', shadow: '#008FA0', text: '#FFFFFF' },
  { color: '#4CAF50', shadow: '#2E8B32', text: '#FFFFFF' },
]

export const sessionVariants: Record<SessionType, { emoji: string; title: string; subtitle: string; poolLabel: string; hint: string }> = {
  GRAMMAR: {
    emoji: '🧠',
    title: 'Grammar Builder',
    subtitle: 'Kéo-thả để sắp xếp câu theo đúng ngữ pháp.',
    poolLabel: 'Grammar Blocks',
    hint: 'Tập trung vào vị trí động từ và trật tự chủ ngữ-bổ ngữ.',
  },
  READING: {
    emoji: '📖',
    title: 'Reading Builder',
    subtitle: 'Từ ngữ được chọn theo ngữ cảnh đọc hiểu của session.',
    poolLabel: 'Reading Tokens',
    hint: 'Dựa vào ý nghĩa đoạn đọc để chọn đúng từ then chốt.',
  },
  LISTENING: {
    emoji: '🎧',
    title: 'Listening Builder',
    subtitle: 'Nghe audio rồi kéo-thả thành câu đúng.',
    poolLabel: 'Listening Tokens',
    hint: 'Nghe lại audio và chú ý đuôi từ hoặc mạo từ.',
  },
  GENERAL: {
    emoji: '🧱',
    title: 'Lego Builder',
    subtitle: 'Kéo-thả để ghép câu chính xác.',
    poolLabel: 'Word Blocks',
    hint: 'Kéo-thả theo đúng thứ tự đáp án.',
  },
}

export function sessionMode(raw?: string | null): SessionType {
  const v = String(raw || '').trim().toUpperCase()
  if (v === 'GRAMMAR') return 'GRAMMAR'
  if (v === 'READING') return 'READING'
  if (v === 'LISTENING') return 'LISTENING'
  return 'GENERAL'
}

export function normalizeText(raw: string) {
  return String(raw)
    .toLowerCase()
    .replace(/[.,!?;:"'`()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizePipe(raw: string) {
  return String(raw)
    .split('|')
    .map((x) => normalizeText(x))
    .filter(Boolean)
    .join('|')
}

export function tokenizeForSlots(raw: string, mode: '|' | ' ') {
  if (mode === '|') {
    return String(raw)
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return String(raw)
    .replace(/[.,!?;:"'`()[\]{}]/g, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function dedupeWords(words: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    const key = normalizeText(w)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(w)
  }
  return out
}

function poolItemsFor(exerciseId: string, words: string[]) {
  return dedupeWords(words).map((word, i) => {
    const byGender = genderPalette(inferGenderFromGermanText(word))
    const fallback = COLORS[i % COLORS.length]!
    const c = inferGenderFromGermanText(word)
      ? byGender
      : { color: fallback.color, shadow: fallback.shadow, text: fallback.text }
    return {
      id: `${exerciseId}-${i}`,
      word,
      color: c.color,
      shadow: c.shadow,
      text: c.text,
    }
  })
}

function toQuestionByFormat(ex: ExerciseItem): Omit<GameQuestion, 'level'> | null {
  const fmt = String(ex.format || 'MC').toUpperCase()
  if (fmt === 'ORDER_DRAG') {
    const canonical = normalizePipe(ex.expectedAnswerNormalized || '')
    const answerTokens = tokenizeForSlots(ex.expectedAnswerNormalized || '', '|')
    if (!canonical || answerTokens.length === 0) return null
    const poolSource = (ex.options ?? []).length > 0 ? ex.options : answerTokens
    return {
      id: ex.id,
      category: ex.title || 'Order Drag',
      prompt: ex.question,
      answerType: 'ORDER_DRAG',
      joiner: '|',
      answerCanonical: canonical,
      optionCanonicals: undefined,
      correctOptionIndex: null,
      pool: poolItemsFor(ex.id, poolSource),
      audioGerman: ex.audioGerman,
    }
  }

  if (fmt === 'ORDER_MC' || fmt === 'MC' || fmt === 'TRUE_FALSE') {
    const options = ex.options ?? []
    const correctIdx = ex.correctOptionIndex
    if (correctIdx == null || correctIdx < 0 || correctIdx >= options.length) return null

    const correctSentence = options[correctIdx] || ''
    const answerTokens = tokenizeForSlots(correctSentence, ' ')
    if (answerTokens.length === 0) return null
    const distractors = options
      .filter((_, idx) => idx !== correctIdx)
      .flatMap((o) => tokenizeForSlots(o, ' '))
      .slice(0, Math.max(4, answerTokens.length))
    const optionCanonicals = options.map((o) => normalizeText(o))
    return {
      id: ex.id,
      category: ex.title || fmt,
      prompt: ex.question,
      answerType: 'INDEX',
      joiner: ' ',
      answerCanonical: normalizeText(correctSentence),
      optionCanonicals,
      correctOptionIndex: correctIdx,
      pool: poolItemsFor(ex.id, [...answerTokens, ...distractors]),
      audioGerman: ex.audioGerman,
    }
  }

  if (fmt === 'TEXT' || fmt === 'SPEAK_REPEAT') {
    const expected = ex.expectedAnswerNormalized || ex.audioGerman || ''
    const canonical = normalizeText(expected)
    const answerTokens = tokenizeForSlots(expected, ' ')
    if (!canonical || answerTokens.length === 0) return null
    const questionHints = tokenizeForSlots(ex.question || '', ' ').slice(0, 4)
    return {
      id: ex.id,
      category: ex.title || fmt,
      prompt: ex.question,
      answerType: 'TEXT',
      joiner: ' ',
      answerCanonical: canonical,
      optionCanonicals: undefined,
      correctOptionIndex: null,
      pool: poolItemsFor(ex.id, [...answerTokens, ...questionHints]),
      audioGerman: ex.audioGerman,
    }
  }

  return null
}

function prioritizeFormatsBySessionType(type: SessionType) {
  if (type === 'GRAMMAR') return ['ORDER_DRAG', 'ORDER_MC', 'MC', 'TRUE_FALSE', 'TEXT', 'SPEAK_REPEAT']
  if (type === 'READING') return ['TEXT', 'MC', 'ORDER_DRAG', 'ORDER_MC', 'TRUE_FALSE', 'SPEAK_REPEAT']
  if (type === 'LISTENING') return ['SPEAK_REPEAT', 'TEXT', 'ORDER_DRAG', 'MC', 'ORDER_MC', 'TRUE_FALSE']
  return ['ORDER_DRAG', 'ORDER_MC', 'MC', 'TRUE_FALSE', 'TEXT', 'SPEAK_REPEAT']
}

export function buildQuestionsBySessionType(type: SessionType, exercises: ExerciseItem[]) {
  const priority = prioritizeFormatsBySessionType(type)
  const raw = exercises
    .map((ex, idx) => {
      const converted = toQuestionByFormat(ex)
      if (!converted) return null
      const fmt = String(ex.format || 'MC').toUpperCase()
      const rank = priority.indexOf(fmt)
      return { idx, rank: rank < 0 ? 999 : rank, q: converted }
    })
    .filter(Boolean) as Array<{ idx: number; rank: number; q: Omit<GameQuestion, 'level'> }>

  raw.sort((a, b) => (a.rank === b.rank ? a.idx - b.idx : a.rank - b.rank))
  return raw.map((row, i) => ({ ...row.q, level: `Q${i + 1}` }))
}

export function serializeAnswer(q: GameQuestion, slots: (string | null)[]) {
  if (q.answerType === 'ORDER_DRAG') {
    return slots.map((x) => String(x || '').trim()).join('|')
  }
  const sentence = slots.map((x) => String(x || '').trim()).join(' ').replace(/\s+/g, ' ').trim()
  if (q.answerType === 'TEXT') return sentence
  const normalized = normalizeText(sentence)
  const idx = (q.optionCanonicals ?? []).findIndex((x) => x === normalized)
  return idx
}

export function isCorrectLocal(q: GameQuestion, slots: (string | null)[]) {
  if (q.answerType === 'ORDER_DRAG') {
    return normalizePipe(serializeAnswer(q, slots) as string) === q.answerCanonical
  }
  if (q.answerType === 'INDEX') {
    return serializeAnswer(q, slots) === q.correctOptionIndex
  }
  return normalizeText(serializeAnswer(q, slots) as string) === q.answerCanonical
}

export type VocabGameFetchOptions = {
  /** UI / translation locale for word meanings (vi | en | de) */
  locale: string
  /** CEFR band for word query (A1–C2) */
  cefr: string
  count?: number
}

function normalizeCefr(raw: string | undefined | null): string {
  const u = String(raw || 'A1').trim().toUpperCase()
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(u)) return u
  return 'A1'
}

function normalizeUiLocale(raw: string | undefined | null): string {
  const s = String(raw || 'vi').trim().toLowerCase()
  return ['vi', 'en', 'de'].includes(s) ? s : 'vi'
}

function buildVocabOrderPrompt(meaning: string, baseForm: string, uiLocale: string): string {
  const m = String(meaning || '').trim()
  const b = String(baseForm || '').trim()
  if (uiLocale === 'vi') {
    return m ? `Sắp xếp câu tiếng Đức: "${m}"` : `Sắp xếp thành câu đúng với từ "${b}"`
  }
  if (uiLocale === 'de') {
    return m ? `Ordne den deutschen Satz: „${m}“` : `Ordne einen korrekten Satz mit „${b}“.`
  }
  return m ? `Arrange the German sentence: "${m}"` : `Put the German words in order (${b}).`
}

export function buildStandaloneQuestions(uiLocale = 'vi'): GameQuestion[] {
  const loc = normalizeUiLocale(uiLocale)
  const seeds: Array<{
    id: string
    canonical: string
    pool: string[]
    prompts: Record<string, string>
  }> = [
    {
      id: 'standalone-1',
      canonical: 'ich|lerne|jeden|tag|deutsch',
      pool: ['ich', 'lerne', 'jeden', 'tag', 'deutsch', 'heute', 'oft'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Tôi học tiếng Đức mỗi ngày.',
        en: 'Arrange: I learn German every day.',
        de: 'Bilde den Satz: Ich lerne jeden Tag Deutsch.',
      },
    },
    {
      id: 'standalone-2',
      canonical: 'sie|trinkt|am|morgen|kaffee',
      pool: ['sie', 'trinkt', 'am', 'morgen', 'kaffee', 'tee', 'heute'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Cô ấy uống cà phê vào buổi sáng.',
        en: 'Arrange: She drinks coffee in the morning.',
        de: 'Bilde den Satz: Sie trinkt am Morgen Kaffee.',
      },
    },
    {
      id: 'standalone-3',
      canonical: 'wir|fahren|mit|dem|bus|zur|schule',
      pool: ['wir', 'fahren', 'mit', 'dem', 'bus', 'zur', 'schule', 'bahn'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Chúng tôi đi đến trường bằng xe buýt.',
        en: 'Arrange: We take the bus to school.',
        de: 'Bilde den Satz: Wir fahren mit dem Bus zur Schule.',
      },
    },
    {
      id: 'standalone-4',
      canonical: 'er|liest|ein|interessantes|buch',
      pool: ['er', 'liest', 'ein', 'interessantes', 'buch', 'heft', 'gern'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Anh ấy đọc một cuốn sách thú vị.',
        en: 'Arrange: He reads an interesting book.',
        de: 'Bilde den Satz: Er liest ein interessantes Buch.',
      },
    },
    {
      id: 'standalone-5',
      canonical: 'das|wetter|ist|heute|sehr|schon',
      pool: ['das', 'wetter', 'ist', 'heute', 'sehr', 'schon', 'kalt'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Hôm nay thời tiết rất đẹp.',
        en: 'Arrange: The weather is very nice today.',
        de: 'Bilde den Satz: Das Wetter ist heute sehr schön.',
      },
    },
    {
      id: 'standalone-6',
      canonical: 'ich|möchte|einen|kaffee',
      pool: ['ich', 'möchte', 'einen', 'kaffee', 'tee', 'bitte', 'gern'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Tôi muốn một tách cà phê.',
        en: 'Arrange: I would like a coffee.',
        de: 'Bilde den Satz: Ich möchte einen Kaffee.',
      },
    },
    {
      id: 'standalone-7',
      canonical: 'das|geschäft|schließt|um|sechs|uhr',
      pool: ['das', 'geschäft', 'schließt', 'um', 'sechs', 'uhr', 'öffnet'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Cửa hàng đóng cửa lúc 6 giờ.',
        en: 'Arrange: The shop closes at six o’clock.',
        de: 'Bilde den Satz: Das Geschäft schließt um sechs Uhr.',
      },
    },
    {
      id: 'standalone-8',
      canonical: 'können|sie|mir|helfen',
      pool: ['können', 'sie', 'mir', 'helfen', 'bitte', 'auch', 'nicht'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Bạn có thể giúp tôi không?',
        en: 'Arrange: Can you help me, please?',
        de: 'Bilde den Satz: Können Sie mir helfen?',
      },
    },
    {
      id: 'standalone-9',
      canonical: 'ich|wohne|in|berlin',
      pool: ['ich', 'wohne', 'in', 'berlin', 'münchen', 'arbeite', 'lebe'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Tôi sống ở Berlin.',
        en: 'Arrange: I live in Berlin.',
        de: 'Bilde den Satz: Ich wohne in Berlin.',
      },
    },
    {
      id: 'standalone-10',
      canonical: 'er|fährt|mit|der|u-bahn|zur|arbeit',
      pool: ['er', 'fährt', 'mit', 'der', 'u-bahn', 'zur', 'arbeit', 'bus'],
      prompts: {
        vi: 'Sắp xếp thành câu đúng: Anh ấy đi làm bằng tàu điện ngầm.',
        en: 'Arrange: He takes the subway to work.',
        de: 'Bilde den Satz: Er fährt mit der U-Bahn zur Arbeit.',
      },
    },
  ]

  return seeds.map((row, i) => ({
    id: row.id,
    category: 'Standalone',
    level: `Q${i + 1}`,
    prompt: row.prompts[loc] || row.prompts.vi || row.prompts.en,
    answerType: 'ORDER_DRAG' as const,
    joiner: '|' as const,
    answerCanonical: normalizePipe(row.canonical),
    pool: poolItemsFor(row.id, row.pool),
    correctOptionIndex: null,
    optionCanonicals: undefined,
    audioGerman: null,
  }))
}

/**
 * Fetch câu hỏi game từ vocabulary DB thực.
 * Lấy các từ có ví dụ DE → câu hỏi sắp xếp — locale meanings + band CEFR theo học viên.
 */
export async function fetchVocabGameQuestions(
  apiGet: (path: string, params?: Record<string, string>) => Promise<any>,
  opts: VocabGameFetchOptions | number = 10
): Promise<GameQuestion[]> {
  const count = typeof opts === 'number' ? opts : (opts.count ?? 10)
  const uiLocale = typeof opts === 'number' ? 'vi' : normalizeUiLocale(opts.locale)
  const cefr = typeof opts === 'number' ? 'A1' : normalizeCefr(opts.cefr)

  try {
    const res = await apiGet('/words', {
      size: String(count * 3),
      locale: uiLocale,
      cefr,
    })
    const items: any[] = res?.items ?? []
    const questions: GameQuestion[] = []

    for (const item of items) {
      const exampleDe: string = item.exampleDe || item.example || ''
      if (!exampleDe || exampleDe.length < 10 || exampleDe.length > 80) continue

      const tokens = exampleDe
        .replace(/[.,!?;:"'`()[\]{}]/g, '')
        .split(/\s+/)
        .map((t: string) => t.trim())
        .filter(Boolean)
      if (tokens.length < 3 || tokens.length > 8) continue

      const canonical = tokens.map((t: string) => t.toLowerCase()).join('|')
      const distractors = ['nicht', 'auch', 'sehr', 'immer', 'noch', 'schon', 'jetzt']
        .filter((d) => !tokens.map((t: string) => t.toLowerCase()).includes(d))
        .slice(0, 3)

      const meaning = item.meaning || item.meaningEn || ''
      const prompt = buildVocabOrderPrompt(meaning, item.baseForm, uiLocale)

      questions.push({
        id: `vocab-${item.id}`,
        category: item.dtype || 'Vocabulary',
        level: item.cefrLevel || cefr,
        prompt,
        answerType: 'ORDER_DRAG',
        joiner: '|',
        answerCanonical: normalizePipe(canonical),
        pool: poolItemsFor(`vocab-${item.id}`, [...tokens, ...distractors]),
        correctOptionIndex: null,
        optionCanonicals: undefined,
        audioGerman: exampleDe,
      })

      if (questions.length >= count) break
    }

    return questions.length >= 3 ? questions : buildStandaloneQuestions(uiLocale)
  } catch {
    return buildStandaloneQuestions(uiLocale)
  }
}
