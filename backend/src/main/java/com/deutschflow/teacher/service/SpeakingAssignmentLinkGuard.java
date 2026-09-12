package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Cổng sở hữu cho mối nối "phiên nói ↔ dòng bài tập" ({@code ai_speaking_sessions.assignment_id} →
 * {@code student_assignments.id}).
 *
 * <p><b>Vì sao cần một cổng riêng.</b> {@code assignmentId} đi vào từ thân request của học viên và là
 * khoá chính tăng dần — đoán được. Khi phiên kết thúc, {@code TeacherAiGradingService} đọc lại đúng id
 * đó và GHI điểm/nhận xét/trạng thái lên dòng ấy. Không kiểm chủ sở hữu thì học viên A truyền id dòng
 * của học viên B là điểm AI của A đè lên bài của B, hoặc đẩy bài của B sang {@code GRADING_FAILED} qua
 * đường lỗi. Đó là hỏng dữ liệu học vụ, không chỉ rò đọc.
 *
 * <p><b>Vì sao kiểm ở CẢ HAI đầu.</b> Đường tạo phiên chặn từ gốc (không tạo nổi mối nối lạ). Đường kết
 * phiên kiểm lại trước khi ghi, vì giữa hai thời điểm dòng bài có thể đã đổi chủ, bị xoá mềm, hoặc phiên
 * mang mối nối lạ có sẵn trong dữ liệu cũ tạo trước bản vá này.
 *
 * <p><b>404 chứ không 403.</b> Cùng khuôn {@code OrgService.getStudentDetail}: trả "không tìm thấy" thì
 * kẻ dò không phân biệt được "id có thật nhưng của người khác" với "id không tồn tại", nên không đếm
 * được số học viên hay dò ra dải id đang dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpeakingAssignmentLinkGuard {

    private final StudentAssignmentRepository studentAssignmentRepository;

    /**
     * Đường TẠO phiên: chặn từ gốc, fail-closed. {@code assignmentId} rỗng là phiên luyện tự do —
     * không có mối nối nào để kiểm.
     *
     * @throws NotFoundException khi dòng bài không tồn tại, đã xoá mềm, hoặc không thuộc người gọi
     */
    public void assertOwnedByCaller(Long userId, Long assignmentId) {
        if (assignmentId == null) return;
        if (resolve(userId, assignmentId, "tạo phiên").isEmpty()) {
            throw new NotFoundException("Bài tập không tồn tại");
        }
    }

    /**
     * Đường KẾT phiên: kiểm lại ngay trước khi ghi. Trả rỗng = KHÔNG được ghi gì lên dòng bài.
     *
     * <p>Không ném ở đây: chấm nền chạy {@code @Async} nên ném chỉ làm mất phần chấm còn lại của phiên
     * (điểm trên chính phiên nói vẫn có giá trị với học viên). Từ chối ghi rồi ghi log là đủ, và log là
     * tín hiệu phát hiện nếu có người thật sự dò id.
     */
    public Optional<StudentAssignment> loadOwnedForWrite(Long userId, Long assignmentId) {
        if (assignmentId == null) return Optional.empty();
        return resolve(userId, assignmentId, "ghi điểm");
    }

    private Optional<StudentAssignment> resolve(Long userId, Long assignmentId, String what) {
        StudentAssignment row = studentAssignmentRepository.findById(assignmentId).orElse(null);
        if (row == null) {
            log.warn("[Assignment-Link] Từ chối {}: dòng bài {} không tồn tại (người gọi {})",
                    what, assignmentId, userId);
            return Optional.empty();
        }
        if (row.isDeleted()) {
            log.warn("[Assignment-Link] Từ chối {}: dòng bài {} đã xoá (người gọi {})",
                    what, assignmentId, userId);
            return Optional.empty();
        }
        if (userId == null || !userId.equals(row.getStudentId())) {
            // Mức WARN có chủ ý: đây là dấu hiệu dò id, không phải chuyện thường ngày.
            log.warn("[Assignment-Link] Từ chối {}: dòng bài {} thuộc học viên {}, người gọi là {}",
                    what, assignmentId, row.getStudentId(), userId);
            return Optional.empty();
        }
        return Optional.of(row);
    }
}
