import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { MENTOR_META, getMentorMeta, mentorDisplayName } from '@/lib/mentorMeta'

// Danh sách mã mentor KHÔNG được chép tay vào đây: chép tay thì chính bản chép
// cũng trôi. Test đọc thẳng catalog trong nguồn Java để mỗi lần backend thêm
// mentor mà web quên là đỏ ngay — đúng lỗ đã để lọt 6 mentor nhập môn của F-15
// (commit 63e406cb đụng backend + mobile, không đụng frontend).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const RESOLVER_PATH = resolve(
  REPO_ROOT,
  'backend/src/main/java/com/deutschflow/user/mentor/FixedMentorResolver.java',
)

function backendCatalogCodes(): string[] {
  const src = readFileSync(RESOLVER_PATH, 'utf8')
  // Array.from thay vì spread: tsconfig không đặt `target` nên `tsc --noEmit`
  // chạy ở ES5 và spread iterator là lỗi TS2802.
  const codes = Array.from(src.matchAll(/new MentorPersona\("([A-Z_]+)"/g), (m) => m[1])
  // Chốt chặn: nếu file bị đổi tên/đổi cấu trúc thì regex trả về ít ỏi và test
  // sẽ "xanh giả". Thà đỏ vì không đọc được catalog còn hơn xanh vì đọc trượt.
  if (codes.length < 15) {
    throw new Error(
      `Không đọc được catalog mentor từ ${RESOLVER_PATH} (chỉ thấy ${codes.length} mã). ` +
        'File có thể đã đổi tên hoặc đổi cách khai báo — cập nhật lại test này.',
    )
  }
  return codes
}

describe('MENTOR_META ↔ catalog backend', () => {
  it('có đúng từng mã mentor mà backend có thể trả về, không thiếu không thừa', () => {
    const backend = backendCatalogCodes()
    expect(Array.from(new Set(backend)).sort()).toEqual(Object.keys(MENTOR_META).sort())
  })

  it('phủ đủ 21 mentor của catalog hiện tại', () => {
    expect(backendCatalogCodes()).toHaveLength(21)
    expect(Object.keys(MENTOR_META)).toHaveLength(21)
  })

  it('không mã nào rơi về fallback vô danh', () => {
    // Đây mới là test bắt đúng triệu chứng: thiếu key thì getMentorMeta vẫn trả
    // về một object hợp lệ, chỉ là thẻ mentor mất danh tính nghề.
    for (const code of backendCatalogCodes()) {
      expect(code in MENTOR_META, `mentor ${code} không có trong MENTOR_META`).toBe(true)
      // Chỉ soi tagline: ANNA dùng đúng emoji 🧑‍🏫 của fallback một cách hợp lệ
      // (cô là giáo viên), nên emoji không phải dấu hiệu nhận biết fallback.
      expect(getMentorMeta(code).tagline, `mentor ${code} dùng tagline fallback`).not.toBe(
        'Người đồng hành học tập',
      )
    }
  })

  it('sáu mentor nhập môn F-15 có mặt với đúng emoji và tagline', () => {
    expect(MENTOR_META.JONAS).toEqual({ emoji: '🖥️', tagline: 'Hỗ trợ IT — nhập môn' })
    expect(MENTOR_META.MARIE).toEqual({
      emoji: '🧑‍⚕️',
      tagline: 'Phụ tá điều dưỡng — nhập môn',
    })
    expect(MENTOR_META.TIM).toEqual({ emoji: '🥗', tagline: 'Phụ bếp — nhập môn' })
    expect(MENTOR_META.JULIA).toEqual({ emoji: '📦', tagline: 'Phụ việc sản xuất — nhập môn' })
    // FELIX là ngoại lệ có chủ ý: vai Azubi nên kết bằng "học việc", đừng "sửa
    // cho đều" thành "nhập môn" — mobile cũng ghi như vậy.
    expect(MENTOR_META.FELIX).toEqual({ emoji: '🗂️', tagline: 'Văn phòng — học việc' })
    expect(MENTOR_META.MIA).toEqual({ emoji: '📱', tagline: 'Trợ lý mạng xã hội — nhập môn' })
  })

  it('giữ emoji ghép ZWJ nguyên vẹn', () => {
    // 🧑‍⚕️ = U+1F9D1 U+200D U+2695 U+FE0F. Đi qua editor/tool trung gian rất dễ
    // vỡ thành hai emoji rời, và mắt thường không phân biệt được.
    expect(Array.from(MENTOR_META.MARIE.emoji, (c) => c.codePointAt(0)?.toString(16))).toEqual([
      '1f9d1',
      '200d',
      '2695',
      'fe0f',
    ])
  })
})

describe('getMentorMeta / mentorDisplayName', () => {
  it('trả fallback cho mã rỗng hoặc lạ', () => {
    const fallback = { emoji: '🧑‍🏫', tagline: 'Người đồng hành học tập' }
    expect(getMentorMeta(null)).toEqual(fallback)
    expect(getMentorMeta(undefined)).toEqual(fallback)
    expect(getMentorMeta('')).toEqual(fallback)
    expect(getMentorMeta('KHONG_TON_TAI')).toEqual(fallback)
  })

  it('viết hoa chữ đầu của mã thành tên hiển thị', () => {
    expect(mentorDisplayName('JONAS')).toBe('Jonas')
    expect(mentorDisplayName('ANNA')).toBe('Anna')
  })
})
