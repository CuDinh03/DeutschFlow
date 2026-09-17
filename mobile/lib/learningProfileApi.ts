// Hồ sơ học tập của chính người học — `GET /api/onboarding/me/profile`
// (OnboardingController → LearningProfileResponse). Web dùng cùng endpoint trong
// `frontend/src/lib/profileApi.ts#getMyLearningProfile` để chọn sẵn band luyện nói theo
// `currentLevel`; app trước 17/09/2026 không gọi tới nên mọi màn mặc định B1 (xem lib/learnerBand.ts).
//
// Chưa làm onboarding ⇒ backend trả 404 (NotFoundException) — người gọi coi như "chưa biết
// trình độ" và rơi về DEFAULT_BAND, không được chặn màn.
import api from './api'

export interface LearningProfile {
  goalType: string | null
  targetLevel: string | null
  /** `A0` = mới bắt đầu tuyệt đối (chip đầu tiên của onboarding); A1…B2 theo tự khai. */
  currentLevel: string | null
  industry: string | null
  interests: string[] | null
  learningSpeed: string | null
  sessionsPerWeek: number | null
  minutesPerSession: number | null
  examType: string | null
  ageRange: string | null
  assignedPersonaCode: string | null
  levelSource: string | null
  onboardingType: string | null
  upsellOptInAt: string | null
  motivation: string | null
  dailyGoalMinutes: number | null
}

/** Khoá cache react-query — onboarding POST xong phải invalidate để màn Nói/Thi đọc trình độ mới. */
export const LEARNING_PROFILE_QUERY_KEY = ['learning-profile'] as const

export const learningProfileApi = {
  me: (): Promise<LearningProfile> => api.get<LearningProfile>('/onboarding/me/profile').then((r) => r.data),
}
