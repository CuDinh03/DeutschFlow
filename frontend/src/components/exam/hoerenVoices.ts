/**
 * Giọng đọc của bài nghe: mỗi nhân vật một giọng (owner chốt 13/11/2026).
 *
 * Trước đây cả phần Nghe chỉ có hai giọng (ANNA cho vai `PRUEFER`, THOMAS cho vai `PARTNER`) và người dẫn
 * dùng chung giọng nữ của nhân vật — Teil 1 năm người mà nghe như hai người, câu „Nummer 41." lẫn vào lời
 * người nói. Ở đây chia SÁU giọng Edge gốc tiếng Đức (ba nữ, ba nam, cao độ tự nhiên — persona `HOER_*`
 * của sidecar) cho các nhân vật của MỘT Teil:
 *
 *   • nhân vật = `name` (nếu có), không thì vai `speaker`, tính trong từng đoạn — ở Teil 1 và Teil 3 mỗi câu
 *     là một người khác nên mỗi đoạn lấy giọng kế tiếp trong nhóm cùng giới (xoay vòng, hai người cùng giới
 *     liền nhau luôn khác giọng);
 *   • giới tính theo vai (`PRUEFER` → nữ, còn lại → nam); `name` nói rõ giới thì tin `name`
 *     („Herr …" / „Frau …", „Moderator" / „Moderatorin", „Sprecher" / „Sprecherin");
 *   • người dẫn (câu dẫn `LEAD_IN`, „Nummer NN.", Ansage, câu khung) có MỘT giọng cố định cho cả Teil và
 *     không nhân vật nào của Teil dùng giọng đó: lấy ở giới có ÍT nhân vật hơn (bằng nhau thì nữ), để giới
 *     đông người còn đủ ba giọng;
 *   • tất định: cùng một Teil thì máy nào, lần nào cũng ra cùng cách chia (điểm bắt đầu xoay vòng lấy từ
 *     hash nội dung lời thoại, không ngẫu nhiên lúc render).
 *
 * Hàm thuần, không gọi mạng. Sidecar chưa có persona `HOER_*` thì `examTts` tự lùi về ANNA/THOMAS.
 */
import { normalizeTurns, type AudioTurn } from './audioScript'
import { fnv1a } from './marks/marksModel'

export type VoiceGender = 'F' | 'M'

/** Ba giọng nữ: Katja, Amala, Seraphina (bảng `PERSONA_VOICES` của sidecar). */
export const HOEREN_FEMALE_VOICES = ['HOER_F1', 'HOER_F2', 'HOER_F3'] as const
/** Ba giọng nam: Conrad, Killian, Florian. */
export const HOEREN_MALE_VOICES = ['HOER_M1', 'HOER_M2', 'HOER_M3'] as const
export const HOEREN_VOICES: readonly string[] = [...HOEREN_FEMALE_VOICES, ...HOEREN_MALE_VOICES]

/** Giọng người dẫn theo giới: Seraphina (nữ) hoặc Conrad (nam) — luôn một trong hai, để quen tai. */
const NARRATOR_VOICE: Record<VoiceGender, string> = { F: 'HOER_F3', M: 'HOER_M1' }

/** Giọng của một đoạn nghe: `lines[i]` là persona của dòng lời thoại thứ i (thứ tự của `normalizeTurns`). */
export interface SegmentVoices {
  narrator: string
  lines: string[]
}

/** Giọng của cả Teil: một người dẫn chung, mỗi đoạn một bảng giọng. */
export interface PartVoices {
  narrator: string
  segments: SegmentVoices[]
}

const FEMALE_ROLE = /^(PRUEFER|F|W|FRAU|FEMALE|WEIBLICH)$/i
const FEMALE_NAME = /(^|\s)(Frau|Moderatorin|Sprecherin|Reporterin|Interviewerin|Journalistin|Ansagerin)(\s|$)/i
const MALE_NAME = /(^|\s)(Herr|Moderator|Sprecher|Reporter|Interviewer|Journalist|Ansager)(\s|$)/i

