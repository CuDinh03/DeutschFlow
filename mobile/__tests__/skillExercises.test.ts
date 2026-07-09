import {
  itemsOf,
  passageOf,
  activeSkills,
  hasAnySkillExercise,
  localIsCorrect,
  buildSkillAnswers,
  isChoiceType,
  isTextType,
  isSpeaking,
  hiddenPromptOf,
} from '@/lib/skillExercises'
import type { SkillExercises, SkillExerciseItem } from '@/lib/skillTreeApi'

const se: SkillExercises = {
  HOEREN: [
    { type: 'LISTEN_AND_CHOOSE', options: ['a', 'b', 'c'], correct_index: 1, audio_transcript: 'Hallo' },
    { type: 'LISTEN_AND_FILL', correct_answer: 'Morgen', accept_also: ['morgen'] },
  ],
  SPRECHEN: [{ type: 'SPEAKING_REPEAT', sentence_de: 'Guten Tag' }],
  LESEN: {
    reading_passage: { text_de: 'Ein Text.', text_type: 'Notiz' },
    exercises: [
      { type: 'READ_TRUE_FALSE', statement_de: 'X', correct_answer: 'falsch', accept_also: ['false'] },
    ],
  },
  SCHREIBEN: [
    {
      type: 'REORDER_WORDS',
      words: ['ein', 'esse', 'Ich', 'Brötchen'],
      correct_order: ['Ich', 'esse', 'ein', 'Brötchen'],
      correct_answer: 'Ich esse ein Brötchen',
      accept_also: ['ich esse ein brötchen'],
    },
  ],
}

describe('skillExercises helpers', () => {
  test('itemsOf reads array skills and the Lesen object', () => {
    expect(itemsOf(se, 'HOEREN')).toHaveLength(2)
    expect(itemsOf(se, 'LESEN')).toHaveLength(1) // pulls .exercises out of the object
    expect(itemsOf(undefined, 'HOEREN')).toEqual([])
  })

  test('passageOf returns the Lesen reading passage', () => {
    expect(passageOf(se)?.text_de).toBe('Ein Text.')
    expect(passageOf({ HOEREN: [] })).toBeUndefined()
  })

  test('activeSkills / hasAnySkillExercise ignore empty skills', () => {
    expect(activeSkills(se)).toEqual(['HOEREN', 'SPRECHEN', 'LESEN', 'SCHREIBEN'])
    expect(activeSkills({ HOEREN: [], SPRECHEN: [] })).toEqual([])
    expect(hasAnySkillExercise(se)).toBe(true)
    expect(hasAnySkillExercise({ HOEREN: [] })).toBe(false)
    expect(hasAnySkillExercise(undefined)).toBe(false)
  })

  test('type predicates route to the right input', () => {
    expect(isChoiceType('LISTEN_AND_CHOOSE')).toBe(true)
    expect(isChoiceType('READ_AND_CHOOSE')).toBe(true)
    expect(isTextType('TRANSLATE_VI_DE')).toBe(true)
    expect(isSpeaking('SPEAKING_RESPONSE')).toBe(true)
    expect(isSpeaking('FREE_WRITE')).toBe(true)
    expect(isSpeaking('READ_TRUE_FALSE')).toBe(false)
  })

  test('localIsCorrect mirrors the server grader precedence', () => {
    const mc = se.HOEREN![0]
    expect(localIsCorrect(mc, 1)).toBe(true)
    expect(localIsCorrect(mc, 0)).toBe(false)
    const fill = se.HOEREN![1]
    expect(localIsCorrect(fill, 'morgen')).toBe(true) // accept_also, case-insensitive
    expect(localIsCorrect(fill, ' Morgen ')).toBe(true) // trimmed
    expect(localIsCorrect(fill, 'Abend')).toBe(false)
    const tf = itemsOf(se, 'LESEN')[0]
    expect(localIsCorrect(tf, 'falsch')).toBe(true)
    expect(localIsCorrect(tf, 'richtig')).toBe(false)
    const speak: SkillExerciseItem = { type: 'SPEAKING_REPEAT' }
    expect(localIsCorrect(speak, 'spoken')).toBe(true)
    expect(localIsCorrect(speak, undefined)).toBe(false)
  })

  test('buildSkillAnswers keys by index, defaults speaking to spoken and untouched gradeable to empty', () => {
    const answers = {
      'HOEREN:0': 1,
      'HOEREN:1': 'Morgen',
      'LESEN:0': 'falsch',
      'SCHREIBEN:0': 'Ich esse ein Brötchen',
      // SPRECHEN:0 untouched -> should default to "spoken"
    }
    const body = buildSkillAnswers(se, answers)
    expect(body.HOEREN['0']).toEqual({ answer: 1 })
    expect(body.HOEREN['1']).toEqual({ answer: 'Morgen' })
    expect(body.SPRECHEN['0']).toEqual({ answer: 'spoken' }) // speaking default
    expect(body.LESEN['0']).toEqual({ answer: 'falsch' })
    expect(body.SCHREIBEN['0']).toEqual({ answer: 'Ich esse ein Brötchen' })
  })

  test('buildSkillAnswers sends empty string for untouched gradeable items (graded wrong)', () => {
    const body = buildSkillAnswers(se, {})
    expect(body.HOEREN['0']).toEqual({ answer: '' }) // untouched choice
    expect(body.SPRECHEN['0']).toEqual({ answer: 'spoken' }) // untouched speaking still attempted
  })

  test('buildSkillAnswers omits skills with no items', () => {
    const body = buildSkillAnswers({ HOEREN: [{ type: 'DICTATION', correct_answer: 'x' }], SPRECHEN: [] }, {})
    expect(Object.keys(body)).toEqual(['HOEREN'])
  })

  test('hiddenPromptOf surfaces the question/statement the instruction header hides', () => {
    // READ_AND_CHOOSE: instruction shown in header → the real question must be surfaced
    expect(
      hiddenPromptOf({ type: 'READ_AND_CHOOSE', instruction_vi: 'Đọc và chọn', question_vi: 'Anna thích làm gì?' }),
    ).toBe('Anna thích làm gì?')
    // READ_TRUE_FALSE: the German statement to judge must be surfaced
    expect(
      hiddenPromptOf({ type: 'READ_TRUE_FALSE', instruction_vi: 'Đúng/Sai', statement_de: 'Das Wetter ist schlecht.' }),
    ).toBe('Das Wetter ist schlecht.')
    // Hören choice item too
    expect(
      hiddenPromptOf({ type: 'LISTEN_AND_CHOOSE', instruction_vi: 'Nghe và chọn', question_vi: 'Bạn nghe gì?' }),
    ).toBe('Bạn nghe gì?')
  })

  test('hiddenPromptOf returns undefined when there is nothing hidden', () => {
    // Speaking items render their own model/gloss
    expect(
      hiddenPromptOf({ type: 'SPEAKING_RESPONSE', instruction_vi: 'Trả lời', question_de: 'Wie heißt du?', question_vi: 'Tên?' }),
    ).toBeUndefined()
    // No instruction → the header already shows the question, so nothing is hidden
    expect(hiddenPromptOf({ type: 'READ_AND_CHOOSE', question_vi: 'Anna thích làm gì?' })).toBeUndefined()
    // Text/fill items carry their prompt elsewhere (sentence_vi / sentence_with_blank), not question_vi/statement_de
    expect(hiddenPromptOf({ type: 'TRANSLATE_VI_DE', instruction_vi: 'Dịch', sentence_vi: 'Tôi đọc sách.' })).toBeUndefined()
  })
})
