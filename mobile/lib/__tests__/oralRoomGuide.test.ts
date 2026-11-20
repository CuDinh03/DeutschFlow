// Hướng dẫn phòng thi nói (UI-MOB-V34-25, AC-MOBV34-41): cờ "đã xem" nhớ theo máy, đọc hỏng ⇒ coi như đã xem.

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v)
    }),
  }
})

import * as SecureStore from 'expo-secure-store'
import { ORAL_GUIDE_STEPS, markOralGuideSeen, readOralGuideSeen } from '../oralRoomGuide'

const mocked = SecureStore as unknown as {
  __store: Map<string, string>
  getItemAsync: jest.Mock
  setItemAsync: jest.Mock
}

beforeEach(() => {
  mocked.__store.clear()
  mocked.getItemAsync.mockClear()
  mocked.setItemAsync.mockClear()
})

describe('readOralGuideSeen', () => {
  it('chưa có cờ thì là chưa xem (tự mở hướng dẫn lần đầu)', async () => {
    await expect(readOralGuideSeen()).resolves.toBe(false)
  })

  it('đã đánh dấu thì là đã xem', async () => {
    await markOralGuideSeen()
    await expect(readOralGuideSeen()).resolves.toBe(true)
  })

  it('đọc lỗi thì coi như đã xem — không chặn luồng thi bằng hộp thoại', async () => {
    mocked.getItemAsync.mockRejectedValueOnce(new Error('keychain'))
    await expect(readOralGuideSeen()).resolves.toBe(true)
  })

  it('giá trị lạ không tính là đã xem', async () => {
    mocked.__store.set('df_oral_room_guide_seen', 'x')
    await expect(readOralGuideSeen()).resolves.toBe(false)
  })
})

describe('markOralGuideSeen', () => {
  it('ghi lỗi thì nuốt, không ném ra màn thi', async () => {
    mocked.setItemAsync.mockRejectedValueOnce(new Error('keychain'))
    await expect(markOralGuideSeen()).resolves.toBeUndefined()
  })
})

describe('ORAL_GUIDE_STEPS', () => {
  it('đủ 4 bước theo đặc tả: Ba phần thi, Nút micro, Tự dừng khi im, Thẻ đề', () => {
    expect(ORAL_GUIDE_STEPS.map((s) => s.title)).toEqual(['Ba phần thi', 'Nút micro', 'Tự dừng khi im', 'Thẻ đề'])
    for (const s of ORAL_GUIDE_STEPS) expect(s.body.trim().length).toBeGreaterThan(20)
  })

  it('bước tự dừng gọi đúng tên công tắc (tấm dưới không có spotlight chỉ vào)', () => {
    expect(ORAL_GUIDE_STEPS[2].body).toContain('Tự dừng khi im')
  })
})
