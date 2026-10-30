'use client'

import * as React from 'react'
import { PERSONA_LIST, type PersonaId } from '@/lib/personas'
import { personaSoft } from '@/lib/personaPaper'
import { AnnaCharacter } from '@/components/speaking/characters/AnnaCharacter'
import { EmmaCharacter } from '@/components/speaking/characters/EmmaCharacter'
import { HannieCharacter } from '@/components/speaking/characters/HannieCharacter'
import { KlausCharacter } from '@/components/speaking/characters/KlausCharacter'
import { LenaCharacter } from '@/components/speaking/characters/LenaCharacter'
import { LukasCharacter } from '@/components/speaking/characters/LukasCharacter'
import { MaxCharacter } from '@/components/speaking/characters/MaxCharacter'
import { NiklasCharacter } from '@/components/speaking/characters/NiklasCharacter'
import { NinaCharacter } from '@/components/speaking/characters/NinaCharacter'
import { OliverCharacter } from '@/components/speaking/characters/OliverCharacter'
import { PetraCharacter } from '@/components/speaking/characters/PetraCharacter'
import { SarahCharacter } from '@/components/speaking/characters/SarahCharacter'
import { SchneiderCharacter } from '@/components/speaking/characters/SchneiderCharacter'
import { ThomasCharacter } from '@/components/speaking/characters/ThomasCharacter'
import { WeberCharacter } from '@/components/speaking/characters/WeberCharacter'
import { WorkplaceInterviewerCharacter } from '@/components/speaking/characters/WorkplaceInterviewerCharacter'
import { workplaceInterviewer } from '@/lib/workplaceInterviewers'

/**
 * Chân dung người phỏng vấn trên trang công khai (làm mới hình ảnh 19/10/2026).
 *
 * Dùng ĐÚNG bộ nhân vật vẽ phẳng của phòng phỏng vấn trong app (owner chốt giữ phong cách này),
 * để khách thấy trên trang chủ đúng người sẽ phỏng vấn mình. Nền nhạt pha từ accent của nhân vật
 * (`personaSoft`), khung cắt lấy đầu và vai: SVG gốc 280×500 nên đặt trong khung tỉ lệ 280/500
 * rồi cắt phần dưới bằng ô cha `overflow-hidden`.
 *
 * `talking` bật miệng nói có sẵn của nhân vật. `data-ga-look` cho `useLookAtPointer` tìm nhân vật
 * để mắt nhìn theo con trỏ; ngoài vùng có hook đó thì thuộc tính này không có tác dụng.
 */
type CharComponent = React.ComponentType<{ className?: string; isTalking?: boolean }>

const CHARACTERS: Partial<Record<PersonaId, CharComponent>> = {
  anna: AnnaCharacter as CharComponent,
  emma: EmmaCharacter as CharComponent,
  hannie: HannieCharacter as CharComponent,
  klaus: KlausCharacter as CharComponent,
  lena: LenaCharacter as CharComponent,
  lukas: LukasCharacter as CharComponent,
  max: MaxCharacter as CharComponent,
  niklas: NiklasCharacter as CharComponent,
  nina: NinaCharacter as CharComponent,
  oliver: OliverCharacter as CharComponent,
  petra: PetraCharacter as CharComponent,
  sarah: SarahCharacter as CharComponent,
  schneider: SchneiderCharacter as CharComponent,
  thomas: ThomasCharacter as CharComponent,
  weber: WeberCharacter as CharComponent,
}

export function hasPortrait(id: PersonaId): boolean {
  return id in CHARACTERS
}

export function PersonaPortrait({
  id,
  className = '',
  tint = 0.2,
  talking = false,
}: {
  id: PersonaId
  className?: string
  /** Độ đậm của nền accent (0–1). */
  tint?: number
  talking?: boolean
}) {
  const Char = CHARACTERS[id]
  const accent = PERSONA_LIST.find((p) => p.id === id)?.accent
  if (!Char) return null
  return (
    <div
      aria-hidden
      data-ga-look
      className={`relative aspect-square overflow-hidden ${className}`}
      style={accent ? { background: personaSoft(accent, tint) } : undefined}
    >
      <div className="absolute inset-x-[6%] top-[4%] aspect-[280/500]">
        <Char className="block h-full w-full" isTalking={talking} />
      </div>
    </div>
  )
}

/**
 * Chân dung theo mã nhân vật của backend (`OccupationDetail.personaCode`): nhân vật cũ trong
 * `personas.ts` hoặc người tuyển dụng theo nơi làm việc (đợt 2c). Mã khác (DEFAULT…) không vẽ gì.
 */
export function InterviewerPortrait({
  personaCode,
  className = '',
  tint = 0.2,
  talking = false,
}: {
  personaCode: string
  className?: string
  tint?: number
  talking?: boolean
}) {
  const legacy = personaCode.toLowerCase() as PersonaId
  if (CHARACTERS[legacy]) return <PersonaPortrait id={legacy} className={className} tint={tint} talking={talking} />
  const w = workplaceInterviewer(personaCode)
  if (!w) return null
  return (
    <div
      aria-hidden
      data-ga-look
      className={`relative aspect-square overflow-hidden ${className}`}
      style={{ background: personaSoft(w.accent, tint) }}
    >
      <div className="absolute inset-x-[6%] top-[4%] aspect-[280/500]">
        <WorkplaceInterviewerCharacter code={w.code} className="block h-full w-full" isTalking={talking} />
      </div>
    </div>
  )
}
