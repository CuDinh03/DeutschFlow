import api from './api'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface VocabExamplesResponse {
  word: string
  examples: string[]
}

export interface VocabUsageResponse {
  word: string
  usage: string
}

export interface VocabMnemonicResponse {
  word: string
  mnemonic: string
}

export interface VocabSimilarResponse {
  word: string
  similarWords: string[]
}

export interface VocabStoryResponse {
  words: string[]
  story: string
}

export interface VocabEtymologyResponse {
  word: string
  etymology: string
}

export interface QuizQuestion {
  word: string
  content: string
}

export interface VocabQuizResponse {
  words: string[]
  questions: QuizQuestion[]
}

// ─────────────────────────────────────────────
// API adapter — all 7 AI vocabulary endpoints
// ─────────────────────────────────────────────

/**
 * Thin API adapter for POST /api/vocabulary/ai/*
 * All endpoints are cached server-side (Caffeine, 1-24h) so
 * repeated calls for the same word are essentially free.
 */
export const vocabAiApi = {
  /** Generate example sentences (cached 24h on server) */
  examples: (word: string, count = 3) =>
    api.post<VocabExamplesResponse>('/vocabulary/ai/examples', { word, count })
      .then(r => r.data),

  /** Explain usage and context (cached 24h on server) */
  usage: (word: string) =>
    api.post<VocabUsageResponse>('/vocabulary/ai/usage', { word })
      .then(r => r.data),

  /** Generate mnemonic device (cached 24h on server) */
  mnemonic: (word: string, meaning = '') =>
    api.post<VocabMnemonicResponse>('/vocabulary/ai/mnemonic', { word, meaning })
      .then(r => r.data),

  /** Find similar/related words (cached 24h on server) */
  similar: (word: string) =>
    api.post<VocabSimilarResponse>('/vocabulary/ai/similar', { word })
      .then(r => r.data),

  /** Generate a story using multiple words (cached 6h on server) */
  story: (words: string[]) =>
    api.post<VocabStoryResponse>('/vocabulary/ai/story', { words })
      .then(r => r.data),

  /** Explain etymology (cached 24h on server) */
  etymology: (word: string) =>
    api.post<VocabEtymologyResponse>('/vocabulary/ai/etymology', { word })
      .then(r => r.data),

  /** Generate quiz questions (cached 1h on server) */
  quiz: (words: string[], questionsPerWord = 2) =>
    api.post<VocabQuizResponse>('/vocabulary/ai/quiz', { words, questionsPerWord })
      .then(r => r.data),
}
