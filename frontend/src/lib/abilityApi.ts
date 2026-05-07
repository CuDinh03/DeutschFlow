/**
 * Ability Score API — gọi sau mỗi phiên học/speaking để ghi điểm kỹ năng.
 * POST /api/ability/score
 *
 * items: mảng { q: quality (0–5), w: weight } cho từng item được luyện
 * timeSeconds: tổng thời gian phiên (giây)
 */
import api from "@/lib/api";

export interface AbilityScoreItem {
  /** Quality: 0 = quên hoàn toàn, 5 = quá dễ (SM-2 scale) */
  q: number;
  /** Weight: 1.0 = bình thường, 2.0 = quan trọng */
  w: number;
}

export interface AbilityScoreResponse {
  score: number; // 0.0 – 1.0
}

/**
 * Ghi điểm kỹ năng sau phiên học.
 * Trả về score từ 0.0 đến 1.0, không throw nếu lỗi (fire-and-forget safe).
 */
export async function recordAbilityScore(
  items: AbilityScoreItem[],
  timeSeconds: number
): Promise<number | null> {
  if (!items.length || timeSeconds < 1) return null;
  try {
    const { data } = await api.post<AbilityScoreResponse>("/ability/score", {
      items,
      timeSeconds,
    });
    return data.score ?? null;
  } catch (err) {
    console.warn("[AbilityScore] Failed to record:", err);
    return null;
  }
}

/**
 * Helper: tạo AbilityScoreItem từ điểm phần trăm (0–100).
 * q maps: <40→0, 40-59→2, 60-74→3, 75-89→4, >=90→5
 */
export function scorePercentToItem(
  scorePercent: number,
  weight = 1.0
): AbilityScoreItem {
  let q: number;
  if (scorePercent >= 90) q = 5;
  else if (scorePercent >= 75) q = 4;
  else if (scorePercent >= 60) q = 3;
  else if (scorePercent >= 40) q = 2;
  else q = 0;
  return { q, w: weight };
}
