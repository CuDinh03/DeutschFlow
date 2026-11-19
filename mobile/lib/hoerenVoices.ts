// Giọng đọc bài nghe Hören: mỗi nhân vật một giọng (owner chốt 13/11/2026), người dẫn một giọng cố định cho
// cả đề (14/11/2026). Bản sinh đôi của web `frontend/src/components/exam/hoerenVoices.ts` + `normalizeTurns`
// (`audioScript.ts`) — cùng phép chia ⇒ cùng một đoạn nghe thì app và web ra cùng giọng. Hàm thuần.

import type { AudioTurn } from './examApi'

export type VoiceGender = 'F' | 'M'

/** Ba giọng nữ (Katja, Amala, Seraphina) và ba giọng nam (Conrad, Killian, Florian) — persona `HOER_*` của sidecar. */
export const HOEREN_FEMALE_VOICES = ['HOER_F1', 'HOER_F2', 'HOER_F3'] as const
export const HOEREN_MALE_VOICES = ['HOER_M1', 'HOER_M2', 'HOER_M3'] as const
/** Người dẫn của mọi bài nghe: Conrad — không nhân vật nào dùng. */
export const HOEREN_NARRATOR_VOICE = 'HOER_M1'

const ALTERNATING_ROLES = ['PRUEFER', 'PARTNER'] as const
const FEMALE_ROLE = /^(PRUEFER|F|W|FRAU|FEMALE|WEIBLICH)$/i
const FEMALE_NAME = /(^|\s)(Frau|Moderatorin|Sprecherin|Reporterin|Interviewerin|Journalistin|Ansagerin)(\s|$)/i
const MALE_NAME = /(^|\s)(Herr|Moderator|Sprecher|Reporter|Interviewer|Journalist|Ansager)(\s|$)/i

/** Như web: bỏ lượt rỗng, lượt không khai vai thì luân phiên PRUEFER/PARTNER. */
export function normalizeTurns(turns: readonly AudioTurn[]): { speaker: string; text: string }[] {
  const out: { speaker: string; text: string }[] = []
  let alternating = 0
  for (const turn of turns) {
    const text = (turn.text ?? '').trim()
    if (!text) continue
    const speaker = turn.speaker?.trim() || ALTERNATING_ROLES[alternating % ALTERNATING_ROLES.length]
    if (!turn.speaker) alternating += 1
    out.push({ speaker, text })
  }
  return out
}

export function roleGender(speaker: string | undefined): VoiceGender {
  return FEMALE_ROLE.test((speaker ?? '').trim()) ? 'F' : 'M'
}

export function nameGender(name: string | undefined): VoiceGender | null {
  const clean = (name ?? '').trim()
  if (!clean) return null
  if (FEMALE_NAME.test(clean)) return 'F'
  if (MALE_NAME.test(clean)) return 'M'
  return null
}

/** FNV-1a 32 bit (UTF-16) — như web `marksModel.fnv1a`. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Persona cho từng dòng (sau khi bỏ lượt rỗng) của các đoạn nghe theo thứ tự phát. Nhân vật = `name` nếu có,
 * không thì vai; giới theo tên rõ ràng rồi mới theo vai; xoay vòng trong nhóm cùng giới, điểm bắt đầu lấy
 * từ hash nội dung (tất định). Câu dẫn `LEAD_IN` đọc bằng giọng người dẫn.
 */
export function assignHoerenVoices(segments: readonly (readonly AudioTurn[])[]): string[][] {
  const pool: Record<VoiceGender, string[]> = {
    F: [...HOEREN_FEMALE_VOICES],
    M: HOEREN_MALE_VOICES.filter((v) => v !== HOEREN_NARRATOR_VOICE),
  }
  const hash = parseInt(
    fnv1a(segments.map((turns) => normalizeTurns(turns).map((ln) => ln.text).join('\n')).join('\n\n')),
    16,
  )
  const next: Record<VoiceGender, number> = { F: hash % pool.F.length, M: (hash >>> 8) % pool.M.length }
  return segments.map((turns) => {
    const kept = turns.filter((x) => (x.text ?? '').trim())
    const byKey = new Map<string, string>()
    return normalizeTurns(turns).map((ln, i) => {
      const src = kept[i]
      if (src?.kind === 'LEAD_IN') return HOEREN_NARRATOR_VOICE
      const name = src?.name?.trim()
      const key = name ? `n:${name.toLowerCase()}` : `s:${ln.speaker}`
      let voice = byKey.get(key)
      if (!voice) {
        const g = nameGender(name) ?? roleGender(ln.speaker)
        const voices = pool[g]
        voice = voices[next[g] % voices.length]
        next[g] += 1
        byKey.set(key, voice)
      }
      return voice
    })
  })
}
