// Grammar syllabus topic shapes + mapping. Pure (no imports). Backend
// GET /api/grammar/syllabus/topics returns raw snake_case rows.

export interface GrammarTopic {
  id: string
  title: string
  cefrLevel: string
  category: string
  summary: string
  isCompleted?: boolean
}

export interface RawGrammarTopic {
  id: number
  cefr_level: string
  topic_code: string
  title_de: string
  title_vi: string
  description_vi: string | null
  mastery_percent: number
}

export function mapGrammarTopic(t: RawGrammarTopic): GrammarTopic {
  return {
    id: String(t.id),
    title: t.title_vi || t.title_de,
    cefrLevel: t.cefr_level,
    category: t.topic_code,
    summary: t.description_vi ?? '',
    isCompleted: (t.mastery_percent ?? 0) >= 100,
  }
}
