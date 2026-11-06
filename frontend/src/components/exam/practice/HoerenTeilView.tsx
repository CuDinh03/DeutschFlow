'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import type { PracticeTeilResult } from '@/lib/telcPracticeApi'
import { AudioPlayer } from '@/components/exam/AudioPlayer'
import { DialogueAudioPlayer } from '@/components/exam/DialogueAudioPlayer'
import { HoerenGate } from '@/components/exam/HoerenGate'
import {
  isDialogueScript,
  isHoerenUnlocked,
  itemTurns,
  needsPersonaVoice,
  parseHoerenGate,
  scriptToPlainText,
  type HoerenGatePhase,
} from '@/components/exam/audioScript'
import { ObjectiveTeilView } from './ObjectiveTeilView'
import { withTrueFalse, type PracticeItem, type PracticeTeilData } from './practiceModel'

interface Props {
  teil: PracticeTeilData
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string | null) => void
  result: PracticeTeilResult | null
  wide: boolean
  tips: React.ReactNode
}

/**
 * Một Teil Hören trong giao diện luyện đề mới (06/11/2026) — dùng cho cả luyện từng Teil và thi thử
 * trọn đề. Giữ nghi thức đề thật như trình thi cũ: bấm bắt đầu → Ansage → thời gian đọc câu hỏi → nghe
 * được; câu hỏi ẩn tới khi bắt đầu; mỗi bài phát tối đa `max_plays` lần. Chọn đáp án bằng chính
 * `ObjectiveTeilView` (richtig/falsch như trắc nghiệm từng câu).
 *
 * Sau khi kiểm tra (có `result`): bỏ giới hạn số lần nghe và bỏ cổng — lúc này người học nghe lại để
 * hiểu vì sao sai, không còn là bài thi.
 */
export function HoerenTeilView({ teil, answers, onAnswer, result, wide, tips }: Props) {
  const t = useTranslations('v2.student.mockExamRun')
  const tp = useTranslations('v2.student.practice')
  const data = React.useMemo(() => withTrueFalse(teil), [teil])
  const gate = React.useMemo(() => parseHoerenGate(teil), [teil])
  const checked = result != null
  const [phase, setPhase] = React.useState<HoerenGatePhase>('idle')
  const effectivePhase: HoerenGatePhase | undefined = checked || !gate ? undefined : phase
  const locked = !isHoerenUnlocked(effectivePhase)
  const maxPlays = checked ? undefined : teil.max_plays
  const teilNo = teil.teil ?? 1

  if (gate && !checked && phase === 'idle') {
    return (
      <div className="mx-auto w-full max-w-[760px] px-3 py-4 lg:px-6 lg:py-5">
        {tips}
        {teil.instruction_vi && <p className="ga-ui mb-3 text-ga-small text-ga-muted">{teil.instruction_vi}</p>}
        <HoerenGate teilNo={teilNo} spec={gate} phase={phase} onPhaseChange={setPhase} />
        <p className="ga-ui mt-3 text-ga-small text-ga-muted">{tp('hoerenHidden')}</p>
      </div>
    )
  }

  const teilAudio = teil.audio_script ? (
    <div className="mb-4">
      {gate && !checked && <HoerenGate teilNo={teilNo} spec={gate} phase={phase} onPhaseChange={setPhase} />}
      {isDialogueScript(teil.audio_script) ? (
        <DialogueAudioPlayer turns={teil.audio_script} label={t('hoertext', { n: teilNo })} maxPlays={maxPlays} locked={locked} />
      ) : (
        <AudioPlayer script={scriptToPlainText(teil.audio_script)} label={t('hoertext', { n: teilNo })} maxPlays={maxPlays} locked={locked} />
      )}
    </div>
  ) : gate && !checked ? (
    <div className="mb-4">
      <HoerenGate teilNo={teilNo} spec={gate} phase={phase} onPhaseChange={setPhase} />
    </div>
  ) : null

  const itemAudio = (item: PracticeItem) => {
    const turns = needsPersonaVoice(item) ? itemTurns(item) : null
    const label = item.person ? t('listenPerson', { person: item.person }) : t('listenItem', { n: item.id.replace(/\D+/g, '') || 1 })
    if (turns) return <DialogueAudioPlayer turns={turns} compact label={label} maxPlays={maxPlays} locked={locked} />
    if (!item.audio_script) return null
    return isDialogueScript(item.audio_script) ? (
      <DialogueAudioPlayer turns={item.audio_script} label={label} maxPlays={maxPlays} locked={locked} />
    ) : (
      <AudioPlayer script={scriptToPlainText(item.audio_script)} compact label={label} maxPlays={maxPlays} locked={locked} />
    )
  }

  return (
    <ObjectiveTeilView
      teil={data}
      kind="mc"
      answers={answers}
      onAnswer={onAnswer}
      result={result}
      wide={wide}
      tips={tips}
      intro={teilAudio}
      itemExtra={itemAudio}
    />
  )
}
