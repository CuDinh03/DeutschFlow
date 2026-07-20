package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO cho bảng công giáo viên (V263). Gom trong một file vì đều nhỏ và luôn dùng cùng nhau.
 *
 * <p>Không có trường nào liên quan tới tiền: hệ thống chỉ chốt SỐ CÔNG (số buổi / số phút) rồi xuất
 * ra ngoài cho kế toán. Đơn giá và thành tiền cố ý nằm ngoài phạm vi.
 */
public final class TimesheetDtos {

    private TimesheetDtos() {}

    /** Một dòng công đã ghi nhận. */
    public record SessionRecordDto(
            Long id,
            Long classId,
            String className,
            Long sessionId,
            LocalDateTime startedAt,
            int durationMinutes,
            String teacherRole,
            String note
    ) {}

    /**
     * Một buổi ĐÃ LÊN LỊCH và đã trôi qua nhưng giáo viên chưa ghi công — hệ đề xuất để họ xác nhận
     * một chạm. Cố ý KHÔNG tự sinh bản ghi công: lớp có thể có nhiều giáo viên, có dạy thay, và
     * thời lượng thực tế có thể khác kế hoạch — chỉ giáo viên mới biết chắc.
     */
    public record SuggestionDto(
            Long sessionId,
            Long classId,
            String className,
            LocalDateTime startedAt,
            int plannedDurationMinutes
    ) {}

    /** Tổng hợp một kỳ. {@code totalMinutes} phục vụ hợp đồng tính theo giờ. */
    public record TimesheetSummaryDto(
            LocalDateTime from,
            LocalDateTime to,
            int totalSessions,
            int totalMinutes,
            List<SessionRecordDto> records,
            List<SuggestionDto> suggestions
    ) {}

    /**
     * Yêu cầu ghi/sửa một dòng công.
     *
     * <p>Hai cách dùng: (a) xác nhận từ một buổi đã lên lịch — chỉ cần {@code sessionId}, hệ lấy
     * mốc thời gian và thời lượng kế hoạch làm mặc định; (b) khai buổi ngoài lịch — cần
     * {@code classId} + {@code startedAt} + {@code durationMinutes}. Trong cả hai trường hợp
     * {@code durationMinutes} do giáo viên gửi lên luôn được ưu tiên, vì thời lượng thực tế mới là
     * cái được trả công.
     */
    public record RecordTeachingRequest(
            Long sessionId,
            Long classId,
            LocalDateTime startedAt,
            Integer durationMinutes,
            String teacherRole,
            String note
    ) {}
}
