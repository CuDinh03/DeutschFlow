package com.deutschflow.examspeaking.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** DTO màn admin ngân hàng đề (Đ5b-A): ma trận pool theo blueprint, bảng đề, payload tạo/sửa. */
public final class TaskBankView {

    private TaskBankView() {}

    /**
     * Một ô pool = một Teil của một blueprint đang hoạt động. {@code poolApproved} đếm đề APPROVED
     * dùng được cho hệ đó (đề riêng + đề dùng chung provider NULL). FE tô màu: đỏ khi
     * {@code poolApproved < cardsNeeded} (phiên sẽ 409), vàng khi bằng đúng (không còn gì để xoay đề).
     */
    public record PoolCell(
            String provider,
            String level,
            int teilNo,
            String archetype,
            String title,
            int cardsNeeded,
            long poolApproved
    ) {}

    /** Một dòng đề trong bảng. {@code provider} null = đề dùng chung mọi hệ. */
    public record TaskRow(
            long id,
            String provider,
            String level,
            int teilNo,
            String archetype,
            String status,
            String source,
            Map<String, Object> stimulus,
            Instant createdAt,
            Instant updatedAt
    ) {}

    /** Payload tạo/sửa đề. {@code status} null khi tạo = DRAFT. */
    public record TaskPayload(
            String provider,
            String level,
            Integer teilNo,
            String archetype,
            String status,
            Map<String, Object> stimulus
    ) {}

    /** Blueprint read-only để FE dựng bộ lọc + form đúng cấu trúc kỳ thi (đổi blueprint vẫn qua migration). */
    public record BlueprintRow(
            long id,
            String provider,
            String level,
            String title,
            int prepSec,
            List<BlueprintPartRow> parts
    ) {}

    public record BlueprintPartRow(
            int teilNo,
            String archetype,
            String title,
            int durationSec,
            int cardsNeeded,
            boolean hasPartner
    ) {}
}
