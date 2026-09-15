// Sơ đồ "màn cha" của cụm Luyện thi Nói trên mobile.
//
// Cả 4 màn (hub, phòng thi, phiếu điểm, ôn yếu điểm) sống trong Tabs (student) dưới dạng tab ẩn
// (href: null). Tabs mặc định backBehavior=firstRoute nên `router.back()` từ bất kỳ màn ẩn nào
// đều rơi về tab đầu (Heute) — QA simulator 06/09/2026, owner yêu cầu back về đúng tab Speaking.
// Nút back vì thế điều hướng TƯỜNG MINH: hub ← tab Speaking; phòng thi / phiếu điểm / ôn yếu
// điểm ← hub. Không đổi backBehavior toàn app: 'history' sẽ đưa back từ phiếu điểm về lại
// phòng thi đã kết thúc (phòng thi replace sang phiếu điểm ngay khi có kết quả → vòng lặp).
export const EXAM_ROUTES = {
  speakingTab: '/(student)/speaking',
  hub: '/(student)/speaking-exam',
  room: '/(student)/speaking-exam-room',
  result: '/(student)/speaking-exam-result',
  weakness: '/(student)/speaking-exam-weakness',
} as const

export type ExamRoute = (typeof EXAM_ROUTES)[keyof typeof EXAM_ROUTES]
export type ExamScreen = Exclude<keyof typeof EXAM_ROUTES, 'speakingTab'>

/** Màn cha mà nút back (và back cứng Android) của `screen` phải đi tới. */
export function examParentHref(screen: ExamScreen): ExamRoute {
  return screen === 'hub' ? EXAM_ROUTES.speakingTab : EXAM_ROUTES.hub
}
