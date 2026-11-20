import {
  isMicCheckedThisRun, markMicChecked, createSerialQueue, roomNotes,
  coveredCount, createSilenceDetector, findBlueprint, litBars, meterLevel, micStatus, oralSpeaker, partMinutes,
  resultBadge, resultHeadline, resultRows, scoreBar, scoreNote, speakerName, taskPrompts, teilStages, transcriptByTeil,
} from '../oralRoom'
import type { BlueprintSummary, ScoreSheet } from '../examSpeakingApi'

describe('meterLevel', () => {
  it('trả 0 khi im hoặc máy không đo được', () => {
    expect(meterLevel(-160)).toBe(0)
    expect(meterLevel(undefined)).toBe(0)
    expect(meterLevel(Number.NaN)).toBe(0)
  })
  it('trả 1 khi to, tăng dần ở giữa', () => {
    expect(meterLevel(0)).toBe(1)
    const mid = meterLevel(-30)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(meterLevel(-20)).toBeGreaterThan(mid)
  })
  it('litBars kẹp trong 0…số vạch', () => {
    expect(litBars(0, 14)).toBe(0)
    expect(litBars(1, 14)).toBe(14)
    expect(litBars(2, 14)).toBe(14)
    expect(litBars(0.5, 14)).toBe(7)
  })
})

describe('createSilenceDetector', () => {
  it('không cắt khi chưa nói gì, dù im lâu', () => {
    const d = createSilenceDetector()
    for (let t = 0; t <= 10_000; t += 100) expect(d.update(0, t)).toBe(false)
  })
  it('cắt sau khi đã nói rồi im liền 2 giây', () => {
    const d = createSilenceDetector()
    let t = 0
    for (; t <= 1000; t += 100) d.update(0.8, t)
    let stopped = false
    for (; t <= 4000 && !stopped; t += 100) stopped = d.update(0, t)
    expect(stopped).toBe(true)
    expect(t).toBeGreaterThanOrEqual(3000)
  })
  it('một tiếng gõ ngắn không tính là đã nói', () => {
    const d = createSilenceDetector()
    d.update(0, 0)
    d.update(0.9, 100) // 100 ms < 300 ms
    let stopped = false
    for (let t = 200; t <= 5000; t += 100) stopped = stopped || d.update(0, t)
    expect(stopped).toBe(false)
  })
})

describe('thẻ đề', () => {
  it('taskPrompts chỉ lấy chuỗi không rỗng', () => {
    expect(taskPrompts({ prompts: ['Wann?', ' ', 3, 'Wo? '] })).toEqual(['Wann?', 'Wo?'])
    expect(taskPrompts({ topic: 'x' })).toEqual([])
    expect(taskPrompts(null)).toEqual([])
  })
  it('coveredCount bỏ chỉ số sai và trùng', () => {
    expect(coveredCount(['a', 'b', 'c'], [0, 0, 2, 7, -1])).toBe(2)
    expect(coveredCount(['a'], null)).toBe(0)
  })
})

describe('tiến độ Teil', () => {
  it('đánh dấu xong / đang / chưa', () => {
    expect(teilStages(3, 2).map((s) => s.state)).toEqual(['done', 'current', 'todo'])
    expect(teilStages(0, 1)).toHaveLength(1)
  })
  it('partMinutes làm tròn, tối thiểu 1', () => {
    expect(partMinutes(180)).toBe(3)
    expect(partMinutes(20)).toBe(1)
  })
  it('findBlueprint khớp cả hệ và cấp', () => {
    const list = [
      { provider: 'GOETHE', level: 'B1' },
      { provider: 'TELC', level: 'B1' },
    ] as BlueprintSummary[]
    expect(findBlueprint(list, 'TELC', 'B1')).toBe(list[1])
    expect(findBlueprint(list, 'TELC', 'B2')).toBeUndefined()
    expect(findBlueprint(undefined, 'TELC', 'B1')).toBeUndefined()
  })
})

describe('người đang nói', () => {
  it('AI nói thì là AI, không thì là bạn khi đang ghi', () => {
    expect(oralSpeaker('PARTNER', true)).toBe('PARTNER')
    expect(oralSpeaker(null, true)).toBe('ME')
    expect(oralSpeaker(null, false)).toBeNull()
    expect(oralSpeaker('LẠ', false)).toBeNull()
  })
  it('micStatus ưu tiên đang gửi, đang ghi, rồi AI', () => {
    expect(micStatus({ recording: true, uploading: true, aiSpeaking: null, busy: false })).toMatch(/gửi/)
    expect(micStatus({ recording: true, uploading: false, aiSpeaking: null, busy: false })).toMatch(/nghe bạn/)
    expect(micStatus({ recording: false, uploading: false, aiSpeaking: 'PARTNER', busy: false })).toMatch(/Bạn thi/)
    expect(micStatus({ recording: false, uploading: false, aiSpeaking: null, busy: false })).toMatch(/Đến lượt bạn/)
  })
})

