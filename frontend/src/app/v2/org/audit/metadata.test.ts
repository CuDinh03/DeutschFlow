import { describe, it, expect } from 'vitest'
import { parseAuditMetadata, humanizeMetaKey } from '@/app/v2/org/audit/metadata'

/**
 * `metadata_json` là cột duy nhất nói "đã đổi cái gì thành cái gì". Nó do ~60 điểm gọi tự ghi, KHÔNG
 * có schema chung, nên hợp đồng quan trọng nhất của hàm đọc là: không ném lỗi và không làm mất bằng
 * chứng — dòng vết hỏng định dạng vẫn phải hiện ra được.
 */
describe('parseAuditMetadata — đọc metadata_json thành cặp khoá–giá trị', () => {
  it('map phẳng → mỗi khoá một cặp, giữ nguyên thứ tự máy chủ ghi', () => {
    const pairs = parseAuditMetadata('{"fromStatus":"ACTIVE","toStatus":"SUSPENDED","seatLimit":30}')

    expect(pairs.map((p) => p.key)).toEqual(['fromStatus', 'toStatus', 'seatLimit'])
    expect(pairs.map((p) => p.value)).toEqual(['ACTIVE', 'SUSPENDED', '30'])
    expect(pairs[0].label).toBe('From status')
  })

  it('rỗng / null / "{}" → không có cặp nào (màn hiện dấu gạch, không hiện ô trống)', () => {
    expect(parseAuditMetadata(null)).toEqual([])
    expect(parseAuditMetadata('')).toEqual([])
    expect(parseAuditMetadata('   ')).toEqual([])
    expect(parseAuditMetadata('{}')).toEqual([])
    expect(parseAuditMetadata('[]')).toEqual([])
  })

  it('bỏ giá trị null / chuỗi rỗng — chúng chỉ làm nhiễu chứ không nói thêm điều gì', () => {
    const pairs = parseAuditMetadata('{"reason":null,"note":"","role":"TEACHER"}')

    expect(pairs).toHaveLength(1)
    expect(pairs[0].key).toBe('role')
  })

  it('JSON hỏng KHÔNG làm mất dòng: trả nguyên văn thành một cặp không khoá', () => {
    const pairs = parseAuditMetadata('imported 12 rows')

    expect(pairs).toHaveLength(1)
    expect(pairs[0].key).toBe('')
    expect(pairs[0].label).toBe('')
    expect(pairs[0].value).toBe('imported 12 rows')
  })

  it('giá trị lồng (object/mảng) được gói gọn thay vì mất', () => {
    const pairs = parseAuditMetadata('{"changed":{"seatLimit":30},"ids":[1,2]}')

    expect(pairs[0].value).toBe('{"seatLimit":30}')
    expect(pairs[1].value).toBe('[1,2]')
  })

  it('giá trị dài bị cắt để không kéo dài một dòng bảng, nguyên văn giữ ở `full`', () => {
    const long = 'x'.repeat(200)
    const [pair] = parseAuditMetadata(JSON.stringify({ note: long }))

    expect(pair.value.length).toBeLessThan(long.length)
    expect(pair.value.endsWith('…')).toBe(true)
    expect(pair.full).toBe(long)
  })
})

describe('humanizeMetaKey', () => {
  it('tách camelCase và snake_case thành câu đọc được', () => {
    expect(humanizeMetaKey('monthlyTokenPool')).toBe('Monthly token pool')
    expect(humanizeMetaKey('seat_limit')).toBe('Seat limit')
    expect(humanizeMetaKey('role')).toBe('Role')
  })
})
