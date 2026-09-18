/**
 * Ba trạng thái của kết luận đỗ/trượt khi đề có nhiều ngưỡng độc lập.
 * Ca quan trọng nhất: đỗ phần viết + chưa thi nói KHÔNG được đọc thành "Trượt".
 */
import { describe, it, expect } from 'vitest'
import { gateVerdict, pendingGates, type ExamGate } from '@/components/exam/telc/examGates'

const g = (id: string, status: ExamGate['status']): ExamGate =>
  ({ id, status, raw: 0, max: 75, min: 45 })

describe('kết luận theo cổng', () => {
  it('đề Goethe không có cổng nào thì trả null — nơi gọi dùng đường cũ', () => {
    expect(gateVerdict([])).toBeNull()
    expect(gateVerdict(undefined)).toBeNull()
  })

  it('mọi cổng ĐẠT thì ĐỖ', () => {
    expect(gateVerdict([g('written', 'PASSED'), g('oral', 'PASSED')])).toBe('PASSED')
  })

  it('có một cổng TRƯỢT thì TRƯỢT, dù cổng kia đạt', () => {
    expect(gateVerdict([g('written', 'PASSED'), g('oral', 'FAILED')])).toBe('FAILED')
  })

  it('đỗ viết + chưa thi nói là CHƯA ĐỦ KẾT LUẬN, KHÔNG phải trượt', () => {
    expect(gateVerdict([g('written', 'PASSED'), g('oral', 'PENDING')])).toBe('INCOMPLETE')
  })

  it('cổng TRƯỢT thắng cổng CHỜ — đã trượt một ngưỡng thì không chờ nữa', () => {
    expect(gateVerdict([g('written', 'FAILED'), g('oral', 'PENDING')])).toBe('FAILED')
  })

  it('nói được còn thiếu phần nào', () => {
    const gates = [g('written', 'PASSED'), g('oral', 'PENDING')]
    expect(pendingGates(gates).map((x) => x.id)).toEqual(['oral'])
    expect(pendingGates([])).toEqual([])
  })
})