const sheet: ScoreSheet = {
  parts: [
    { teilNo: 1, criteria: [], points: 12, max: 15, zeroed: false, comment: 'Giới thiệu đủ ý.' },
    { teilNo: 3, criteria: [], points: 6, max: 15, zeroed: false, comment: '  ' },
  ],
  global: [
    { code: 'AUS', label: 'Aussprache', band: null, points: 5, max: 15, scored: true, evidence: ['', 'ü lẫn'] },
    { code: 'X', label: 'Khác', band: null, points: 0, max: 5, scored: false, evidence: [] },
  ],
  total: 44, totalLow: 42, totalHigh: 46, maxPoints: 75, officialMax: 75, passed: null, passRule: '', errors: [], notes: [],
}

describe('phiếu kết quả', () => {
  it('resultRows: Teil có tên blueprint, tiêu chí chung đã chấm, tô cam khi dưới 60 %', () => {
    const rows = resultRows(sheet, { parts: [{ teilNo: 1, title: 'Kontaktaufnahme' }] as BlueprintSummary['parts'] })
    expect(rows.map((r) => r.badge)).toEqual(['T1', 'T3', 'A'])
    expect(rows[0]).toMatchObject({ title: 'Kontaktaufnahme', note: 'Giới thiệu đủ ý.', low: false })
    expect(rows[1]).toMatchObject({ title: 'Teil 3', note: null, low: true })
    expect(rows[2]).toMatchObject({ title: 'Aussprache', note: 'ü lẫn', low: true })
  })
  it('scoreBar và vạch ngưỡng', () => {
    expect(scoreBar({ total: 45, max: 75 }, 45)).toEqual({ ratio: 0.6, mark: 0.6 })
    expect(scoreBar({ total: null, max: 75 }, null)).toEqual({ ratio: 0, mark: null })
  })
  it('scoreNote nói ngưỡng và dải chấm', () => {
    expect(scoreNote({ totalLow: 42, totalHigh: 46 }, 45, 'BORDERLINE')).toBe('Cần 45 để đỗ phần nói. Hai lượt chấm cho 42–46 điểm, vắt qua ngưỡng đỗ.')
    expect(scoreNote({ totalLow: null, totalHigh: null }, 0, 'NONE')).toBeNull()
  })
  it('tiêu đề và huy hiệu theo kết luận', () => {
    expect(resultHeadline('BORDERLINE').mark).toBe('sát ngưỡng')
    expect(resultHeadline('NONE').after).toBe('')
    expect(resultBadge('FAIL')).toBe('Ước tính · Chưa đủ')
  })
})

describe('xem lại hội thoại', () => {
  it('gom theo Teil, đúng thứ tự, bỏ lời rỗng', () => {
    const groups = transcriptByTeil([
      { teilNo: 2, seq: 5, role: 'CANDIDATE', text: 'b' },
      { teilNo: 1, seq: 2, role: 'CANDIDATE', text: 'a2' },
      { teilNo: 1, seq: 1, role: 'PRUEFER', text: 'a1' },
      { teilNo: 1, seq: 3, role: 'PARTNER', text: '  ' },
    ])
    expect(groups.map((g) => g.teilNo)).toEqual([1, 2])
    expect(groups[0].lines.map((l) => l.text)).toEqual(['a1', 'a2'])
  })
  it('speakerName', () => {
    expect(speakerName('CANDIDATE')).toBe('Bạn')
    expect(speakerName('PARTNER')).toBe('Bạn thi')
    expect(speakerName('PRUEFER')).toBe('Giám khảo')
  })
})

describe('kiểm micro một lần mỗi lần mở app', () => {
  it('chưa kiểm thì false, đánh dấu xong thì true', () => {
    expect(isMicCheckedThisRun()).toBe(false)
    markMicChecked()
    expect(isMicCheckedThisRun()).toBe(true)
  })
})

describe('createSerialQueue', () => {
  it('lệnh sau chỉ bắt đầu khi lệnh trước xong, kể cả lệnh trước lỗi', async () => {
    const q = createSerialQueue()
    const log: string[] = []
    let releaseSave: () => void = () => {}
    const save = q.run(() => new Promise<void>((resolve, reject) => {
      log.push('save:start')
      releaseSave = () => { log.push('save:end'); reject(new Error('mạng')) }
    }))
    const advance = q.run(async () => { log.push('advance:start'); return 'IN_PART' })
    await new Promise((r) => setTimeout(r, 0))
    expect(log).toEqual(['save:start'])
    releaseSave()
    await expect(save).rejects.toThrow('mạng')
    await expect(advance).resolves.toBe('IN_PART')
    expect(log).toEqual(['save:start', 'save:end', 'advance:start'])
  })
})

describe('roomNotes', () => {
  it('lưu lỗi thì bản trên máy (mới hơn) thắng', () => {
    expect(roomNotes('abc', 'abc def', true)).toBe('abc def')
  })
  it('lưu được thì dùng bản server; server rỗng thì dùng bản máy', () => {
    expect(roomNotes('abc', 'abc def', false)).toBe('abc')
    expect(roomNotes(null, ' x ', false)).toBe('x')
    expect(roomNotes('', '', false)).toBeNull()
  })
})
