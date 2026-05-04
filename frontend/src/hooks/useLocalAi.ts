/**
 * Hooks for DeutschFlow AI (`deutschflow_model`) REST helpers under `/api/...`.
 */
import { useState, useCallback } from 'react'
import { localAiApi, type SpeakingFeedback, type PracticeScenario, type GrammarCorrectionResult } from '@/lib/localAiApi'

// ─── Grammar hooks ────────────────────────────────────────────────────────────

export function useGrammarCorrection() {
  const [result, setResult] = useState<GrammarCorrectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const correct = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.correctGrammar(text)
      setResult(data)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Grammar correction failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, error, correct }
}

export function useGrammarExplanation() {
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const explain = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.explainGrammar(text)
      setExplanation(data.explanation)
      return data.explanation
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Grammar explanation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { explanation, loading, error, explain }
}

// ─── Vocabulary hooks ─────────────────────────────────────────────────────────

export function useWordExamples() {
  const [examples, setExamples] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (word: string, count = 3) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.generateExamples(word, count)
      setExamples(data.examples)
      return data.examples
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Example generation failed'
      setError(msg)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return { examples, loading, error, generate }
}

export function useWordMnemonic() {
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (word: string, meaning: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.generateMnemonic(word, meaning)
      setMnemonic(data.mnemonic)
      return data.mnemonic
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mnemonic generation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { mnemonic, loading, error, generate }
}

export function useVocabularyStory() {
  const [story, setStory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (words: string[]) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.generateStory(words)
      setStory(data.story)
      return data.story
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Story generation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { story, loading, error, generate }
}

// ─── Speaking hooks ───────────────────────────────────────────────────────────

export function useSpeakingFeedback() {
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getFeedback = useCallback(async (text: string, topic = '') => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.speakingFeedback(text, topic)
      setFeedback(data)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Feedback generation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { feedback, loading, error, getFeedback }
}

export function usePracticeScenario() {
  const [scenario, setScenario] = useState<PracticeScenario | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async (topic: string, level = 'A2') => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.generateScenario(topic, level)
      setScenario(data)
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Scenario generation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { scenario, loading, error, generate }
}

export function useConversation() {
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const respond = useCallback(async (message: string, level = 'A2', context = '') => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.conversationRespond(message, level, context)
      setResponse(data.aiResponse)
      return data.aiResponse
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Conversation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { response, loading, error, respond }
}

// ─── Translation hook ─────────────────────────────────────────────────────────

export function useTranslation() {
  const [translation, setTranslation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toEnglish = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.translateToEnglish(text)
      setTranslation(data.translation)
      return data.translation
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Translation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const toGerman = useCallback(async (text: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await localAiApi.translateToGerman(text)
      setTranslation(data.translation)
      return data.translation
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Translation failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { translation, loading, error, toEnglish, toGerman }
}
