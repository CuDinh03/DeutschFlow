import * as SecureStore from 'expo-secure-store'

// Hướng dẫn phòng thi nói đã xem chưa (mẫu v3.4 nút "?" `data-tour="oral"`; web `useScreenTour`
// key `exam.oral`, owner chốt 07/11/2026: tự mở lần đầu vào Đang thi). Nhớ theo máy; đọc hỏng ⇒
// coi như đã xem (không chặn luồng thi bằng một hộp thoại).

const KEY = 'df_oral_room_guide_seen'

export async function readOralGuideSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1'
  } catch {
    return true
  }
}

export async function markOralGuideSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, '1')
  } catch {
    /* best-effort */
  }
}

/** Các bước hướng dẫn (cùng nội dung web `v2.student.tour.oral`, thêm bước tự dừng khi im của app). */
export const ORAL_GUIDE_STEPS: readonly { title: string; body: string }[] = [
  {
    title: 'Ba phần thi',
    body: 'Thi lần lượt từng Teil, đồng hồ góc phải là giờ của Teil đang thi. Đồng hồ vẫn chạy khi bạn đọc hướng dẫn này; giám khảo chờ bạn đọc xong mới nói.',
  },
  {
    title: 'Nút micro',
    body: 'Nút vàng là đến lượt bạn. Bấm để nói, bấm lại để dừng và gửi. Ô người đang nói (giám khảo, bạn thi) sáng lên ở hàng trên.',
  },
  {
    title: 'Tự dừng khi im',
    body: 'Bật công tắc này thì nói xong im khoảng 2 giây là tự gửi. Chưa nói gì thì không bị cắt.',
  },
  {
    title: 'Thẻ đề',
    body: 'Đề, gợi ý của bước này và ghi chú nháp của bạn. Thẻ có danh sách ý thì ý đã bàn được gạch đi. Bấm dòng Thẻ đề để thu gọn hoặc mở.',
  },
]
