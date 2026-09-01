package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.teacher.entity.ClassRecordUnlock;
import com.deutschflow.teacher.repository.ClassRecordUnlockRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Cấp mở khóa sửa hồi tố (V296, P07): người duyệt học vụ cấp cho MỘT giáo viên của lớp, hiệu lực
 * 24 giờ, lý do bắt buộc — chính bản ghi là audit. Không có thu hồi/xoá: mở khóa tự hết hạn.
 */
@Service
@RequiredArgsConstructor
public class RecordUnlockService {

    private final ClassRecordUnlockRepository unlockRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final OrgGuard orgGuard;

    public record GrantRequest(Long classId, Long teacherId, Long sessionId, String reason) {}

    public record UnlockDto(Long id, Long classId, Long sessionId, Long grantedTo, Long grantedBy,
                            String reason, LocalDateTime grantedAt, LocalDateTime expiresAt) {}

    @Transactional
    public UnlockDto grant(Long reviewerId, Long orgId, GrantRequest req) {
        if (req.classId() == null || req.teacherId() == null) {
            throw new BadRequestException("Thiếu lớp hoặc giáo viên cần mở khóa");
        }
        if (req.reason() == null || req.reason().isBlank()) {
            throw new BadRequestException("Mở khóa phải kèm lý do (audit)");
        }
        orgGuard.assertAcademicApprover(reviewerId, orgId, req.classId());
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(req.classId(), req.teacherId())) {
            throw new BadRequestException("Giáo viên không dạy lớp này");
        }
        ClassRecordUnlock saved = unlockRepo.save(ClassRecordUnlock.builder()
                .classId(req.classId())
                .sessionId(req.sessionId())
                .grantedTo(req.teacherId())
                .grantedBy(reviewerId)
                .reason(req.reason().trim())
                .build());
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<UnlockDto> listActive(Long reviewerId, Long orgId, Long classId) {
        orgGuard.assertAcademicApprover(reviewerId, orgId, classId);
        return unlockRepo.findByClassIdAndExpiresAtAfterOrderByGrantedAtDesc(classId, LocalDateTime.now())
                .stream().map(this::toDto).toList();
    }

    private UnlockDto toDto(ClassRecordUnlock u) {
        return new UnlockDto(u.getId(), u.getClassId(), u.getSessionId(), u.getGrantedTo(),
                u.getGrantedBy(), u.getReason(), u.getGrantedAt(), u.getExpiresAt());
    }
}
