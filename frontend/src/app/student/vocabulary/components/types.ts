export type WordListItem = {
  id: number
  dtype: string
  baseForm: string
  cefrLevel: string
  phonetic?: string | null
  meaning?: string | null
  meaningEn?: string | null
  example?: string | null
  exampleDe?: string | null
  exampleEn?: string | null
  usageNote?: string | null
  gender?: 'DER' | 'DIE' | 'DAS' | null
  article?: 'der' | 'die' | 'das' | null
  genderColor?: string | null
  tags?: string[] | null
  nounDetails?: {
    pluralForm?: string | null
    genitiveForm?: string | null
    nounType?: string | null
    declensions?: Array<{ kasus: string; numerus: string; form: string }> | null
  } | null
  verbDetails?: {
    auxiliaryVerb?: string | null
    partizip2?: string | null
    isSeparable?: boolean | null
    prefix?: string | null
    isIrregular?: boolean | null
    conjugations?: Array<{ tense: string; pronoun: string; form: string }> | null
  } | null
  adjectiveDetails?: {
    comparative?: string | null
    superlative?: string | null
    isIrregular?: boolean | null
  } | null
}

export type WordListResponse = {
  items: WordListItem[]
  page: number
  size: number
  total: number
}

export type TagItem = {
  id: number
  name: string
  color?: string | null
  localizedLabel?: string | null
}

export type Me = {
  displayName: string
  locale: string
  role: string
}

export type ArticleLower = 'der' | 'die' | 'das'
export type GenderCode = 'DER' | 'DIE' | 'DAS'

export type VocabCardItem = {
  id: number
  dtype: string
  word: string
  article: ArticleLower
  gender: GenderCode
  meaning: string
  english: string
  phonetic: string
  usageNote: string
  category: string
  level: string
  tags: string[]
  exampleDE: string
  exampleTranslation: string
  nounDetails?: WordListItem['nounDetails']
  verbDetails?: WordListItem['verbDetails']
  adjectiveDetails?: WordListItem['adjectiveDetails']
}

export const CATEGORY_OPTIONS = ['Alle', 'IT', 'Business', 'Alltag', 'Reisen', 'Grammatik'] as const
export type CategoryOption = typeof CATEGORY_OPTIONS[number]

export const GENDER_STYLE: Record<GenderCode, { bg: string; text: string; border: string; dot: string }> = {
  DER: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' },
  DIE: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#F43F5E' },
  DAS: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#10B981' },
}

export const LEVEL_STYLE: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#F0FDF4', text: '#166534' },
  A2: { bg: '#EFF6FF', text: '#1D4ED8' },
  B1: { bg: '#FFF8E1', text: '#92400E' },
  B2: { bg: '#F5F3FF', text: '#4C1D95' },
  C1: { bg: '#F1F5F9', text: '#0F172A' },
  C2: { bg: '#EEF2FF', text: '#3730A3' },
}
