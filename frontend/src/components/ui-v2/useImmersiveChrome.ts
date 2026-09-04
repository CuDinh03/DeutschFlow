'use client'

import * as React from 'react'

/**
 * useImmersiveChrome — gỡ chrome của role shell trong lúc một MODE SHELL đang mở
 * (ExamShell của S-09, InterviewShell của S-06, StudioShell của S-07).
 *
 * Mode shell là lớp phủ `fixed inset-0`, nên role shell vẫn NẰM TRONG DOM phía sau: che được
 * bằng mắt nhưng vẫn tab vào được, và một phép kiểm DOM vẫn thấy nav — tức hợp đồng "0 nav toàn
 * cục" chưa thật. Cờ này khiến `[data-ga-chrome]` bị `display:none` (xem galerie.css): mất khỏi
 * cả tab order lẫn cây accessibility.
 *
 * Gắn theo TRẠNG THÁI chứ không theo route: `/v2/student/mock-exam/run` còn phục vụ màn danh
 * sách và màn kết quả, `/v2/student/interviews` còn phục vụ màn chủ — những màn đó VẪN cần nav.
 *
 * Đếm tham chiếu vì có lúc hai mode shell chồng nhau trong một nhịp chuyển màn; nếu chỉ set/remove
 * thì cái unmount sau sẽ gỡ cờ của cái vừa mount và nav lóe ra giữa phiên.
 */
const ATTR = 'data-immersive-mode'
let mounted = 0

/**
 * `active = false` để component chỉ gỡ chrome trong MỘT phần vòng đời của nó — ví dụ engine luyện
 * nói: gỡ khi đang trong phiên, trả lại khi đã sang màn tổng kết (màn đó là báo cáo, người dùng
 * cần nav để đi tiếp).
 */
export function useImmersiveChrome(active = true): void {
  React.useEffect(() => {
    if (!active) return
    mounted += 1
    document.body.setAttribute(ATTR, 'on')
    return () => {
      mounted -= 1
      if (mounted <= 0) {
        mounted = 0
        document.body.removeAttribute(ATTR)
      }
    }
  }, [active])
}
