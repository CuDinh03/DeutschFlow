import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

/**
 * Mã hoá hai kho MMKV cục bộ (`chat-outbox`, `srs-offline`) bằng khoá sinh trên máy.
 *
 * Vì sao cần: MMKV mặc định ghi key-value dạng THÔ ra file, chỉ dựa vào sandbox của
 * hệ điều hành. Hai kho này giữ tin nhắn người dùng chưa gửi và lượt ôn chưa đồng bộ —
 * nội dung do người dùng viết, không phải dữ liệu suy ra được. Thẻ đăng nhập KHÔNG nằm
 * ở đây (đã ở SecureStore từ trước), nên đây là lớp phòng thủ chiều sâu, không phải vá lỗ.
 *
 * ⚠️ Đoạn này chạy ngay lúc mở app. Mọi nhánh đều phải trả về một kho DÙNG ĐƯỢC, kể cả khi
 * keychain lỗi hoặc recrypt ném lỗi — thà chạy không mã hoá như trước còn hơn chặn người
 * dùng vào app.
 *
 * ── Di trú giữ nguyên dữ liệu ────────────────────────────────────────────────────────
 * Người đang dùng bản cũ có kho THÔ với tin chưa gửi trong đó. Mở thẳng kho đó kèm khoá
 * thì MMKV không giải mã được và dữ liệu coi như mất. Nên dùng khoá mốc `__enc_v1`:
 *
 *   1. Mở kèm khoá. Đọc được mốc ⇒ kho đã mã hoá từ lần chạy trước ⇒ dùng luôn.
 *   2. Không thấy mốc ⇒ mở kho THÔ, ghi mốc, rồi `recrypt(key)` — MMKV mã hoá tại chỗ,
 *      giữ nguyên mọi cặp key-value đang có.
 *
 * Ghi mốc TRƯỚC khi recrypt là có chủ đích: nếu app bị tắt giữa chừng, lần mở sau vẫn
 * rơi đúng nhánh 2 và recrypt lại từ kho thô — thao tác lặp lại được, không hỏng dữ liệu.
 * Ghi mốc sau thì một lần tắt máy đúng khe đó sẽ để lại kho đã mã hoá mà không có mốc,
 * và lần sau app sẽ thử recrypt trên kho không đọc được.
 */

const KEY_ITEM = 'df.mmkv_key_v1'
const CANARY_KEY = '__enc_v1'
const CANARY_VALUE = '1'

/** MMKV giới hạn khoá mã hoá 16 byte — xem `Configuration.encryptionKey` của react-native-mmkv. */
const KEY_BYTES = 8 // 8 byte ngẫu nhiên → 16 ký tự hex, chạm đúng trần cho phép

export interface MmkvLike {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  recrypt(key: string | undefined): void
}

export type MmkvFactory = (config: { id: string; encryptionKey?: string }) => MmkvLike

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Khoá mã hoá của thiết bị, sinh một lần rồi giữ trong keychain.
 *
 * Trả `null` khi keychain không dùng được — nơi gọi phải mở kho không mã hoá thay vì
 * ném lỗi, và cũng không được tự bịa khoá từ nguồn ngẫu nhiên yếu.
 */
export function deviceEncryptionKey(): string | null {
  try {
    const existing = SecureStore.getItem(KEY_ITEM)
    if (existing && existing.length > 0) return existing
    const fresh = toHex(Crypto.getRandomBytes(KEY_BYTES))
    SecureStore.setItem(KEY_ITEM, fresh)
    return fresh
  } catch {
    return null
  }
}

/**
 * Mở kho MMKV đã mã hoá, di trú kho thô của bản cũ nếu cần.
 *
 * `create` được tiêm vào để test được luật quyết định mà không cần TurboModule thật.
 */
export function openEncryptedStore(id: string, key: string | null, create: MmkvFactory): MmkvLike {
  if (!key) return create({ id })

  try {
    const encrypted = create({ id, encryptionKey: key })
    if (encrypted.getString(CANARY_KEY) === CANARY_VALUE) return encrypted
  } catch {
    // Mở kèm khoá thất bại → thử đường di trú bên dưới.
  }

  try {
    const plain = create({ id })
    plain.set(CANARY_KEY, CANARY_VALUE)
    plain.recrypt(key)
    return plain
  } catch {
    // Recrypt hỏng (kho lạ, thiết bị hết chỗ…): chạy tiếp không mã hoá thay vì chặn app.
    return create({ id })
  }
}
