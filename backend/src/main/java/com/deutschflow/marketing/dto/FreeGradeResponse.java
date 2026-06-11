package com.deutschflow.marketing.dto;

/**
 * Kết quả chấm thử miễn phí trả về cho landing page.
 *
 * @param score    điểm AI chấm (0–100)
 * @param feedback nhận xét tiếng Việt
 * @param message  lời cảm ơn / mời tiếp theo (CTA)
 */
public record FreeGradeResponse(int score, String feedback, String message) {}
