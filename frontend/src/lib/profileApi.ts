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

/** Live "meet your mentor" preview for the current onboarding selections. */
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
