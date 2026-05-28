import api from '@/lib/api'

// ─── Backend DTO (mirrors WordDto.java) ──────────────────────────────────────

export interface WordDto {
  id: number
  word: string
  translation: string
  wordType?: string | null
  gender?: string | null
  cefrLevel?: string | null
  pronunciationIpa?: string | null
  exampleSentence?: string | null
  frequencyRank?: number | null
  imageUrl?: string | null
  audioUrl?: string | null
}

// ─── Component-facing shape ──────────────────────────────────────────────────

export interface A1Word {
  id: number
  word: string
  translation: string
  audioUrl: string
  pronunciation_ipa: string
  example_sentence: string
  article?: string
  image_url?: string
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

const GENDER_TO_ARTICLE: Record<string, string> = {
  DER: 'der',
  DIE: 'die',
  DAS: 'das',
}

function mapToA1Word(dto: WordDto): A1Word {
  return {
    id: dto.id,
    word: dto.word,
    translation: dto.translation ?? '',
    audioUrl: dto.audioUrl ?? '',
    pronunciation_ipa: dto.pronunciationIpa ?? '',
    example_sentence: dto.exampleSentence ?? '',
    article: dto.gender ? (GENDER_TO_ARTICLE[dto.gender.toUpperCase()] ?? undefined) : undefined,
    image_url: dto.imageUrl ?? undefined,
  }
}

// ─── API adapter ──────────────────────────────────────────────────────────────

export const vocabularyApi = {
  /** GET /api/vocabulary/words?cefrLevel=A1 */
  getA1Words: (): Promise<A1Word[]> =>
    api
      .get<WordDto[]>('/vocabulary/words', { params: { cefrLevel: 'A1' } })
      .then((r) => r.data.map(mapToA1Word)),

  /** GET /api/vocabulary/words?cefrLevel={level} */
  getWordsByCefr: (level: string): Promise<A1Word[]> =>
    api
      .get<WordDto[]>('/vocabulary/words', { params: { cefrLevel: level } })
      .then((r) => r.data.map(mapToA1Word)),

  /** GET /api/vocabulary/{wordId} */
  getWordById: (wordId: number): Promise<WordDto> =>
    api.get<WordDto>(`/vocabulary/${wordId}`).then((r) => r.data),
}
