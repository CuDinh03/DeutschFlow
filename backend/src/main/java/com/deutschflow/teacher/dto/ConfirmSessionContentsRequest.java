package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Xác nhận kết quả thực tế sau buổi (spec §5): TAUGHT = dạy xong; PARTIAL = còn dở (kèm
 * {@code remainingMinutes} ƯỚC TÍNH — không ép chính xác giả, cho phép null); PLANNED = hoàn tác
 * một xác nhận nhầm. PARTIAL tự sinh/cập nhật dòng chuyển tiếp đứng đầu buổi kế (AC06).
 */
public record ConfirmSessionContentsRequest(List<ConfirmEntry> entries) {

    public record ConfirmEntry(Long contentId, String status, Integer actualMinutes,
                               Integer remainingMinutes, String note) {}
}
