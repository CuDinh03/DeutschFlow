package com.deutschflow.srs.dto;

/**
 * SRS summary stats — response of {@code GET /api/srs/stats}.
 *
 * @param dueCount      thẻ đến hạn ôn (next_review_at ≤ now)
 * @param totalCards    tổng thẻ đã đưa vào lịch ôn
 * @param reviewedCards số thẻ đã ôn ít nhất một lần (last_review_at khác null) — nguồn chắc để
 *                      biết "chưa từng ôn" (0 = chưa ôn thẻ nào). Owner 05/09: mobile cần tín
 *                      hiệu này để coach mark SRS chỉ tự nổ cho người chưa dùng chức năng.
 * @param totalReviews  tổng lượt ôn = số event XP {@code SRS_REVIEW} (mỗi thẻ ôn, kể cả batch,
 *                      một event). Best-effort như XP; dùng cho thống kê/hiển thị.
 */
public record SrsStatsDto(long dueCount, long totalCards, long reviewedCards, long totalReviews) {}
