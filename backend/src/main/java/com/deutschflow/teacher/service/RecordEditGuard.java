package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.entity.ClassRecordRevision;
import com.deutschflow.teacher.repository.ClassRecordRevisionRepository;
import com.deutschflow.teacher.repository.ClassRecordUnlockRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Cửa sổ sửa hồi tố (V296, P07): bản ghi giảng dạy của một buổi sửa được trong 7 NGÀY sau buổi;
 * quá hạn phải có mở khóa 24h của người duyệt học vụ ({@code class_record_unlocks}). Mọi lần
 * sửa/xoá đi qua {@link #revise} để lại bản chụp before/after — lịch sử append-only.
 */
@Component
@RequiredArgsConstructor
public class RecordEditGuard {

    public static final int EDIT_WINDOW_DAYS = 7;

    private final ClassRecordUnlockRepository unlockRepo;
    private final ClassRecordRevisionRepository revisionRepo;
    private final ObjectMapper objectMapper;

    /**
     * Chặn sửa/xoá bản ghi của buổi đã qua quá cửa sổ. {@code anchor} = thời điểm buổi diễn ra
     * (session.startAt, hoặc sessionDate với nhật ký legacy); null = không xác định → không chặn.
     */
    public void assertEditable(Long classId, Long teacherId, Long sessionId, LocalDateTime anchor) {
        if (anchor == null) return;
        LocalDateTime now = LocalDateTime.now();
        if (!anchor.isBefore(now.minusDays(EDIT_WINDOW_DAYS))) return;
        if (!unlockRepo.findActive(classId, teacherId, sessionId, now).isEmpty()) return;
        throw new ForbiddenException("Bản ghi của buổi đã quá cửa sổ sửa " + EDIT_WINDOW_DAYS
                + " ngày — cần người duyệt học vụ mở khóa (hiệu lực 24 giờ)");
    }

    /** true khi bản ghi với mốc {@code anchor} còn sửa được (trong cửa sổ hoặc đang có mở khóa). */
    public boolean isEditable(Long classId, Long teacherId, Long sessionId, LocalDateTime anchor) {
        try {
            assertEditable(classId, teacherId, sessionId, anchor);
            return true;
        } catch (ForbiddenException e) {
            return false;
        }
    }

    /** Ghi một dòng lịch sử: before null = tạo mới, after null = xoá. */
    public void revise(ClassRecordRevision.EntityType type, Long entityId, Long classId, Long sessionId,
                       Long userId, String reason, Object before, Object after) {
        revisionRepo.save(ClassRecordRevision.builder()
                .entityType(type)
                .entityId(entityId)
                .classId(classId)
                .sessionId(sessionId)
                .changedBy(userId)
                .reason(reason)
                .beforeState(toMap(before))
                .afterState(toMap(after))
                .build());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toMap(Object o) {
        return o == null ? null : objectMapper.convertValue(o, Map.class);
    }
}
