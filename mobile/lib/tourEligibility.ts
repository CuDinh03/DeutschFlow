// Điều kiện TỰ nổ tour/coach mark onboarding (owner 05/09): chỉ khi
//   (1) tài khoản MỚI đăng ký — chưa có hoạt động nào (0 XP, 0 chặng hoàn thành),
//   (2) chưa từng dùng chức năng đó (Speaking: chưa có phiên AI speaking nào),
//   (3) người dùng bấm "Xem lại hướng dẫn" (source 'replay' — không qua đây).
// Còn lại KHÔNG hiện.
//
// Vì sao cần: cờ "đã xem" nằm trong SecureStore theo MÁY và bị xoá khi đăng xuất
// (F-4: tài khoản thứ hai trên cùng máy không thừa hưởng), nên tài khoản cũ đăng
// nhập lại hoặc sang máy mới từng bị tour đè lên (owner thấy khi đăng nhập cu2
// trên simulator 05/09). Backend không lưu cờ tour → lấy tín hiệu "đã dùng" từ
// dữ liệu server sẵn có. Thuần, test được không cần render.

/** Trạng thái một phép dò server (map từ useQuery: isSuccess / isError). */
export type ProbeStatus = 'pending' | 'error' | 'success'

export function probeStatus(isSuccess: boolean, isError: boolean): ProbeStatus {
  if (isSuccess) return 'success'
  if (isError) return 'error'
  return 'pending'
}

export interface HomeTourInput {
  /** Cờ tour đã đọc xong từ SecureStore. */
  hydrated: boolean
  /** Đã xem tour Trang chủ trên máy này. */
  doneHome: boolean
  /** Một tour khác đang chạy. */
  tourBusy: boolean
  /** Dashboard còn đang tải — thẻ Chuỗi học (neo bước 1) chưa tồn tại (F-11). */
  dashboardLoading: boolean
  /**
   * Màn đang kéo-làm-mới (RefreshControl): scrollTo/đo neo của spotlight bị đè
   * → nổ lúc này rơi về tooltip giữa màn (F-SRS-COACH-01). Chờ xong mới nổ.
   */
  refreshing?: boolean
  /** /xp/me — tổng XP; 0 = chưa hoạt động gì. */
  xp: { status: ProbeStatus; totalXp: number }
  /** /roadmap/me — số chặng đã hoàn thành. */
  roadmap: { status: ProbeStatus; completedCount: number }
}

/**
 * Tour Trang chủ 5 bước tự nổ CHỈ cho tài khoản mới: hai phép dò phải thành công
 * và đều bằng 0. Dò lỗi/chưa về → không nổ (thà thiếu còn hơn đè lên người cũ);
 * tài khoản mới mở app lần sau vẫn còn cơ hội vì cờ chưa đặt.
 */
export function canAutoStartHomeTour(i: HomeTourInput): boolean {
  if (!i.hydrated || i.doneHome || i.tourBusy || i.dashboardLoading || i.refreshing) return false
  if (i.xp.status !== 'success' || i.roadmap.status !== 'success') return false
  return i.xp.totalXp <= 0 && i.roadmap.completedCount <= 0
}

export interface SrsIntroInput {
  hydrated: boolean
  doneHome: boolean
  doneSrs: boolean
  tourBusy: boolean
  /** Sheet nhắc học đang mở — không chồng coach mark lên sheet. */
  sheetOpen: boolean
  /** Đang kéo-làm-mới — xem HomeTourInput.refreshing (F-SRS-COACH-01). */
  refreshing?: boolean
  dueCount: number
  /**
   * /srs/stats `reviewedCards` — số thẻ đã ôn ≥ 1 lần (backend từ PR "srs stats
   * review count", 05/09). `count: null` = backend chưa trả trường này → rơi về
   * gate cũ "tour chính đã xem trên máy".
   */
  reviewed?: { status: ProbeStatus; count: number | null }
}

/**
 * Coach mark SRS: có tín hiệu server "chưa từng ôn" (`reviewedCards === 0`) thì
 * dùng nó — kể cả tài khoản cũ chưa từng ôn thẻ nào (owner 05/09: chưa từng dùng
 * chức năng đó); đã ôn ≥ 1 thẻ thì không bao giờ tự nổ. Dò chưa xong / dò lỗi →
 * không nổ (chưa biết thì thôi). Backend cũ không có trường → gate cũ: tour chính
 * đã xem trên máy này (chỉ tài khoản mới hoặc chính người dùng replay).
 */
export function canAutoStartSrsIntro(i: SrsIntroInput): boolean {
  if (!i.hydrated || i.doneSrs || i.tourBusy || i.sheetOpen || i.refreshing || i.dueCount <= 0) return false
  const r = i.reviewed
  if (r && r.status !== 'success') return false
  if (r && r.count !== null) return r.count === 0
  return i.doneHome
}

export interface SpeakingIntroInput {
  hydrated: boolean
  doneSpeaking: boolean
  tourBusy: boolean
  /** Đang ở màn chọn cách luyện (không phải trong phiên chat / tổng kết). */
  onSelectView: boolean
  /** /ai-speaking/sessions?size=1 — số phiên đã có; 0 = chưa từng dùng. */
  sessions: { status: ProbeStatus; count: number }
}

/** Coach mark Speaking: chỉ khi CHƯA TỪNG có phiên AI speaking (tín hiệu server). */
export function canAutoStartSpeakingIntro(i: SpeakingIntroInput): boolean {
  if (!i.onSelectView || !i.hydrated || i.doneSpeaking || i.tourBusy) return false
  return i.sessions.status === 'success' && i.sessions.count <= 0
}
