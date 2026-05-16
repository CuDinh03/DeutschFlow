export type WordItem = {
  id: number; dtype: string; baseForm: string; cefrLevel: string
  phonetic?: string | null; meaning?: string | null; meaningEn?: string | null
  example?: string | null; exampleDe?: string | null; exampleEn?: string | null
  usageNote?: string | null; gender?: string | null; article?: string | null
  genderColor?: string | null; tags?: string[] | null
  nounDetails?: { pluralForm?: string | null; genitiveForm?: string | null } | null
}

export type WordListResponse = { items: WordItem[]; page: number; size: number; total: number }

export type TagItem = { id: number; name: string; color?: string | null; localizedLabel?: string | null }
