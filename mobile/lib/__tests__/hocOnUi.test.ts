import {
  activeLessonTab,
  answeredScored,
  diffMiddle,
  errorMetaLine,
  exerciseKinds,
  lessonEyebrow,
  lessonTabs,
  nodeStatusBadge,
  skillAnswered,
  splitMarkTitle,
  vocabStatusLabel,
} from '@/lib/hocOnUi'

describe('lessonTabs', () => {
  it('chỉ giữ thẻ có nội dung, ghi số từ vựng vào nhãn', () => {
    expect(lessonTabs({ theory: 2, vocab: 12, phrases: 0 })).toEqual([
      { key: 'theory', label: 'Lý thuyết' },
      { key: 'vocab', label: 'Từ vựng · 12' },
    ])
  })

  it('trả mảng rỗng khi bài không có gì', () => {
    expect(lessonTabs({ theory: 0, vocab: 0, phrases: 0 })).toEqual([])
  })
})

describe('activeLessonTab', () => {
  const tabs = lessonTabs({ theory: 1, vocab: 3, phrases: 2 })

  it('mặc định là thẻ đầu tiên', () => {
    expect(activeLessonTab(tabs, null, 7)).toBe('theory')
  })

  it('giữ lựa chọn của đúng bài đó', () => {
    expect(activeLessonTab(tabs, { nodeId: 7, tab: 'phrases' }, 7)).toBe('phrases')
  })

  it('sang bài khác thì bỏ lựa chọn cũ (màn không unmount)', () => {
    expect(activeLessonTab(tabs, { nodeId: 7, tab: 'phrases' }, 8)).toBe('theory')
  })

  it('lựa chọn trỏ tới thẻ không còn nội dung thì về thẻ đầu', () => {
    const onlyVocab = lessonTabs({ theory: 0, vocab: 3, phrases: 0 })
    expect(activeLessonTab(onlyVocab, { nodeId: 7, tab: 'phrases' }, 7)).toBe('vocab')
  })

  it('không có thẻ nào thì trả null', () => {
    expect(activeLessonTab([], null, 7)).toBeNull()
  })
})

describe('splitMarkTitle', () => {
  it('tô từ cuối', () => {
    expect(splitMarkTitle('Perfekt mit sein und haben')).toEqual({ lead: 'Perfekt mit sein und', mark: 'haben' })
  })

  it('một từ thì tô cả từ', () => {
    expect(splitMarkTitle('  Dativ ')).toEqual({ lead: '', mark: 'Dativ' })
  })

  it('chuỗi rỗng', () => {
    expect(splitMarkTitle('   ')).toEqual({ lead: '', mark: '' })
  })
})

describe('nodeStatusBadge', () => {
  it('ánh xạ trạng thái bài học', () => {
    expect(nodeStatusBadge('COMPLETED')).toEqual({ label: 'Đã hoàn thành', tone: 'green' })
    expect(nodeStatusBadge('IN_PROGRESS')).toEqual({ label: 'Đang học', tone: 'yellow' })
    expect(nodeStatusBadge('AVAILABLE')).toEqual({ label: 'Bắt đầu', tone: 'neutral' })
    expect(nodeStatusBadge(undefined)).toEqual({ label: 'Bắt đầu', tone: 'neutral' })
  })
})

describe('lessonEyebrow', () => {
  it('ghép cấp và tên tiếng Đức, bỏ phần trống', () => {
    expect(lessonEyebrow('A2', 'Perfekt')).toBe('A2 · Perfekt')
    expect(lessonEyebrow('A2', '  ')).toBe('A2')
    expect(lessonEyebrow(null, undefined)).toBe('')
  })
})

describe('exerciseKinds', () => {
  it('giữ thứ tự xuất hiện, không lặp, bỏ dạng lạ', () => {
    expect(exerciseKinds(['FILL_BLANK', 'MULTIPLE_CHOICE', 'FILL_BLANK', 'XYZ', 'REORDER'])).toEqual([
      'Điền chỗ trống',
      'Chọn đáp án',
      'Sắp xếp',
    ])
  })
})

describe('answeredScored', () => {
  const ex = [
    { id: 'a', type: 'MULTIPLE_CHOICE' },
    { id: 'b', type: 'FILL_BLANK' },
    { id: 'c', type: 'TRANSLATE' },
    { id: 'd', type: 'FILL_BLANK' },
  ]

  it('chỉ đếm câu được chấm đã trả lời; chọn phương án 0 vẫn tính', () => {
    expect(answeredScored(ex, { a: { choice: 0 }, b: { text: 'bin' }, c: { text: 'x' }, d: { text: '   ' } })).toBe(2)
  })

  it('chưa trả lời gì là 0', () => {
    expect(answeredScored(ex, {})).toBe(0)
  })
})

describe('skillAnswered', () => {
  it('đếm số, chuỗi khác rỗng và bản ghi âm "spoken"', () => {
    const answers = { 'HOEREN:0': 0, 'HOEREN:1': '', 'HOEREN:2': 'spoken', 'LESEN:0': 'x' }
    expect(skillAnswered('HOEREN', 3, answers)).toBe(2)
    expect(skillAnswered('LESEN', 2, answers)).toBe(1)
    expect(skillAnswered('SCHREIBEN', 1, answers)).toBe(0)
  })
})

describe('vocabStatusLabel', () => {
  it('ánh xạ trạng thái SRS', () => {
    expect(vocabStatusLabel('NEW')).toBe('Mới')
    expect(vocabStatusLabel('LEARNING')).toBe('Đang học')
    expect(vocabStatusLabel('REVIEWING')).toBe('Đang học')
    expect(vocabStatusLabel('MASTERED')).toBe('Đã thuộc')
    expect(vocabStatusLabel(undefined)).toBeNull()
  })
})

describe('diffMiddle', () => {
  it('tách đoạn sai ở giữa câu', () => {
    expect(diffMiddle('Ich arbeite seit drei Jahre im Krankenhaus.', 'Ich arbeite seit drei Jahren im Krankenhaus.')).toEqual({
      before: 'Ich arbeite seit drei',
      wrong: 'Jahre',
      right: 'Jahren',
      after: 'im Krankenhaus.',
    })
  })

  it('đoạn sai nhiều từ, khác độ dài', () => {
    expect(diffMiddle('Ich bin zuständig von Pflege.', 'Ich bin zuständig für die Pflege.')).toEqual({
      before: 'Ich bin zuständig',
      wrong: 'von',
      right: 'für die',
      after: 'Pflege.',
    })
  })

  it('thiếu từ (chèn thêm) thì đoạn sai rỗng', () => {
    expect(diffMiddle('Ich gehe Hause.', 'Ich gehe nach Hause.')).toEqual({ before: 'Ich gehe', wrong: '', right: 'nach', after: 'Hause.' })
  })

  it('hai câu giống nhau hoặc thiếu câu thì trả null', () => {
    expect(diffMiddle('Hallo  Welt', 'Hallo Welt')).toBeNull()
    expect(diffMiddle(null, 'Hallo')).toBeNull()
    expect(diffMiddle('Hallo', '')).toBeNull()
  })
})

describe('errorMetaLine', () => {
  it('có và không có chu kỳ', () => {
    expect(errorMetaLine(3, 2)).toBe('Mắc 3 lần · chu kỳ 2 ngày')
    expect(errorMetaLine(1)).toBe('Mắc 1 lần')
  })
})
