import type { CurriculumItem, CurriculumItemInput, CurriculumObjective, CurriculumObjectiveInput } from '@/lib/orgCurriculumApi'

/**
 * Soạn nhanh mục nội dung / mục tiêu bằng textarea: MỖI DÒNG một mục.
 * Tag tùy chọn ở cuối dòng:
 *   #HOEREN|#LESEN|#SCHREIBEN|#SPRECHEN  → kỹ năng
 *   #WORTSCHATZ|#GRAMMATIK|#AUSSPRACHE|#LANDESKUNDE|#REDEMITTEL|#STRATEGIE → loại nội dung (item)
 *   #A1..#C2 → cấp CEFR (objective)
 *   ~120     → phút dạy ước lượng (item)
 * Ví dụ: "Chào hỏi và tạm biệt #SPRECHEN #REDEMITTEL ~120"
 */

export const SKILL_TAGS = ['HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'] as const
export const CONTENT_TAGS = ['WORTSCHATZ', 'GRAMMATIK', 'AUSSPRACHE', 'LANDESKUNDE', 'REDEMITTEL', 'STRATEGIE'] as const
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

interface ParsedTokens {
  text: string
  skillTag: string | null
  contentTag: string | null
  cefrLevel: string | null
  minutes: number | null
}

function parseLine(raw: string): ParsedTokens | null {
  const words = raw.trim().split(/\s+/)
  if (words.length === 0 || raw.trim() === '') return null
  let skillTag: string | null = null
  let contentTag: string | null = null
  let cefrLevel: string | null = null
  let minutes: number | null = null
  const textWords: string[] = []
  for (const w of words) {
    if (w.startsWith('#')) {
      const tag = w.slice(1).toUpperCase()
      if ((SKILL_TAGS as readonly string[]).includes(tag)) { skillTag = tag; continue }
      if ((CONTENT_TAGS as readonly string[]).includes(tag)) { contentTag = tag; continue }
      if ((CEFR_LEVELS as readonly string[]).includes(tag)) { cefrLevel = tag; continue }
      // Tag lạ: giữ nguyên trong text để người soạn thấy mình gõ sai, không âm thầm nuốt.
      textWords.push(w)
      continue
    }
    if (w.startsWith('~')) {
      const n = Number(w.slice(1))
      if (Number.isInteger(n) && n > 0) { minutes = n; continue }
      textWords.push(w)
      continue
    }
    textWords.push(w)
  }
  const text = textWords.join(' ').trim()
  if (text === '') return null
  return { text, skillTag, contentTag, cefrLevel, minutes }
}

export function parseItemLines(input: string): CurriculumItemInput[] {
  return input
    .split('\n')
    .map(parseLine)
    .filter((p): p is ParsedTokens => p !== null)
    .map((p) => ({
      text: p.text,
      skillTag: p.skillTag,
      contentTag: p.contentTag,
      estimatedMinutes: p.minutes,
    }))
}

export function parseObjectiveLines(input: string): CurriculumObjectiveInput[] {
  return input
    .split('\n')
    .map(parseLine)
    .filter((p): p is ParsedTokens => p !== null)
    .map((p) => ({
      text: p.text,
      cefrLevel: p.cefrLevel,
      skillTag: p.skillTag,
    }))
}

export function serializeItems(items: CurriculumItem[]): string {
  return items
    .map((i) => {
      const parts = [i.text]
      if (i.skillTag) parts.push(`#${i.skillTag}`)
      if (i.contentTag) parts.push(`#${i.contentTag}`)
      if (i.estimatedMinutes != null) parts.push(`~${i.estimatedMinutes}`)
      return parts.join(' ')
    })
    .join('\n')
}

export function serializeObjectives(objectives: CurriculumObjective[]): string {
  return objectives
    .map((o) => {
      const parts = [o.text]
      if (o.cefrLevel) parts.push(`#${o.cefrLevel}`)
      if (o.skillTag) parts.push(`#${o.skillTag}`)
      return parts.join(' ')
    })
    .join('\n')
}
