// Nhãn 4 tab chính của khu học viên — MỘT nguồn duy nhất.
//
// Owner chốt 10/09/2026 (soi web /v2/student/dashboard): mỗi ngôn ngữ thuần một
// thứ tiếng, bỏ lối "nhãn Đức + dòng nghĩa". Bản mobile chỉ có tiếng Việt nên
// mọi nhãn giao diện phải là tiếng Việt; chữ ở đây khớp `nav.areas` của web
// (frontend/messages/v2/chrome.vi.json) để hai đầu gọi cùng một tên.
//
// Trước đây nhãn khai HAI nơi — `options.title` trong app/(student)/_layout.tsx và
// một map fallback trong components/ui/TabBar.tsx — nên đã trôi khỏi nhau
// ("Heute" ở layout, "Trang chủ" ở TabBar). Cả hai nay đọc bảng này.
//
// Thuật ngữ thi (Hören/Lesen/Schreiben/Sprechen) và tên bài học là NỘI DUNG HỌC,
// không phải nhãn giao diện — chúng vẫn giữ tiếng Đức ở nơi khác.
export const TAB_LABELS = {
  index: 'Hôm nay',
  learn: 'Học',
  speaking: 'Luyện nói',
  profile: 'Hồ sơ',
} as const

export type TabRouteName = keyof typeof TAB_LABELS
