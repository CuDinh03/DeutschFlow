// Chân trang Hồ sơ: phiên bản đọc từ native + mã OTA, thay chuỗi gõ cứng "v1.0.0" (owner phát hiện 06/09).

import { formatAppVersion } from '@/lib/appVersion'

describe('formatAppVersion', () => {
  it('bản OTA: version · build · 8 ký tự đầu updateId', () => {
    expect(formatAppVersion({ version: '1.0.1', build: '17', updateId: '01a0731a-d1de-70bf-b28d-7b664b4f5aa9', isEmbeddedLaunch: false }))
      .toBe('MyDeutschFlow v1.0.1 · build 17 · OTA 01a0731a')
  })

  it('chạy bundle gốc trong build (chưa nhận OTA): không có phần OTA', () => {
    expect(formatAppVersion({ version: '1.0.1', build: '17', updateId: null, isEmbeddedLaunch: true }))
      .toBe('MyDeutschFlow v1.0.1 · build 17')
    expect(formatAppVersion({ version: '1.0.1', build: '17', updateId: 'abc', isEmbeddedLaunch: true }))
      .toBe('MyDeutschFlow v1.0.1 · build 17')
  })

  it('dev client / Expo Go: không có version native → "dev", bỏ build rỗng', () => {
    expect(formatAppVersion({ version: null, build: null, updateId: null, isEmbeddedLaunch: true }))
      .toBe('MyDeutschFlow dev')
  })
})
