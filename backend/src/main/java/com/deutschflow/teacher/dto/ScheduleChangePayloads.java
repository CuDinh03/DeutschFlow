package com.deutschflow.teacher.dto;

/**
 * Payload jsonb của đề xuất thay đổi lịch (PR-5) — cùng shape ở chiều GHI (gate xếp hàng chờ)
 * và chiều ĐỌC (áp sau duyệt), convert qua ObjectMapper nên tên trường là hợp đồng.
 */
public final class ScheduleChangePayloads {

    private ScheduleChangePayloads() {}

    /** MOVE_SESSION / CANCEL_SESSION: buổi nào + nội dung PATCH nguyên bản của giáo viên. */
    public record SessionChange(Long sessionId, UpdateSessionRequest request) {}

    /** UPDATE_PATTERN nhánh XOÁ lịch cố định ({@code action="DELETE"} phân biệt với upsert). */
    public record PatternDelete(Long patternId, String action) {
        public static PatternDelete of(Long patternId) {
            return new PatternDelete(patternId, "DELETE");
        }
    }
}
