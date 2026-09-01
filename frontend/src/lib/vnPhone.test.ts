import { describe, expect, test } from 'vitest'
import { isValidVnPhone, normalizeVnPhone, VN_PHONE_RE } from '@/lib/vnPhone'

describe('normalizeVnPhone', () => {
  test('giữ nguyên số đã ở dạng chuẩn', () => {
    expect(normalizeVnPhone('0912345678')).toBe('0912345678')
  })

  test('bỏ dấu cách người dùng gõ giữa các cụm số', () => {
    expect(normalizeVnPhone('0912 345 678')).toBe('0912345678')
  })

  test('bỏ khoảng trắng thừa hai đầu do dán hoặc autofill', () => {
    expect(normalizeVnPhone('  0912345678  ')).toBe('0912345678')
  })

  test('bỏ gạch nối, dấu chấm và ngoặc', () => {
    expect(normalizeVnPhone('0912-345-678')).toBe('0912345678')
    expect(normalizeVnPhone('0912.345.678')).toBe('0912345678')
    expect(normalizeVnPhone('(091) 234 5678')).toBe('0912345678')
  })

  test('quy mã quốc gia +84 về dạng nội địa', () => {
    expect(normalizeVnPhone('+84912345678')).toBe('0912345678')
    expect(normalizeVnPhone('+84 912 345 678')).toBe('0912345678')
  })

  test('quy mã quốc gia 84 (không dấu cộng) về dạng nội địa', () => {
    expect(normalizeVnPhone('84912345678')).toBe('0912345678')
  })

  test('KHÔNG cắt nhầm số nội địa đầu 08', () => {
    expect(normalizeVnPhone('0849123456')).toBe('0849123456')
  })

  test('chuỗi rỗng trả về rỗng, không ném lỗi', () => {
    expect(normalizeVnPhone('')).toBe('')
  })
})

describe('isValidVnPhone', () => {
  test.each([
    ['0912345678', 'dạng chuẩn'],
    ['0912 345 678', 'có dấu cách — ca gây ngõ cụt đăng ký (F-07)'],
    ['  0912345678  ', 'có khoảng trắng hai đầu — backend vốn đã chấp nhận (F-08)'],
    ['+84912345678', 'mã quốc gia có dấu cộng'],
    ['84912345678', 'mã quốc gia không dấu cộng'],
    ['0312345678', 'đầu số 03'],
    ['0512345678', 'đầu số 05'],
    ['0712345678', 'đầu số 07'],
    ['0812345678', 'đầu số 08'],
  ])('chấp nhận %s (%s)', (input) => {
    expect(isValidVnPhone(input)).toBe(true)
  })

  test.each([
    ['0212345678', 'đầu số cố định 02 không phải di động'],
    ['0612345678', 'đầu số 06 đã bị thu hồi'],
    ['091234567', 'thiếu một chữ số'],
    ['09123456789', 'thừa một chữ số'],
    ['1912345678', 'không bắt đầu bằng 0'],
    ['09123abcde', 'lẫn chữ cái'],
    ['', 'bỏ trống'],
  ])('từ chối %s (%s)', (input) => {
    expect(isValidVnPhone(input)).toBe(false)
  })

  test('giá trị đã chuẩn hoá là thứ khớp regex — dùng được luôn làm payload gửi backend', () => {
    const normalized = normalizeVnPhone('0912 345 678')
    expect(VN_PHONE_RE.test(normalized)).toBe(true)
  })
})
