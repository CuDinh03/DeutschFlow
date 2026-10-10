import api, { apiMessage } from "./api";

/**
 * Ô "tự khai ngày sinh" trên trang Hồ sơ — BẬT từ 17/09/2026 (phương án D, owner chốt).
 *
 * Từng tắt vì học viên B2C tự khai dưới 18 bị `MinorGate` khoá luyện nói mà không ai mở lại được
 * (đường ghi đồng ý chỉ có ở `/api/org/...`; plans/2026-09-14-hv-tu-dang-ky-ma-lop-vs-csv.md §7).
 * Nay backend chỉ áp mức 16–17 cho THÀNH VIÊN trung tâm; người ngoài trung tâm dưới 16 vẫn bị
 * chặn theo luật nhưng nhận `extensions.contact=NONE` và thông điệp nói đường phụ huynh xác nhận
 * đang được làm (Q-04). Giữ hằng để tắt nhanh nếu cần; mobile dùng cùng một hằng trong
 * `mobile/lib/profileApi.ts` — đổi thì đổi cả hai.
 */
export const BIRTH_DATE_SELF_DECLARE_ENABLED = true;

// ── Types ──────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  displayName?: string;
  phoneNumber?: string;
  locale?: string;
  /** IANA zone id — DailyNotificationJob đọc để biết 8h/18h của người dùng là lúc nào. */
  notificationTimezone?: string;
  /** 0–23; -1 = bỏ giờ nhắc (về mặc định 18h). Đợt 6 W11/M10. */
  reminderHourLocal?: number;
}

/** Thông tin cá nhân đầy đủ của trang Hồ sơ (GET /profile/me) — nhiều hơn /auth/me. */
export interface PersonalProfileData {
  userId: number;
  email: string;
  displayName: string;
  phoneNumber: string | null;
  locale: string | null;
  avatarUrl: string | null;
  role: string;
  birthDate: string | null;          // ISO yyyy-MM-dd
  /** true = đã có ngày sinh ⇒ chỉ đọc, muốn sửa phải qua trung tâm/hỗ trợ. */
  birthDateLocked: boolean;
  notificationTimezone: string | null;
  /** Giờ nhắc học 0–23 theo múi giờ; null = chưa chọn (Đợt 6, V333). */
  reminderHourLocal: number | null;
}

