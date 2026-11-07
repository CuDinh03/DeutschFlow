'use client'

import { useTranslations } from 'next-intl'
import { Mic, UserRound, type LucideIcon } from 'lucide-react'

export type OralSpeaker = 'PRUEFER' | 'PARTNER' | 'ME' | null

interface Props {
  speaker: OralSpeaker
  /** Teil này có bạn thi AI (blueprint `hasPartner`) — không có thì chỉ hiện Giám khảo và Bạn. */
  hasPartner: boolean
  /** Dòng phụ dưới "Bạn": Đến lượt bạn / Đang nghe / Đang nói / Đang gửi. */
  meSub: string
}

/**
 * Hàng người trong phòng thi nói (mẫu 07/11/2026): Giám khảo · Bạn thi (AI) · Bạn. Người đang nói
 * viền navy nền nhạt và có sóng âm 4 vạch; giảm chuyển động thì sóng âm đứng yên.
 */
export function OralPeople({ speaker, hasPartner, meSub }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room.oral.people')
  return (
    <div className="flex gap-2 border-b border-ga-line px-3 py-3 sm:gap-2.5 sm:px-4" data-testid="oral-people">
      <Person id="PRUEFER" icon={UserRound} tone="ink" name={t('pruefer')} sub={t('ai')} talking={speaker === 'PRUEFER'} />
      {hasPartner && <Person id="PARTNER" icon={UserRound} tone="plain" name={t('partner')} sub={t('ai')} talking={speaker === 'PARTNER'} />}
      <Person id="ME" icon={Mic} tone="yellow" name={t('you')} sub={meSub} talking={speaker === 'ME'} />
    </div>
  )
}

const GLYPH_TONE = {
  ink: 'bg-ga-ink text-ga-bg',
  plain: 'bg-ga-navy-soft text-ga-navy',
  yellow: 'bg-ga-yellow text-ga-ink',
} as const

function Person({
  id,
  icon: Icon,
  tone,
  name,
  sub,
  talking,
}: {
  id: string
  icon: LucideIcon
  tone: keyof typeof GLYPH_TONE
  name: string
  sub: string
  talking: boolean
}) {
  return (
    <div
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-ga-touch border px-1.5 py-2 transition-colors duration-[240ms] sm:flex-row sm:gap-2.5 sm:p-2.5 ${
        talking ? 'border-ga-navy bg-ga-navy-soft' : 'border-ga-line'
      }`}
      data-person={id}
      data-talking={talking ? 'true' : 'false'}
    >
      <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-ga sm:h-9 sm:w-9 ${GLYPH_TONE[tone]}`}>
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="ga-ui w-full min-w-0 text-center text-ga-small sm:flex-1 sm:text-left sm:text-ga-body">
        <b className="block truncate font-semibold text-ga-ink">{name}</b>
        <span className="hidden truncate text-ga-small text-ga-muted sm:block">{sub}</span>
      </span>
      <span
        aria-hidden
        className={`ga-oral-eq absolute right-2 top-2 flex h-4 items-end gap-0.5 transition-opacity duration-150 sm:static ${talking ? 'opacity-100' : 'opacity-0'}`}
      >
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}
