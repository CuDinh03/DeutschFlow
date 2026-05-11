import api, { apiMessage } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  displayName?: string;
  phoneNumber?: string;
  locale?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateLearningProfilePayload {
  goalType?: string;          // WORK | CERT
  targetLevel?: string;       // A1 | A2 | B1 | B2 | C1 | C2
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
}

export interface AuthResponseLite {
  accessToken?: string;
  refreshToken?: string;
  displayName?: string;
  email?: string;
  role?: string;
}

// ── API calls ───────────────────────────────────────────────────────────────

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
