import { describe, expect, it } from 'vitest'
import { LEAD_IN_PAUSE_MS, SPEAKER_CHANGE_PAUSE_MS, TTS_CHUNK_MAX, chunkText, playSteps } from './HoerenPlayer'

describe('playSteps — các bước phát của một bài nghe', () => {
  it('Teil 1: câu báo số câu tách ra, giọng người dẫn đọc, rồi nghỉ trước nội dung', () => {
    const steps = playSteps([{ speaker: 'PARTNER', text: 'Nummer 41. Ich fahre das ganze Jahr mit dem Fahrrad.' }])
    expect(steps).toEqual([
      { line: 0, speaker: 'PRUEFER', text: 'Nummer 41.', pauseAfter: LEAD_IN_PAUSE_MS },
      { line: 0, speaker: 'PARTNER', text: 'Ich fahre das ganze Jahr mit dem Fahrrad.', pauseAfter: 0 },
    ])
  })

  it('Teil 3: nghỉ sau câu dẫn tình huống; dòng lời thoại giữ nguyên số thứ tự', () => {
    const steps = playSteps([
      { speaker: 'PRUEFER', text: 'Lesen Sie jetzt die Aufgabe 56.', kind: 'LEAD_IN' },
      { speaker: 'PRUEFER', text: 'Hallo Frau Brandt, hier ist Nadine Krüger.' },
    ])
    expect(steps.map((s) => [s.line, s.pauseAfter])).toEqual([[0, LEAD_IN_PAUSE_MS], [1, 0]])
  })

  it('Teil 2: đổi người nói có một nhịp thở ngắn; cùng người nói thì liền', () => {
    const steps = playSteps([
      { speaker: 'PRUEFER', text: 'Herr Vogel, wie kam es dazu?' },
      { speaker: 'PARTNER', text: 'Eigentlich war es ein Zufall.' },
      { speaker: 'PARTNER', text: 'Ich habe früher in einem Büro gearbeitet.' },
    ])
    expect(steps.map((s) => s.pauseAfter)).toEqual([SPEAKER_CHANGE_PAUSE_MS, 0, 0])
  })

  it('câu chỉ có „Nummer 41." hoặc số nằm giữa câu thì không tách', () => {
    expect(playSteps([{ speaker: 'PARTNER', text: 'Nummer 41.' }])).toHaveLength(1)
    expect(playSteps([{ speaker: 'PARTNER', text: 'Meine Nummer 41. ist neu.' }])).toHaveLength(1)
  })

  it('lượt lời dài hơn trần của máy chủ TTS được cắt ở ranh giới câu, cùng một giọng, không mất chữ', () => {
    const sentence = 'Ich fahre eigentlich das ganze Jahr mit dem Fahrrad ins Büro, auch im Winter. '
    const long = sentence.repeat(9).trim()
    const chunks = chunkText(long)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(TTS_CHUNK_MAX)
      expect(c.endsWith('.')).toBe(true)
    }
    expect(chunks.join(' ')).toBe(long)
    const steps = playSteps([{ speaker: 'PARTNER', text: `Nummer 41. ${long}` }])
    expect(steps[0]).toMatchObject({ speaker: 'PRUEFER', text: 'Nummer 41.', pauseAfter: LEAD_IN_PAUSE_MS })
    expect(steps.slice(1).every((s) => s.speaker === 'PARTNER' && s.line === 0 && s.pauseAfter === 0)).toBe(true)
    expect(chunkText('Kurz.')).toEqual(['Kurz.'])
  })
})
