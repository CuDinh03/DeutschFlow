package com.deutschflow.organization.dto;

import java.time.Instant;
import java.util.List;

/**
 * DTO cho đường giám đốc trung tâm đọc tin nhắn riêng của học viên chưa thành niên
 * (AC-ORG-CT-10, DEC-22 mục 18c — owner chốt 09/09/2026).
 *
 * <p>Cố ý KHÔNG tái dùng {@code MessagingDtos}: cờ {@code mine} ở đó có nghĩa "người gọi là người
 * gửi", mà ở đây người gọi KHÔNG phải một bên của hội thoại — một giám đốc nhìn thấy
 * {@code mine=false} trên mọi dòng sẽ đọc nhầm thành "học viên không nhắn gì cả". Thay vào đó DTO
 * này nói thẳng ai là ai bằng {@code senderId}/{@code recipientId}.
 */
public final class OrgMinorMessageDtos {

    /**
     * Một hội thoại (cặp học viên ↔ đối tác) trong danh mục của trung tâm. KHÔNG có trích đoạn nội
     * dung: danh mục là để CHỌN hội thoại cần xem, còn mỗi lần thật sự đọc nội dung phải đi qua
     * đường có ghi vết riêng ({@code readThread}). Đưa preview vào đây là biến một lần liệt kê
     * thành một lần đọc nội dung hàng loạt mà sổ hoạt động chỉ thấy đúng một dòng.
     *
     * @param minorStatus  {@code MINOR_LEGAL} (dưới ngưỡng pháp lý) hoặc {@code MINOR_CENTER_POLICY}
     *                     (16–17) — CĂN CỨ để giám đốc được đọc, không phải ngày sinh thô
     * @param counterpartStillInOrg đối tác còn là thành viên ACTIVE của trung tâm không. {@code false}
     *                     = giáo viên đã bị gỡ mà hội thoại vẫn còn — đúng ca đáng ngờ nhất, nên
     *                     hiển thị chứ không lọc bỏ
     */
    public record MinorConversationDto(
            Long studentUserId,
            String studentName,
            String studentEmail,
            String minorStatus,
            Long counterpartUserId,
            String counterpartName,
            String counterpartEmail,
            boolean counterpartStillInOrg,
            long messageCount,
            Instant lastAt
    ) {}

    /** Một tin nhắn trong hội thoại. {@code readAt} chỉ để đọc — đường này không bao giờ ghi nó. */
    public record MinorMessageDto(
            Long id,
            Long senderId,
            Long recipientId,
            String body,
            Instant createdAt,
            Instant readAt
    ) {}

    /** Trọn hội thoại giữa một học viên chưa thành niên và một đối tác, cũ → mới. */
    public record MinorThreadDto(
            Long studentUserId,
            String studentName,
            String minorStatus,
            Long counterpartUserId,
            String counterpartName,
            List<MinorMessageDto> messages
    ) {}

    private OrgMinorMessageDtos() {}
}
