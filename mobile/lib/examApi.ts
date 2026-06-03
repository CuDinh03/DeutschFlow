// Mock-exam shapes + mapping. Pure (no imports). Backend
// GET /api/mock-exams?cefrLevel=X returns raw snake_case rows.

export interface ExamVariant {
  id: number
  title: string
  cefrLevel: string
  totalQuestions: number
  timeLimitMinutes: number
  isRecommended?: boolean
}

export interface RawMockExam {
  id: number
  cefr_level: string
  title: string
  time_limit_minutes: number
  total_questions?: number
}

export function mapExam(e: RawMockExam): ExamVariant {
  return {
    id: e.id,
    title: e.title,
    cefrLevel: e.cefr_level,
    totalQuestions: e.total_questions ?? 0,
    timeLimitMinutes: e.time_limit_minutes,
  }
}

// ── Objective-reading attempt parsing ───────────────────────────────────────
// The full Goethe structure mixes reading, listening (audio), writing and
// speaking. The app supports the auto-scored objective LESEN items only —
// true/false and single-choice MCQ — and surfaces the rest as web-only.

export interface ExamObjItem {
  id: string
  question: string
  passage?: string
  options?: string[] // present = MCQ; absent = true/false (richtig/falsch)
}

export interface ExamObjGroup {
  title: string
  items: ExamObjItem[]
}

export interface ParsedExam {
  groups: ExamObjGroup[]
  skippedSections: string[]
}

const TF = new Set(['richtig', 'falsch'])

function asArray(teile: unknown): Record<string, unknown>[] {
  if (Array.isArray(teile)) return teile as Record<string, unknown>[]
  if (teile && typeof teile === 'object') return Object.values(teile as object) as Record<string, unknown>[]
  return []
}

/** Parse a mock-exam `sections_json` string into the renderable objective items. */
export function parseLesenItems(sectionsJson: string): ParsedExam {
  const groups: ExamObjGroup[] = []
  const skipped = new Set<string>()
  try {
    const root = JSON.parse(sectionsJson) as { sections?: Record<string, unknown>[] }
    for (const section of root.sections ?? []) {
      const name = String(section.name ?? '')
      if (name !== 'LESEN') {
        if (name) skipped.add(name)
        continue
      }
      for (const teil of asArray(section.teile)) {
        const type = String(teil.type ?? '')
        if (type.includes('AUDIO')) continue
        const teilPassage = typeof teil.text === 'string' ? teil.text : undefined
        const rawItems = Array.isArray(teil.items) ? (teil.items as Record<string, unknown>[]) : []
        const items: ExamObjItem[] = []
        for (const it of rawItems) {
          const id = it.id != null ? String(it.id) : null
          if (!id) continue
          const question = (it.question ?? it.prompt) as string | undefined
          if (!question) continue
          const options = Array.isArray(it.options) ? (it.options as string[]) : undefined
          const correct = typeof it.correct === 'string' ? it.correct.toLowerCase() : ''
          if (!options && !TF.has(correct)) continue // skip writing/match/free-text
          const passage = typeof it.text === 'string' ? it.text : teilPassage
          items.push({ id, question, passage, options })
        }
        if (items.length > 0) {
          groups.push({ title: String(teil.title ?? 'Đọc hiểu'), items })
        }
      }
    }
  } catch {
    // Malformed JSON → empty attempt; the screen shows an error state.
  }
  return { groups, skippedSections: [...skipped] }
}
