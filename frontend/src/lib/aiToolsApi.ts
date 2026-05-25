import api from './api'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TranslateResponse {
  original: string
  translation: string
  direction: 'de-en' | 'en-de' | 'de-vi'
}

export interface GrammarCorrectResponse {
  original: string
  corrected: string
  explanation: string
}

export interface GrammarExplainResponse {
  text: string
  explanation: string
}

// ─────────────────────────────────────────────
// API adapter for Quick AI Tools
// ─────────────────────────────────────────────

export const aiToolsApi = {
  /** POST /api/ai/translate/to-english — translate German → English */
  translateToEnglish: (text: string) =>
    api.post<TranslateResponse>('/ai/translate/to-english', { text })
      .then(r => r.data),

  /** POST /api/ai/translate/to-german — translate English → German */
  translateToGerman: (text: string) =>
    api.post<TranslateResponse>('/ai/translate/to-german', { text })
      .then(r => r.data),

  /** POST /api/ai/grammar/correct — check and correct German grammar */
  grammarCorrect: (text: string) =>
    api.post<GrammarCorrectResponse>('/ai/grammar/correct', { text })
      .then(r => r.data),

  /** POST /api/ai/grammar/explain — explain a grammar rule */
  grammarExplain: (text: string) =>
    api.post<GrammarExplainResponse>('/ai/grammar/explain', { text })
      .then(r => r.data),
}
