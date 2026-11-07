'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CircleCheck, Mic, MicOff, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useMicLevelCheck } from './MicCheck'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import { speakExamLine } from './examTts'

interface Props {
  /** Teil đầu có giờ chuẩn bị → nút "Vào phòng chuẩn bị"; không có (A1/A2) → "Vào thi". */
  hasPrep: boolean
  busy: boolean
  onGo: () => void
}

const METER_BARS = 12
const SPEAKER_TEST = 'Hallo! Können Sie mich gut hören?'

/**
 * Màn Kiểm tra trước khi thi nói (mẫu 07/11/2026): ba dòng Micro (thanh mức âm) · Loa (nghe thử
 * giọng giám khảo) · Chỗ yên tĩnh. Micro chưa đạt thì chưa vào được; micro bị chặn → hướng dẫn cho
 * phép rồi kiểm tra lại. Đứng TRƯỚC khi tạo phiên vì A1/A2 không có giờ chuẩn bị: tạo phiên là đồng
 * hồ Teil chạy.
 */
export function OralMicCheckScreen({ hasPrep, busy, onGo }: Props) {
  const t = useTranslations('v2.student.examSpeaking.entry')
  const [passed, setPassed] = useState(false)
  const { checking, level, heard, errorKind, start } = useMicLevelCheck(() => setPassed(true))
  const [playing, setPlaying] = useState(false)

  const playTest = async () => {
    setPlaying(true)
    try {
      await speakExamLine('PRUEFER', SPEAKER_TEST)
    } finally {
      setPlaying(false)
    }
  }

  if (errorKind === 'denied') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 py-8 text-center" data-testid="oral-mic-blocked">
        <GaGlyph icon={MicOff} size="lg" tone="plain" />
        <h1 className="font-ga-display text-ga-h2 text-ga-ink">{t('blockedTitle')}</h1>
        <p className="ga-ui text-ga-body text-ga-muted">{t('blockedBody')}</p>
        <button
          type="button"
          onClick={() => void start()}
          className="ga-ui inline-flex min-h-11 items-center gap-2 rounded-ga-touch bg-ga-ink px-4 text-ga-body font-semibold text-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2"
          data-testid="oral-mic-retry"
        >
          <RotateCcw size={16} aria-hidden /> {t('retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 py-4" data-testid="oral-mic-check">
      <GaGlyph icon={Mic} size="lg" tone="yellow" />
      <h1 className="font-ga-display text-ga-h2 text-ga-ink">{t('title')}</h1>
      <ul className="flex flex-col divide-y divide-ga-line rounded-ga-touch border border-ga-line bg-ga-card">
        <Row icon={Mic} title={t('micTitle')} sub={t('micSub')}>
          {passed ? (
            <CircleCheck size={20} className="text-ga-green" aria-label={t('passed')} data-testid="oral-mic-passed" />
          ) : checking ? (
            <span className="flex h-6 w-24 items-end gap-0.5" role="meter" aria-label={heard ? t('heard') : t('speakNow')} aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100} data-testid="oral-mic-meter">
              {Array.from({ length: METER_BARS }, (_, i) => (
                <span
                  key={i}
                  className={`w-full rounded-sm transition-[height] duration-75 ${level * METER_BARS > i ? 'bg-ga-green' : 'bg-ga-line'}`}
                  style={{ height: `${20 + i * 6}%` }}
                />
              ))}
            </span>
          ) : (
            <SmallBtn onClick={() => void start()} testId="oral-mic-start">
              {t('micCheck')}
            </SmallBtn>
          )}
        </Row>
        <Row icon={Volume2} title={t('speakerTitle')} sub={t('speakerSub')}>
          <SmallBtn onClick={() => void playTest()} disabled={playing} testId="oral-speaker-test">
            <Play size={14} aria-hidden /> {t('speakerPlay')}
          </SmallBtn>
        </Row>
        <Row icon={VolumeX} title={t('quietTitle')} sub={t('quietSub')}>
          <CircleCheck size={20} className="text-ga-green" aria-hidden />
        </Row>
      </ul>
      {errorKind && errorKind !== 'denied' && (
        <p className="ga-ui text-ga-small text-ga-red" role="alert" data-testid="oral-mic-error">
          {t('micFailed')}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onGo}
          disabled={!passed || busy}
          className="ga-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 disabled:opacity-40"
          data-testid="oral-entry-go"
        >
          {hasPrep ? t('goPrep') : t('goExam')} <ArrowRight size={16} aria-hidden />
        </button>
        <p className="ga-ui text-ga-small text-ga-muted">{!passed ? t('needMic') : hasPrep ? t('prepNote') : t('noPrepNote')}</p>
      </div>
    </div>
  )
}

function Row({ icon: Icon, title, sub, children }: { icon: typeof Mic; title: string; sub: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <GaGlyph icon={Icon} />
      <span className="ga-ui min-w-0 flex-1">
        <b className="block text-ga-body font-semibold text-ga-ink">{title}</b>
        <span className="block text-ga-small text-ga-muted">{sub}</span>
      </span>
      {children}
    </li>
  )
}

function SmallBtn({ onClick, disabled, testId, children }: { onClick: () => void; disabled?: boolean; testId: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ga-ui inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-ga-touch border border-ga-line bg-ga-card px-3 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50"
      data-testid={testId}
    >
      {children}
    </button>
  )
}
