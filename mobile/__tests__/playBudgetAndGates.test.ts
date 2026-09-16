/**
 * Hai luật phải GIỐNG HỆT bản web, vì cùng một học viên có thể thi trên cả hai:
 *   • số lần được nghe (`frontend/src/components/exam/audioScript.ts`)
 *   • ba trạng thái kết luận khi đề có nhiều ngưỡng (`.../telc/examGates.ts`)
 */
import { describe, it, expect } from '@jest/globals'
import { playsLeft, canPlayAgain } from '@/lib/playBudget'
import { gateVerdict, gateLabel, type ExamGate } from '@/lib/examApi'

const g = (id: string, status: string): ExamGate => ({ id, status, raw: 0, max: 75, min: 45 })

describe('số lần nghe', () => {
  it('không khai thì không giới hạn — mọi đề Goethe giữ nguyên', () => {
    expect(playsLeft(undefined, 9)).toBeNull()
    expect(canPlayAgain(undefined, 9)).toBe(true)
  })

  it('HV Teil 1 một lượt, Teil 2–3 hai lượt', () => {
    expect(canPlayAgain(1, 0)).toBe(true)
    expect(canPlayAgain(1, 1)).toBe(false)
    expect(canPlayAgain(2, 1)).toBe(true)
    expect(canPlayAgain(2, 2)).toBe(false)
  })

  it('giá trị vô nghĩa coi như không giới hạn, không khoá oan học viên', () => {
    expect(playsLeft(0, 3)).toBeNull()
    expect(playsLeft(-1, 3)).toBeNull()
    expect(playsLeft(Number.NaN, 3)).toBeNull()
  })

  it('dùng quá số lượt vẫn kẹp về 0', () => {
    expect(playsLeft(2, 5)).toBe(0)
  })
})

describe('kết luận theo cổng', () => {
  it('đề Goethe không có cổng nào ⇒ null, dùng đường cũ', () => {
    expect(gateVerdict([])).toBeNull()
    expect(gateVerdict(undefined)).toBeNull()
  })

  it('đỗ viết + chưa thi nói là CHƯA ĐỦ KẾT LUẬN, KHÔNG phải trượt', () => {
    expect(gateVerdict([g('written', 'PASSED'), g('oral', 'PENDING')])).toBe('INCOMPLETE')
  })

  it('mọi cổng đạt thì đỗ; một cổng trượt thì trượt', () => {
    expect(gateVerdict([g('written', 'PASSED'), g('oral', 'PASSED')])).toBe('PASSED')
    expect(gateVerdict([g('written', 'PASSED'), g('oral', 'FAILED')])).toBe('FAILED')
  })

  it('cổng TRƯỢT thắng cổng CHỜ', () => {
    expect(gateVerdict([g('written', 'FAILED'), g('oral', 'PENDING')])).toBe('FAILED')
  })

  it('tên cổng là tên người đọc được, cổng lạ dùng nhãn chung', () => {
    expect(gateLabel('written')).toBe('Phần viết')
    expect(gateLabel('oral')).toBe('Phần nói')
    expect(gateLabel('ein_neues_tor')).toBe('Phần khác')
  })
})
