// Shared SRS grading scale used by the review queue and flashcard review.
// Quality is the SM-2-style 0-5 scale the backend accepts; it is mapped to the
// FSRS 1-4 rating server-side. Passing threshold: quality >= 3.

export interface QualityLevel {
  q: number
  emoji: string
  label: string
  color: string
  bg: string
}

export const QUALITY_LEVELS: QualityLevel[] = [
  { q: 0, emoji: '😰', label: 'Quên hẳn', color: '#EF4444', bg: '#FEE2E2' },
  { q: 2, emoji: '😕', label: 'Khó nhớ', color: '#F97316', bg: '#FED7AA' },
  { q: 3, emoji: '🙂', label: 'Nhớ ra', color: '#EAB308', bg: '#FEF9C3' },
  { q: 4, emoji: '😊', label: 'Dễ nhớ', color: '#22C55E', bg: '#DCFCE7' },
  { q: 5, emoji: '🌟', label: 'Quá dễ!', color: '#6366F1', bg: '#E0E7FF' },
]

/** A review counts as "passed" (remembered) when quality >= 3. */
export function isPassingQuality(quality: number): boolean {
  return quality >= 3
}
