import { deviceEncryptionKey, openEncryptedStore, type MmkvLike } from '../secureMmkv'
// Nhập thẳng file mock: `tsc` đọc kiểu của gói THẬT (không qua moduleNameMapper của jest),
// nên hai hàm reset chỉ nhìn thấy được qua đường dẫn tương đối. Jest map cùng file nên vẫn
// là cùng một instance với module mà lib/secureMmkv.ts nạp.
import { __resetSecureStoreMock } from '../../test/mocks/expo-secure-store'
import { __resetCryptoMock } from '../../test/mocks/expo-crypto'

/**
 * Kho giả mô phỏng đúng điểm đau của MMKV thật: mở kèm khoá SAI (hoặc mở kèm khoá một kho
 * chưa mã hoá) thì đọc ra rỗng chứ không ném lỗi — nên luật quyết định phải dựa vào khoá mốc.
 */
class FakeStore implements MmkvLike {
  constructor(
    private readonly disk: Map<string, string>,
    private openedWith: string | undefined,
    private readonly state: { key: string | undefined; recryptFails?: boolean },
  ) {}

  private get readable(): boolean {
    return this.openedWith === this.state.key
  }

  getString(key: string): string | undefined {
    return this.readable ? this.disk.get(key) : undefined
  }

  set(key: string, value: string): void {
    if (this.readable) this.disk.set(key, value)
  }

  recrypt(key: string | undefined): void {
    if (this.state.recryptFails) throw new Error('recrypt failed')
    // MMKV thật: sau recrypt chính instance này giữ khoá mới và vẫn đọc được dữ liệu.
    this.state.key = key
    this.openedWith = key
  }
}

function makeDisk(opts: { encrypted?: string; recryptFails?: boolean } = {}) {
  const disk = new Map<string, string>()
  const state = { key: opts.encrypted, recryptFails: opts.recryptFails }
  const opens: Array<string | undefined> = []
  const create = (cfg: { id: string; encryptionKey?: string }) => {
    opens.push(cfg.encryptionKey)
    return new FakeStore(disk, cfg.encryptionKey, state)
  }
  return { disk, state, opens, create }
}

beforeEach(() => {
  __resetSecureStoreMock()
  __resetCryptoMock()
})

describe('deviceEncryptionKey', () => {
  it('sinh khoá 16 ký tự đúng trần 16 byte của MMKV và giữ lại cho lần sau', () => {
    const first = deviceEncryptionKey()
    expect(first).toHaveLength(16)
    expect(Buffer.byteLength(first as string, 'utf8')).toBeLessThanOrEqual(16)
    expect(deviceEncryptionKey()).toBe(first)
  })
})

describe('openEncryptedStore', () => {
  it('mở thẳng kho đã mã hoá từ lần chạy trước, không recrypt lại', () => {
    const { disk, state, opens, create } = makeDisk({ encrypted: 'key-abc' })
    disk.set('__enc_v1', '1')
    disk.set('offline_srs_queue', '[{"vocabId":"1"}]')

    const store = openEncryptedStore('srs-offline', 'key-abc', create)

    expect(store.getString('offline_srs_queue')).toBe('[{"vocabId":"1"}]')
    expect(opens).toEqual(['key-abc'])
    expect(state.key).toBe('key-abc')
  })

  it('di trú kho thô của bản cũ mà giữ nguyên dữ liệu đang chờ', () => {
    const { disk, state, create } = makeDisk()
    disk.set('outbox', '[{"text":"tin chưa gửi"}]')

    const store = openEncryptedStore('chat-outbox', 'key-abc', create)

    expect(state.key).toBe('key-abc')
    expect(store.getString('outbox')).toBe('[{"text":"tin chưa gửi"}]')
    expect(disk.get('__enc_v1')).toBe('1')
  })

  it('lặp lại được khi app bị tắt giữa chừng: mốc đã ghi nhưng chưa recrypt', () => {
    const { disk, state, create } = makeDisk()
    disk.set('__enc_v1', '1') // dấu vết lần di trú dở
    disk.set('outbox', '[{"text":"còn nguyên"}]')

    const store = openEncryptedStore('chat-outbox', 'key-abc', create)

    expect(state.key).toBe('key-abc')
    expect(store.getString('outbox')).toBe('[{"text":"còn nguyên"}]')
  })

  it('vẫn trả kho dùng được khi recrypt ném lỗi, không chặn app khởi động', () => {
    const { disk, create } = makeDisk({ recryptFails: true })
    disk.set('outbox', '[{"text":"giữ lại"}]')

    const store = openEncryptedStore('chat-outbox', 'key-abc', create)

    expect(store.getString('outbox')).toBe('[{"text":"giữ lại"}]')
  })

  it('không có khoá thiết bị thì mở kho thô như trước, không ném lỗi', () => {
    const { disk, opens, create } = makeDisk()
    disk.set('outbox', '[]')

    const store = openEncryptedStore('chat-outbox', null, create)

    expect(opens).toEqual([undefined])
    expect(store.getString('outbox')).toBe('[]')
  })
})