export interface BirthDateResult {
  birthDate: string;
  /** UNKNOWN | MINOR_LEGAL | MINOR_CENTER_POLICY | ADULT */
  minorStatus: string;
  requiresGuardianConsent: boolean;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateLearningProfilePayload {
  goalType?: string;          // WORK | CERT
  targetLevel?: string;       // A1 | A2 | B1 | B2 | C1 | C2
  currentLevel?: string;      // A0 | A1 | A2 | B1 | B2 | C1 | C2 (tự khai → levelSource=SELF)
  examType?: string;          // GOETHE | TELC | TESTDAF…; chuỗi rỗng = xoá
  industry?: string;
  interests?: string[];
  learningSpeed?: string;     // SLOW | NORMAL | FAST
  sessionsPerWeek?: number;
  minutesPerSession?: number;
}

export interface LearningProfileData {
  goalType: string | null;
  targetLevel: string | null;
  currentLevel: string | null;
  industry: string | null;
  interests: string[];
  learningSpeed: string | null;
  sessionsPerWeek: number;
  minutesPerSession: number;
  examType: string | null;
  ageRange: string | null;
  assignedPersonaCode: string | null;  // fixed mentor (SpeakingPersona code), derived at onboarding
  levelSource: string | null;          // SELF | PLACEMENT — provenance of currentLevel
  onboardingType: string | null;       // archetype O1-O5 the learner was routed through
  upsellOptInAt: string | null;        // when the learner opted in to PRO-upgrade emails (iOS handoff)
}

/** Onboarding routing decision for the (platform, level) cell of the design §4 matrix. */
export interface OnboardingRouteData {
  onboardingType: string;       // EXPRESS_PROFILE | PLACEMENT_VALIDATED | ZERO_START | ASSESSMENT_HOOK | MENTOR_LED_DEMO
  placementRequired: boolean;   // hard gate before the roadmap (legacy; now false on web)
  placementOptional: boolean;   // offered as a skippable shortcut AFTER the first value (value-first)
  assessmentHookAfter: boolean;
  paywallAllowed: boolean;      // false on iOS (Apple 3.1.1)
  postAction: string;           // ROADMAP_ALPHABET | ROADMAP_NODE | PRICING_CTA | ...
}

/** The fixed mentor a learner would be assigned for their current onboarding selections. */
export interface OnboardingMentorData {
  code: string;          // SpeakingPersona code, e.g. "ANNA"
  displayName: string;   // e.g. "Anna"
  difficulty: string;    // BEGINNER | INTERMEDIATE | ADVANCED
  upsellCode: string | null;         // gated ideal mentor (FREE tier) for a PRO nudge, or null
  upsellDisplayName: string | null;
}

export interface AuthResponseLite {
  accessToken?: string;
  refreshToken?: string;
  displayName?: string;
  email?: string;
  role?: string;
}

// ── API calls ───────────────────────────────────────────────────────────────

/** Thông tin cá nhân đầy đủ để dựng form Hồ sơ (kèm ngày sinh + múi giờ thông báo). */
export async function getPersonalProfile(): Promise<PersonalProfileData> {
  try {
    const res = await api.get<PersonalProfileData>("/profile/me");
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/**
 * Tự khai ngày sinh — backend chỉ cho ghi MỘT LẦN; đã có thì trả 409 kèm hướng dẫn liên hệ.
 * @param birthDate ISO yyyy-MM-dd
 */
export async function declareBirthDate(birthDate: string): Promise<BirthDateResult> {
  try {
    const res = await api.patch<BirthDateResult>("/profile/me/birth-date", { birthDate });
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/**
 * Đăng xuất khỏi mọi thiết bị KHÁC. Backend thu hồi sạch refresh token rồi cấp cặp mới cho chính
 * thiết bị này — caller BẮT BUỘC nạp cặp token trả về (setTokens), nếu không phiên hiện tại cũng
 * rụng ở lần refresh kế tiếp.
 */
export async function revokeOtherSessions(): Promise<AuthResponseLite & { accessToken?: string; refreshToken?: string }> {
  try {
    const res = await api.post<AuthResponseLite>("/profile/me/sessions/revoke-others");
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/**
 * Xoá vĩnh viễn tài khoản của chính mình. Backend chặn 409 kèm hướng dẫn nếu người dùng còn là
 * thành viên ACTIVE của một trung tâm (AccountDeletionGuard — D6).
 */
export async function deleteMyAccount(): Promise<void> {
  try {
    await api.delete("/profile/me");
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Cập nhật thông tin cá nhân: displayName, phoneNumber, locale */
export async function updateProfile(
  data: UpdateProfilePayload
): Promise<AuthResponseLite> {
  try {
    const res = await api.patch<AuthResponseLite>("/profile/me", data);
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Đổi mật khẩu — cần currentPassword. Sau khi đổi buộc đăng nhập lại. */
export async function changePassword(data: ChangePasswordPayload): Promise<void> {
  try {
    await api.patch("/profile/me/password", data);
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Upload ảnh đại diện (ảnh chuẩn ≤5MB). Backend thay ảnh cũ và trả URL mới. */
export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await api.post<{ avatarUrl: string }>("/profile/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Gỡ ảnh đại diện — quay về chữ cái tắt. */
export async function removeAvatar(): Promise<void> {
  try {
    await api.delete("/profile/me/avatar");
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/**
 * Resolve the designated onboarding archetype for this (platform=web, level) cell.
 * Single source of truth (backend matrix) for whether to run the placement test,
 * whether a paywall is allowed, and where to send the learner next.
 */
export async function getOnboardingRoute(currentLevel: string): Promise<OnboardingRouteData> {
  try {
    const res = await api.get<OnboardingRouteData>("/onboarding/route", {
      params: { currentLevel, platform: "web" },
    });
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Live "meet your mentor" preview for the current onboarding selections (authenticated). */
export async function getOnboardingMentor(
  goalType: string,
  industry: string,
  currentLevel: string
): Promise<OnboardingMentorData> {
  try {
    const res = await api.get<OnboardingMentorData>("/onboarding/mentor", {
      params: { goalType, industry, currentLevel },
    });
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/**
 * Public "meet your mentor" preview for a GUEST (value-first funnel, before signup).
 * Hits the no-auth preview endpoint (assumes FREE tier); same deterministic resolver.
 */
export async function getOnboardingMentorPreview(
  goalType: string,
  industry: string,
  currentLevel: string
): Promise<OnboardingMentorData> {
  try {
    const res = await api.get<OnboardingMentorData>("/onboarding/preview/mentor", {
      params: { goalType, industry, currentLevel },
    });
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Lấy learning profile đầy đủ để pre-fill form settings */
export async function getMyLearningProfile(): Promise<LearningProfileData> {
  try {
    const res = await api.get<LearningProfileData>("/onboarding/me/profile");
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}

/** Cập nhật learning profile (partial update — chỉ gửi fields cần thay đổi) */
export async function updateLearningProfile(
  data: UpdateLearningProfilePayload
): Promise<LearningProfileData> {
  try {
    const res = await api.patch<LearningProfileData>("/profile/me/learning", data);
    return res.data;
  } catch (e) {
    throw new Error(apiMessage(e));
  }
}
