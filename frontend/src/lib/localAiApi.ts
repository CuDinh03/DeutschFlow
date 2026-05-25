/**
 * API client for DeutschFlow AI (fine-tuned `deutschflow_model` served via Spring → Python `/generate`).
 */
import api from './api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIGenerateRequest {
  instruction: string
  input?: string
  maxTokens?: number
  temperature?: number
}

export interface AIGenerateResponse {
  instruction: string
  input: string
  response: string
}

export interface AITranslateResponse {
  original: string
  translation: string
}

export interface GrammarCorrectionResult {
  originalText: string
  correctedText: string
  explanation: string
  hasErrors: boolean
}

export interface GrammarAnalysisResult {
  originalText: string
  correctedText: string
  explanation: string
  errorTypes: string
  severity: 'NONE' | 'MINOR' | 'MAJOR' | 'BLOCKING'
  hasErrors: boolean
}

export interface SpeakingFeedback {
  originalText: string
  correctedText: string
  pronunciationTips: string
  improvements: string
  fluencyScore: number
  hasErrors: boolean
}

export interface PracticeScenario {
  topic: string
  level: string
  scenarioDescription: string
  followUpQuestions: string
}

export interface AIHealthStatus {
  status: 'healthy' | 'unhealthy'
  model_loaded: boolean
  model_path: string
}

// ─── Local AI API ─────────────────────────────────────────────────────────────

export const localAiApi = {
  // Health
  health: () =>
    api.get<AIHealthStatus>('/ai/health'),

  // General generation
  generate: (request: AIGenerateRequest) =>
    api.post<AIGenerateResponse>('/ai/generate', request),

  // Translation
  translateToEnglish: (text: string) =>
    api.post<AITranslateResponse>('/ai/translate/to-english', { text }),

  translateToGerman: (text: string) =>
    api.post<AITranslateResponse>('/ai/translate/to-german', { text }),

  // Grammar
  correctGrammar: (text: string) =>
    api.post<GrammarCorrectionResult>('/grammar/ai/correct', { text }),

  explainGrammar: (text: string) =>
    api.post<{ text: string; explanation: string }>('/grammar/ai/explain', { text }),

  analyzeGrammar: (text: string) =>
    api.post<GrammarAnalysisResult>('/grammar/ai/analyze', { text }),

  practiceSuggestions: (errorType: string) =>
    api.post<{ errorType: string; suggestions: string }>('/grammar/ai/practice-suggestions', { errorType }),

  // Vocabulary
  generateExamples: (word: string, count = 3) =>
    api.post<{ word: string; examples: string[] }>('/vocabulary/ai/examples', { word, count }),

  explainUsage: (word: string) =>
    api.post<{ word: string; usage: string }>('/vocabulary/ai/usage', { word }),

  generateMnemonic: (word: string, meaning: string) =>
    api.post<{ word: string; mnemonic: string }>('/vocabulary/ai/mnemonic', { word, meaning }),

  findSimilarWords: (word: string) =>
    api.post<{ word: string; similarWords: string[] }>('/vocabulary/ai/similar', { word }),

  generateStory: (words: string[]) =>
    api.post<{ words: string[]; story: string }>('/vocabulary/ai/story', { words }),

  explainEtymology: (word: string) =>
    api.post<{ word: string; etymology: string }>('/vocabulary/ai/etymology', { word }),

  generateQuiz: (words: string[], questionsPerWord = 2) =>
    api.post<{ words: string[]; questions: Array<{ word: string; content: string }> }>(
      '/vocabulary/ai/quiz',
      { words, questionsPerWord }
    ),

  // Speaking
  conversationRespond: (message: string, level = 'A2', context = '') =>
    api.post<{ userMessage: string; aiResponse: string; level: string }>(
      '/speaking/ai/conversation',
      { message, level, context }
    ),

  speakingFeedback: (text: string, topic = '') =>
    api.post<SpeakingFeedback>('/speaking/ai/feedback', { text, topic }),

  generateScenario: (topic: string, level = 'A2') =>
    api.post<PracticeScenario>('/speaking/ai/scenario', { topic, level }),

  errorPractice: (errorType: string, exerciseCount = 3) =>
    api.post<{ errorType: string; exercises: string }>(
      '/speaking/ai/error-practice',
      { errorType, exerciseCount }
    ),

  culturalContext: (topic: string) =>
    api.post<{ topic: string; culturalContext: string }>('/speaking/ai/cultural-context', { topic }),

  generateRolePlay: (situation: string, userRole = 'customer', aiRole = 'shopkeeper') =>
    api.post<{ situation: string; rolePlay: string }>(
      '/speaking/ai/roleplay',
      { situation, userRole, aiRole }
    ),
}
