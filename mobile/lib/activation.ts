import api from '@/lib/api'

/**
 * ACTIVATION — ghi "đã hoàn thành bài đầu tiên" lên server (kế hoạch onboarding 17/09 §4.6).
 *
 * Server (`POST /api/onboarding/first-lesson/complete`) là nơi DUY NHẤT ghi
 * `user_onboarding_progress.activated_at`, idempotent: lần đầu `firstTime=true`, các lần sau chỉ
 * nối thêm activity. Mobile chỉ cần gọi cho nguồn chấm cục bộ (Câu đầu tiên); Ngày 1 / placement /
 * chặng lộ trình được server tự hook.
 *
 * Fire-and-forget có chủ đích: đây là sổ đo, KHÔNG phải luồng học. Mất mạng, 404 (backend cũ chưa
 * deploy — thứ tự phát hành BE → OTA vẫn có thể lệch trên máy chưa cập nhật) hay 5xx đều nuốt im,
 * không toast, không chặn màn ăn mừng. Trả về kết quả để test/caller nào cần thì dùng.
 */
export type FirstLessonKind = 'FIRST_SENTENCE' | 'BEGINNER_SESSION' | 'PLACEMENT' | 'MOCK_EXAM' | 'ROADMAP_NODE'

export interface ActivationResult {
  activatedAt: string | null
  firstTime: boolean
  completedActivities: string[]
}

export async function recordFirstLesson(
  kind: FirstLessonKind,
  meta?: Record<string, string | number | boolean | null>,
): Promise<ActivationResult | null> {
  try {
    const { data } = await api.post<ActivationResult>('/onboarding/first-lesson/complete', {
      kind,
      ...(meta ? { meta } : {}),
    })
    return data
  } catch {
    return null
  }
}

export interface CoreDoneResult {
  coreCompletedAt: string | null
  firstTime: boolean
}

/** Đi hết luồng onboarding (trả lời sheet nhắc học, kể cả từ chối — I-4). Cùng luật nuốt lỗi. */
export async function recordCoreDone(): Promise<CoreDoneResult | null> {
  try {
    const { data } = await api.post<CoreDoneResult>('/onboarding/progress/core-done')
    return data
  } catch {
    return null
  }
}
