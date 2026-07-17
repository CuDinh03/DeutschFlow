// Local matcher for the "first German sentence" wow moment (onboarding v1 §4).
//
// The learner repeats "Hallo, ich bin {firstName}!" after their mentor. We check
// the Whisper transcript LOCALLY (no LLM call — keeps the loop <3s): pass when
// it contains a hallo-like greeting plus either "ich bin" or the learner's name,
// with Levenshtein leniency because ASR mangles both German from beginners and
// Vietnamese given names. There is deliberately NO fail state upstream — callers
// map 'retry' to one encouraging retry, then celebrate regardless.

export type FirstSentenceVerdict = 'pass' | 'retry'

/** Lowercase, fold ß→ss, strip diacritics + punctuation, collapse whitespace. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Classic Levenshtein distance — inputs are short (words / one sentence). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

function hasTokenNear(tokens: string[], word: string, maxDistance: number): boolean {
  return tokens.some((t) => levenshtein(t, word) <= maxDistance)
}

export function evaluateFirstSentence(transcript: string, firstName: string): FirstSentenceVerdict {
  const norm = normalizeSpeech(transcript)
  if (norm.length < 3) return 'retry'
  const tokens = norm.split(' ')

  const hasGreeting = hasTokenNear(tokens, 'hallo', 1)

  const name = normalizeSpeech(firstName)
  const nameLeniency = name.length >= 4 ? 2 : 1
  const hasName = name.length >= 2 && hasTokenNear(tokens, name, nameLeniency)
  const hasIchBin = / ?ich bin ?/.test(` ${norm} `)

  if (hasGreeting && (hasIchBin || hasName)) return 'pass'

  // Whole-sentence fallback: close enough to the model sentence overall
  // (covers ASR splitting/merging words, e.g. "hallo isch bin").
  const model = normalizeSpeech(`hallo ich bin ${firstName}`)
  if (levenshtein(norm, model) <= Math.floor(model.length * 0.4)) return 'pass'

  return 'retry'
}
