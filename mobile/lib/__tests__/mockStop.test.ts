import { parseStopResult, stopResultFromDetailed, stopPreview, stopPreviewMessage, stoppedRows, stoppedSummary, touchedAny } from '../mockStop'
import { flaggedEntries, itemShortLabel } from '../mockFlags'
import { mergeFlags, parseFlags, toggleFlag, classifyDraftSaveError } from '../mockRun'
import { attemptStartFrom } from '../attemptDraft'

describe('dừng giữa chừng', () => {
  it('đọc thân /stop của server', () => {
    const r = parseStopResult({
      attempt_id: 9, exam_id: 3, status: 'PARTIAL', reason: 'STOPPED', already_closed: false,
      teile_done: 2, teile_counted: 1, teile_total: 4,
      teile: [
        { key: 'LESEN-1', status: 'SCORED', score: 20, max: 25, answered: 5, total: 5 },
        { key: 'SCHREIBEN-1', status: 'WRITTEN_NOT_GRADED', score: null, max: 45, answered: 1, total: 1 },
        { key: 'LESEN-2', status: 'NOT_ATTEMPTED', score: null, max: 25, answered: 0, total: 5 },
      ],
    })
    expect(r).toMatchObject({ attemptId: 9, status: 'PARTIAL', alreadyClosed: false, teileCounted: 1, teileTotal: 4 })
    expect(stoppedRows(r)).toEqual([
      { key: 'LESEN-1', name: 'Lesen Teil 1', value: '20/25 điểm', counted: true },
      { key: 'SCHREIBEN-1', name: 'Schreiben', value: 'Viết dở, không chấm', counted: false },
      { key: 'LESEN-2', name: 'Lesen Teil 2', value: 'Chưa làm', counted: false },
    ])
    expect(stoppedSummary(r)).toBe('Tính 1/4 Teil')
  })

  it('lượt dừng ở nơi khác: đọc điểm từng Teil từ detailed_scores_json', () => {
    const json = JSON.stringify({
      partial: { reason: 'STOPPED', teile_done: 1, teile_counted: 1, teile_total: 2 },
      teile: { 'LESEN-1': { status: 'SCORED', score: 15, max: 25, answered: 5, total: 5 }, 'HOEREN-1': { status: 'NOT_ATTEMPTED', max: 25, answered: 0, total: 5 } },
    })
    const r = stopResultFromDetailed(7, json)
    expect(r).toMatchObject({ attemptId: 7, status: 'PARTIAL', alreadyClosed: true, teileCounted: 1, teileTotal: 2 })
    expect(stoppedRows(r!).map((x) => x.value)).toEqual(['15/25 điểm', 'Chưa làm'])
    expect(stopResultFromDetailed(7, '{"LESEN": {"total": 3, "max": 25}}')).toBeNull()
    expect(stopResultFromDetailed(7, 'không phải json')).toBeNull()
    expect(stopResultFromDetailed(7, null)).toBeNull()
  })

  it('thân lạ không làm văng', () => {
    expect(parseStopResult(null)).toMatchObject({ attemptId: 0, status: '', alreadyClosed: false, teile: [] })
    expect(parseStopResult({ status: 'CANCELLED', already_closed: true }).alreadyClosed).toBe(true)
  })

  it('hộp xác nhận nói rõ Teil nào tính, Teil nào không', () => {
    const p = stopPreview([
      { key: 'LESEN-1', writing: false, answered: 3, total: 5 },
      { key: 'LESEN-2', writing: false, answered: 0, total: 5 },
      { key: 'SCHREIBEN-1', writing: true, answered: 1, total: 1 },
    ])
    expect(p).toEqual({ counted: ['Lesen Teil 1'], writingUngraded: ['Schreiben'], untouched: ['Lesen Teil 2'] })
    const msg = stopPreviewMessage(p)
    expect(msg).toContain('Được chấm: Lesen Teil 1.')
    expect(msg).toContain('Bài viết dở không được chấm: Schreiben.')
    expect(msg).toContain('Không tính: Lesen Teil 2.')
  })

  it('chưa chạm câu nào thì dừng = huỷ, không hỏi', () => {
    expect(touchedAny({})).toBe(false)
    expect(touchedAny({ a: '  ' })).toBe(false)
    expect(touchedAny({ a: 'b' })).toBe(true)
  })
})

describe('cờ đánh dấu xem lại', () => {
  it('bật/tắt và đọc từ server', () => {
    expect(toggleFlag(['1'], '2')).toEqual(['1', '2'])
    expect(toggleFlag(['1', '2'], '1')).toEqual(['2'])
    expect(parseFlags(['1', '', 3, '4'])).toEqual(['1', '4'])
    expect(parseFlags(null)).toEqual([])
  })

  it('gộp ba chiều: cờ máy vừa đổi giữ theo máy, còn lại theo server (web)', () => {
    // acked {1,2}; máy bỏ 2, thêm 5; web bỏ 1, thêm 3.
    expect(mergeFlags(['1', '5'], ['2', '3'], ['1', '2'])).toEqual(['3', '5'])
    // Máy không đổi gì ⇒ theo server.
    expect(mergeFlags(['1'], ['7'], ['1'])).toEqual(['7'])
  })

  it('409 mang cờ của server; /start mang cờ đang lưu', () => {
    const r = classifyDraftSaveError(409, { server_version: 4, draft: { answers_json: '{}', version: 4, flags: ['12'] } })
    expect(r).toMatchObject({ kind: 'conflict', draft: { flags: ['12'] } })
    const noFlags = classifyDraftSaveError(409, { server_version: 4, draft: { answers_json: '{}', version: 4 } })
    expect(noFlags.kind === 'conflict' && noFlags.draft && 'flags' in noFlags.draft).toBe(false)
    expect(attemptStartFrom({ id: 1, draft: { version: 2, flags: ['3'] } }, 0).flags).toEqual(['3'])
    expect(attemptStartFrom({ id: 1, draft: { version: 2 } }, 0).flags).toBeNull()
  })

  it('danh sách câu đánh dấu theo thứ tự đề, nhãn đọc được', () => {
    const sections = [
      { name: 'LESEN', groups: [{ teilNo: 3, items: [{ id: '15', question: 'A' }, { id: '18', question: 'B' }] }] },
      { name: 'SPRACHBAUSTEINE', groups: [{ teilNo: 2, items: [{ id: 'sb2-4', gap: 34, question: 'Ô trống 34' }] }] },
    ]
    expect(flaggedEntries(sections, ['sb2-4', '18'])).toEqual([
      { id: '18', teil: 'Lesen Teil 3', label: 'Câu 18' },
      { id: 'sb2-4', teil: 'Sprachbausteine Teil 2', label: 'Ô trống 34' },
    ])
    expect(itemShortLabel({ id: 'x', question: 'Sie suchen jemanden, der beim Umzug hilft und Zeit hat.' })).toBe('Sie suchen jemanden, der beim U…')
  })
})
