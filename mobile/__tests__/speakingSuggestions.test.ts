import { usableSuggestions } from '@/lib/speakingChat'
import type { SpeakingSuggestion } from '@/lib/speakingApi'

// Bug 04/09: wire NON_NULL nên suggestion có thể VẮNG germanText — bản cũ vẫn render chip
// "Dùng →" rỗng rồi đưa undefined vào typewriter (text.slice nổ mỗi tick 26ms, RedBox).
// usableSuggestions là tầng lọc duy nhất trước render — các ca dưới đây khóa hành vi đó.

const sug = (over: Partial<SpeakingSuggestion>): SpeakingSuggestion => ({
  germanText: 'Ich möchte einen Termin vereinbaren.',
  vietnameseTranslation: 'Tôi muốn đặt lịch hẹn.',
  ...over,
})

describe('usableSuggestions', () => {
  test('giữ suggestion có germanText thật', () => {
    const list = [sug({}), sug({ germanText: 'Wann haben Sie Zeit?' })]
    expect(usableSuggestions(list)).toHaveLength(2)
  })

  test('loại suggestion vắng germanText (field absent trên wire NON_NULL)', () => {
    const broken = { vietnameseTranslation: 'Câu mồ côi' } as SpeakingSuggestion
    expect(usableSuggestions([broken, sug({})])).toEqual([sug({})])
  })

  test('loại germanText null và chuỗi toàn khoảng trắng', () => {
    expect(usableSuggestions([sug({ germanText: null }), sug({ germanText: '   ' })])).toEqual([])
  })

  test('cắt còn tối đa `max` phần tử SAU khi lọc — chip hỏng không chiếm suất', () => {
    const broken = sug({ germanText: null })
    const list = [broken, sug({ germanText: 'A' }), sug({ germanText: 'B' }), sug({ germanText: 'C' })]
    expect(usableSuggestions(list).map((s) => s.germanText)).toEqual(['A', 'B'])
  })

  test('list null/undefined → mảng rỗng, không ném lỗi', () => {
    expect(usableSuggestions(null)).toEqual([])
    expect(usableSuggestions(undefined)).toEqual([])
  })
})
