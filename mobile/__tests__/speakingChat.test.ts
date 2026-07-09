import { mapMessagesToTurns } from '@/lib/speakingChat'
import type { AiSpeakingMessage } from '@/lib/speakingApi'

const msg = (over: Partial<AiSpeakingMessage>): AiSpeakingMessage => ({
  id: 1,
  role: 'ASSISTANT',
  userText: null,
  aiSpeechDe: null,
  correction: null,
  explanationVi: null,
  grammarPoint: null,
  newWord: null,
  userInterestDetected: null,
  assistantAction: null,
  assistantFeedback: null,
  createdAt: '2026-07-10T10:00:00.000Z',
  ...over,
})

describe('mapMessagesToTurns', () => {
  it('attaches a persisted correction to the preceding user turn, not the assistant reply', () => {
    const turns = mapMessagesToTurns([
      msg({ id: 1, role: 'USER', userText: 'Ich hatten Stress.' }),
      msg({
        id: 2,
        role: 'ASSISTANT',
        aiSpeechDe: 'Ach, Stress! Was hat dich gestresst?',
        correction: 'Ich hatte Stress.',
        grammarPoint: 'HABEN',
        explanationVi: "Sai lỗi động từ haben: 'ich hatten' → 'Ich hatte'",
      }),
    ])

    expect(turns).toHaveLength(2)
    // Correction rides on the learner's turn.
    expect(turns[0].role).toBe('user')
    expect(turns[0].feedback?.correction).toBe('Ich hatte Stress.')
    expect(turns[0].feedback?.grammarPoint).toBe('HABEN')
    // Assistant reply carries no correction (only conversational feedback + empty suggestions).
    expect(turns[1].role).toBe('assistant')
    expect(turns[1].feedback?.correction).toBeUndefined()
    expect(turns[1].feedback?.suggestions).toEqual([])
  })

  it('leaves the user turn uncorrected when the assistant reply has no correction', () => {
    const turns = mapMessagesToTurns([
      msg({ id: 1, role: 'USER', userText: 'Ich war im Kino.' }),
      msg({ id: 2, role: 'ASSISTANT', aiSpeechDe: 'Ach, im Kino! Was hast du gesehen?' }),
    ])

    expect(turns[0].feedback).toBeUndefined()
    expect(turns[1].role).toBe('assistant')
  })

  it('drops assistant rows with no German speech and keeps only spoken user turns', () => {
    const turns = mapMessagesToTurns([
      msg({ id: 1, role: 'USER', userText: null }),
      msg({ id: 2, role: 'USER', userText: 'Hallo!' }),
      msg({ id: 3, role: 'ASSISTANT', aiSpeechDe: null }),
    ])

    expect(turns).toHaveLength(1)
    expect(turns[0]).toMatchObject({ role: 'user', content: 'Hallo!' })
  })
})