/** Giới theo vai: `PRUEFER` (và F/W) là nữ; `PARTNER`, M và vai lạ là nam (vai lạ trước nay đọc giọng nam DEFAULT). */
export function roleGender(speaker: string | undefined): VoiceGender {
  return FEMALE_ROLE.test((speaker ?? '').trim()) ? 'F' : 'M'
}

/** Giới mà tên nói rõ; `null` khi tên không cho biết (tên riêng, „Kundin"…) — lúc đó theo vai. */
export function nameGender(name: string | undefined): VoiceGender | null {
  const clean = (name ?? '').trim()
  if (!clean) return null
  if (FEMALE_NAME.test(clean)) return 'F'
  if (MALE_NAME.test(clean)) return 'M'
  return null
}

interface Line {
  /** `null` = dòng của người dẫn (câu dẫn tình huống). */
  key: string | null
  gender: VoiceGender
}

function segmentLines(turns: AudioTurn[]): Line[] {
  // Cùng phép lọc với `normalizeTurns` / `playSteps`: bỏ lượt rỗng, nên chỉ số dòng khớp nhau.
  const kept = turns.filter((x) => (x.text ?? '').trim())
  return normalizeTurns(turns).map((ln, i) => {
    const src = kept[i]
    if (src?.kind === 'LEAD_IN') return { key: null, gender: 'F' as VoiceGender }
    const name = src?.name?.trim()
    return {
      key: name ? `n:${name.toLowerCase()}` : `s:${ln.speaker}`,
      gender: nameGender(name) ?? roleGender(ln.speaker),
    }
  })
}

/**
 * Chia giọng cho một Teil nghe. `segments` là các đoạn theo thứ tự phát: Teil 2 một đoạn (cả bài phỏng vấn),
 * Teil 1 và Teil 3 mỗi câu một đoạn (các lượt của `itemTurns`).
 */
export function assignHoerenVoices(segments: AudioTurn[][]): PartVoices {
  const parsed = segments.map(segmentLines)

  // Đếm nhân vật theo giới (mỗi đoạn tính riêng: câu khác là người khác).
  const count: Record<VoiceGender, number> = { F: 0, M: 0 }
  for (const lines of parsed) {
    const seen = new Set<string>()
    for (const ln of lines) {
      if (ln.key === null || seen.has(ln.key)) continue
      seen.add(ln.key)
      count[ln.gender] += 1
    }
  }
  const narratorGender: VoiceGender = count.M < count.F ? 'M' : 'F'
  const narrator = NARRATOR_VOICE[narratorGender]

  const pool: Record<VoiceGender, string[]> = {
    F: HOEREN_FEMALE_VOICES.filter((v) => v !== narrator),
    M: HOEREN_MALE_VOICES.filter((v) => v !== narrator),
  }
  // Điểm bắt đầu xoay vòng lấy từ nội dung Teil ⇒ cùng đề thì cùng giọng trên mọi máy, đề khác thì đổi giọng.
  const hash = parseInt(
    fnv1a(segments.map((turns) => normalizeTurns(turns).map((ln) => ln.text).join('\n')).join('\n\n')),
    16,
  )
  const next: Record<VoiceGender, number> = { F: hash % pool.F.length, M: (hash >>> 8) % pool.M.length }

  const out = parsed.map((lines): SegmentVoices => {
    const byKey = new Map<string, string>()
    return {
      narrator,
      lines: lines.map((ln) => {
        if (ln.key === null) return narrator
        let voice = byKey.get(ln.key)
        if (!voice) {
          const voices = pool[ln.gender]
          voice = voices[next[ln.gender] % voices.length]
          next[ln.gender] += 1
          byKey.set(ln.key, voice)
        }
        return voice
      }),
    }
  })
  return { narrator, segments: out }
}
