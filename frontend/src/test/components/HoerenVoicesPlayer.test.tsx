/**
 * Bài nghe mỗi nhân vật một giọng (14/11/2026): trình phát đọc từng bước bằng đúng persona đã chia ở cấp
 * Teil, câu xin trước (prefetch) dùng cùng persona với lúc đọc, và người dẫn (Ansage, câu khung, „Nummer NN.",
 * câu dẫn tình huống) dùng một giọng không trùng nhân vật nào. Vai (`PRUEFER`/`PARTNER`) vẫn được truyền kèm
 * để `examTts` lùi về ANNA/THOMAS khi sidecar chưa có persona mới.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tts = vi.hoisted(() => ({
  speakExamLine: vi.fn(async () => 'skipped'),
  stopExamTts: vi.fn(),
  prepareExamLine: vi.fn(),
}))
vi.mock('@/components/features/exam-speaking/examTts', () => tts)
vi.mock('next-intl', async () => (await import('@/test/intlCatalog')).nextIntlCatalogMock('vi'))

import { HoerenPlayer, playSteps } from '@/components/exam/practice/HoerenPlayer'
import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import { assignHoerenVoices } from '@/components/exam/hoerenVoices'
import { itemTurns, type AudioTurn } from '@/components/exam/audioScript'
import type { PracticeTeilData } from '@/components/exam/practice/practiceModel'

const interview: AudioTurn[] = [
  { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Herr Vogel, wie kam es dazu?' },
  { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Eigentlich war es ein Zufall.' },
  { speaker: 'PRUEFER', name: 'Moderatorin', text: 'Und heute?' },
  { speaker: 'PARTNER', name: 'Herr Vogel', text: 'Heute möchte ich nichts anderes machen.' },
]

const teil1: PracticeTeilData = {
  teil: 1,
  max_plays: 1,
  reading_seconds: 30,
  ansage_de: 'Hörverstehen, Teil 1. Sie hören diese Texte nur einmal.',
  framing_de: 'Wie kommen Sie zur Arbeit? Hören Sie dazu die Antworten.',
  items: [
    { id: 'HV1-41', question: 'A', speaker: 'PRUEFER', audio_script: 'Nummer 41. Ich fahre das ganze Jahr mit dem Fahrrad.' },
    { id: 'HV1-42', question: 'B', speaker: 'PARTNER', audio_script: 'Nummer 42. Ich nehme meistens das Auto.' },
    { id: 'HV1-43', question: 'C', speaker: 'PRUEFER', audio_script: 'Nummer 43. Ich pendle jeden Tag mit dem Zug.' },
  ],
}

type Call = [role: string, text: string, persona?: string]
const spoken = () => tts.speakExamLine.mock.calls as unknown as Call[]
const prepared = () => tts.prepareExamLine.mock.calls as unknown as Call[]

beforeEach(() => {
  tts.speakExamLine.mockClear()
  tts.prepareExamLine.mockClear()
  window.localStorage.clear()
})

describe('playSteps — persona của từng bước', () => {
  it('không có bảng giọng thì bước không mang persona (hành vi cũ)', () => {
    expect(playSteps(interview).every((s) => !('persona' in s))).toBe(true)
  })

  it('„Nummer NN." và câu dẫn tình huống đọc bằng giọng người dẫn; lời thoại bằng giọng nhân vật', () => {
    const turns = itemTurns({ speaker: 'PARTNER', lead_in_de: 'Im Radio hören Sie folgenden Hinweis.', audio_script: 'Nummer 56. Achtung Autofahrer auf der A 8.' }) ?? []
    const voices = assignHoerenVoices([turns]).segments[0]
    const steps = playSteps(turns, voices)
    expect(steps.map((s) => [s.line, s.speaker, s.text, s.persona])).toEqual([
      [0, 'PRUEFER', 'Im Radio hören Sie folgenden Hinweis.', voices.narrator],
      [1, 'PRUEFER', 'Nummer 56.', voices.narrator],
      [1, 'PARTNER', 'Achtung Autofahrer auf der A 8.', voices.lines[1]],
    ])
    expect(voices.lines[1]).not.toBe(voices.narrator)
  })

  it('lượt lời dài bị cắt khúc: mọi khúc cùng một persona', () => {
    const long = 'Ich fahre eigentlich das ganze Jahr mit dem Fahrrad ins Büro, auch im Winter. '.repeat(9).trim()
    const turns: AudioTurn[] = [{ speaker: 'PARTNER', text: long }]
    const voices = assignHoerenVoices([turns]).segments[0]
    const steps = playSteps(turns, voices)
    expect(steps.length).toBeGreaterThan(1)
    expect(new Set(steps.map((s) => s.persona))).toEqual(new Set([voices.lines[0]]))
  })
})

describe('HoerenPlayer — đọc và xin trước bằng persona đã chia', () => {
  it('mỗi bước đọc bằng persona của nhân vật; câu xin trước dùng đúng persona sẽ đọc', async () => {
    const user = userEvent.setup()
    const voices = assignHoerenVoices([interview]).segments[0]
    const [host, guest] = voices.lines
    render(<HoerenPlayer turns={interview} label="Interview" voices={voices} />)
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledTimes(4))

    expect(spoken()).toEqual([
      ['PRUEFER', 'Herr Vogel, wie kam es dazu?', host],
      ['PARTNER', 'Eigentlich war es ein Zufall.', guest],
      ['PRUEFER', 'Und heute?', host],
      ['PARTNER', 'Heute möchte ich nichts anderes machen.', guest],
    ])
    expect(host).not.toBe(guest)
    // Mọi câu đã xin trước đều trùng (vai, lời, persona) với một câu được đọc.
    const spokenKeys = new Set(spoken().map((c) => c.join('|')))
    expect(prepared().length).toBeGreaterThan(0)
    for (const call of prepared()) expect(spokenKeys.has(call.join('|'))).toBe(true)
  })

  it('không truyền bảng giọng: gọi theo vai như trước (persona bỏ trống)', async () => {
    const user = userEvent.setup()
    render(<HoerenPlayer turns={interview.slice(0, 2)} label="Interview" />)
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledTimes(2))
    expect(spoken()).toEqual([
      ['PRUEFER', 'Herr Vogel, wie kam es dazu?', undefined],
      ['PARTNER', 'Eigentlich war es ein Zufall.', undefined],
    ])
  })
})

describe('HoerenTeilView — một bảng giọng cho cả Teil', () => {
  it('Teil 1: Ansage, câu khung và „Nummer NN." cùng một giọng người dẫn; mỗi người nói một giọng khác', async () => {
    const user = userEvent.setup()
    const expected = assignHoerenVoices((teil1.items ?? []).map((it) => itemTurns(it) ?? []))
    render(
      <HoerenTeilView teil={teil1} answers={{}} onAnswer={() => undefined} result={null} wide tips={null} allowRelaxed />,
    )
    await user.click(screen.getByRole('button', { name: /Bắt đầu Teil 1/ }))
    await user.click(await screen.findByRole('button', { name: /Đã đọc xong/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Phát' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await screen.findByText('Đoạn 2 · câu 42')
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await screen.findByText('Đoạn 3 · câu 43')
    await user.click(screen.getByRole('button', { name: 'Phát' }))
    await waitFor(() => expect(tts.speakExamLine).toHaveBeenCalledTimes(8))

    const narrator = expected.narrator
    expect(narrator).toBe('HOER_M1')
    const [w1, m, w2] = expected.segments.map((s) => s.lines[0])
    expect(spoken()).toEqual([
      ['PRUEFER', teil1.ansage_de, narrator],
      ['PRUEFER', teil1.framing_de, narrator],
      ['PRUEFER', 'Nummer 41.', narrator],
      ['PRUEFER', 'Ich fahre das ganze Jahr mit dem Fahrrad.', w1],
      ['PRUEFER', 'Nummer 42.', narrator],
      ['PARTNER', 'Ich nehme meistens das Auto.', m],
      ['PRUEFER', 'Nummer 43.', narrator],
      ['PRUEFER', 'Ich pendle jeden Tag mit dem Zug.', w2],
    ])
    expect(new Set([narrator, w1, m, w2]).size).toBe(4)
  })
})
