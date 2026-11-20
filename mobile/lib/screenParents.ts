// Sơ đồ "màn cha" cho các màn ẩn (href: null) trong Tabs (student) + ghi nhớ tab chính đang mở.
//
// Tabs (student) KHÔNG có stack và không có _layout con: mọi màn chi tiết (classes/[id],
// messages/[userId], settings/*, srs, upgrade…) đều là tab ẩn phẳng. backBehavior mặc định
// firstRoute nên `router.back()` từ bất kỳ màn ẩn nào cũng rơi về Heute (QA simulator 06/09;
// owner: "sửa luôn nút back" — #554 làm cho cụm Luyện thi Nói, PR này làm cho phần còn lại).
//
// Hai kiểu màn cha:
//   1. Màn cha CẤU TRÚC (PARENT_OF): màn con chỉ có một lối vào hợp lý (bài thi → sảnh thi thử,
//      node/skill-practice → Lernweg, lớp → danh sách lớp, cài đặt → Hồ sơ…).
//   2. Màn "tiện ích" mở được từ nhiều tab (SRS, Từ vựng, Ngữ pháp, Thông báo, PRO, Tiến độ…):
//      quay về TRẠM được mở gần nhất trước khi rẽ vào (lastMainTabHref): tab chính, hoặc Hồ sơ
//      nếu vừa rẽ từ Hồ sơ (Hồ sơ thôi là tab từ 18/11/2026) — Heute nếu mở thẳng từ push
//      notification / deep link. Riêng Hồ sơ back về tab chính gần nhất (lastTabHref).
// Cố ý KHÔNG bật backBehavior='history' toàn app: history đưa back về cả những màn đã kết thúc
// (phòng thi đã chấm, phiên nói đã "Xong" qua replace) — xem lib/examSpeakingNav.ts.
// Cụm Luyện thi Nói giữ sơ đồ riêng ở lib/examSpeakingNav.ts (#554).

// 5 tab chính theo khu học viên trên web (owner chốt 18/11/2026). Hồ sơ thôi là tab (mở từ ảnh
// đại diện) nên KHÔNG được nhớ là tab chính: nút back của Hồ sơ về tab vừa mở trước đó; các
// màn cài đặt vẫn về Hồ sơ qua PARENT_OF.
export const STUDENT_TAB = {
  index: '/(student)',
  learn: '/(student)/learn',
  speaking: '/(student)/speaking',
  exam: '/(student)/exam',
  stats: '/(student)/stats',
} as const

export type MainTab = keyof typeof STUDENT_TAB
export type MainTabHref = (typeof STUDENT_TAB)[MainTab]

/** Màn cha cấu trúc: khoá = đường dẫn file trong app/(student) (không đuôi), giá trị = href màn cha. */
export const PARENT_OF = {
  'exam-attempt': '/(student)/exam',
  'exam-review': '/(student)/exam',
  // Luyện đề telc (Đợt 4, 19/11/2026). `exam-teil` về màn Đề của chính đề đó (tính lúc bấm).
  'exam-set': '/(student)/exam',
  'exam-full': '/(student)/exam',
  'exam-diagnostic': '/(student)/exam',
  node: '/(student)/lernweg',
  'node-practice': '/(student)/lernweg',
  'skill-practice': '/(student)/lernweg',
  'weekly-detail': '/(student)/weekly-speaking',
  guide: '/(student)/profile',
  'settings/profile': '/(student)/profile',
  'settings/password': '/(student)/profile',
  'settings/blocked': '/(student)/profile',
  'classes/index': '/(student)/profile',
  'report-issues': '/(student)/profile',
  certificates: '/(student)/profile',
  'classes/[id]': '/(student)/classes',
  'messages/[userId]': '/(student)/messages',
} as const

export type ParentScreen = keyof typeof PARENT_OF

const PROFILE_HREF = '/(student)/profile' as const
export type HubHref = MainTabHref | typeof PROFILE_HREF

let lastMainTab: MainTab = 'index'
// "Trạm" gần nhất = tab chính hoặc Hồ sơ. Màn tiện ích (Nâng cấp, Thông báo, Sổ từ…) mở từ Hồ sơ
// thì back về Hồ sơ như trước khi Hồ sơ thôi là tab; còn chính Hồ sơ back về tab chính.
let lastHubIsProfile = false

export function isMainTab(name: string | undefined): name is MainTab {
  return name !== undefined && Object.prototype.hasOwnProperty.call(STUDENT_TAB, name)
}

/** Gọi mỗi khi Tabs đổi state (listener ở app/(student)/_layout.tsx): nhớ tab chính và trạm. */
export function noteFocusedRoute(routeName: string | undefined): void {
  if (isMainTab(routeName)) {
    lastMainTab = routeName
    lastHubIsProfile = false
  } else if (routeName === 'profile') {
    lastHubIsProfile = true
  }
}

/** Đích back của màn tiện ích: trạm mở gần nhất (tab chính, hoặc Hồ sơ nếu vừa rẽ từ Hồ sơ). */
export function lastMainTabHref(): HubHref {
  return lastHubIsProfile ? PROFILE_HREF : STUDENT_TAB[lastMainTab]
}

/** Đích back của Hồ sơ: tab chính mở gần nhất (Hồ sơ mở từ ảnh đại diện trên các tab). */
export function lastTabHref(): MainTabHref {
  return STUDENT_TAB[lastMainTab]
}

/** Chỉ dùng trong test. */
export function resetLastMainTab(): void {
  lastMainTab = 'index'
  lastHubIsProfile = false
}
