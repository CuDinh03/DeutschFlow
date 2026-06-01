import { mapGrammarTopic, type RawGrammarTopic } from '@/lib/grammarApi'

const base: RawGrammarTopic = {
  id: 12,
  cefr_level: 'A1',
  topic_code: 'NOM_CASE',
  title_de: 'Nominativ',
  title_vi: 'Cách Nominativ',
  description_vi: 'Chủ ngữ của câu',
  mastery_percent: 100,
}

describe('mapGrammarTopic', () => {
  it('prefers the Vietnamese title and stringifies the id', () => {
    const t = mapGrammarTopic(base)
    expect(t.id).toBe('12')
    expect(t.title).toBe('Cách Nominativ')
    expect(t.cefrLevel).toBe('A1')
    expect(t.category).toBe('NOM_CASE')
    expect(t.summary).toBe('Chủ ngữ của câu')
  })

  it('falls back to the German title when title_vi is empty', () => {
    expect(mapGrammarTopic({ ...base, title_vi: '' }).title).toBe('Nominativ')
  })

  it('marks completed only at 100% mastery and tolerates null summary', () => {
    expect(mapGrammarTopic({ ...base, mastery_percent: 99 }).isCompleted).toBe(false)
    expect(mapGrammarTopic({ ...base, mastery_percent: 100 }).isCompleted).toBe(true)
    expect(mapGrammarTopic({ ...base, description_vi: null }).summary).toBe('')
  })
})
