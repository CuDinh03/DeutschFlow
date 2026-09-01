package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.entity.CurriculumItem;
import com.deutschflow.organization.repository.CurriculumItemRepository;
import com.deutschflow.teacher.dto.ConfirmSessionContentsRequest;
import com.deutschflow.teacher.dto.PlanSessionContentsRequest;
import com.deutschflow.teacher.dto.SessionContentDto;
import com.deutschflow.teacher.dto.SessionContentsDto;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassSessionContent;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassSessionContentRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Phân bổ nội dung theo BUỔI + xác nhận thực tế + suy hoàn thành Lektion (PR-4, spec §5, AC06–AC08).
 *
 * <p>Bất biến giữ chặt:
 * <ul>
 *   <li>Phần dở (PARTIAL) sinh MỘT dòng chuyển tiếp đứng ĐẦU buổi kế tiếp, trỏ ngược
 *       {@code carriedFromId} — giữ liên kết gốc, không nhân bản nội dung đếm-hai-lần (AC06).</li>
 *   <li>Lesson giáo trình ({@code lektionId != null}) HOÀN THÀNH ⇔ mọi mục bắt buộc của Lektion
 *       có ≥1 dòng TAUGHT (AC07/AC08). Recompute chạy hai chiều — hoàn tác xác nhận thì bài trở
 *       lại chưa hoàn thành, không có "hoàn thành giả".</li>
 *   <li>Không xác nhận buổi CANCELLED; xác nhận không phụ thuộc đủ-3-nhật-ký hay đủ-số-giờ.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class SessionContentService {

    private static final Set<String> CONFIRM_STATUSES = Set.of(
            ClassSessionContent.STATUS_PLANNED, ClassSessionContent.STATUS_TAUGHT,
            ClassSessionContent.STATUS_PARTIAL);

    private final ClassSessionContentRepository contentRepo;
    private final ClassSessionRepository sessionRepo;
    private final ClassTeacherRepository classTeacherRepo;
    private final ClassLessonRepository lessonRepo;
    private final CurriculumItemRepository curriculumItemRepo;
    private final RecordEditGuard recordEditGuard;

    @Transactional(readOnly = true)
    public SessionContentsDto list(Long teacherId, Long sessionId) {
        ClassSession session = loadOwnedSession(teacherId, sessionId);
        return toDto(session, contentRepo.findBySessionIdOrderByOrderIndexAsc(sessionId), 0);
    }

    /** Thay các dòng PLANNED thường của buổi bằng kế hoạch mới; dòng đã xác nhận + dòng chuyển tiếp giữ nguyên. */
    @Transactional
    public SessionContentsDto plan(Long teacherId, Long sessionId, PlanSessionContentsRequest req) {
        ClassSession session = loadOwnedSession(teacherId, sessionId);
        assertNotCancelled(session);
        List<PlanSessionContentsRequest.PlanEntry> entries =
                req == null || req.items() == null ? List.of() : req.items();

        List<ClassSessionContent> existing = contentRepo.findBySessionIdOrderByOrderIndexAsc(sessionId);
        List<ClassSessionContent> kept = existing.stream()
                .filter(c -> !ClassSessionContent.STATUS_PLANNED.equals(c.getStatus())
                        || c.getCarriedFromId() != null)
                .toList();
        List<ClassSessionContent> replaced = existing.stream()
                .filter(c -> ClassSessionContent.STATUS_PLANNED.equals(c.getStatus())
                        && c.getCarriedFromId() == null)
                .toList();

        Set<Long> keptItemIds = kept.stream()
                .map(ClassSessionContent::getCurriculumItemId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<ClassSessionContent> created = new ArrayList<>();
        Set<Long> seenItems = new HashSet<>();
        int order = kept.size(); // phần dở/đã xác nhận chiếm các vị trí đầu
        for (PlanSessionContentsRequest.PlanEntry entry : entries) {
            if (entry == null || entry.classLessonId() == null) {
                throw new BadRequestException("Mỗi dòng kế hoạch phải gắn một bài học (classLessonId)");
            }
            ClassLesson lesson = lessonRepo.findById(entry.classLessonId())
                    .orElseThrow(() -> new NotFoundException("Bài học không tồn tại"));
            if (!lesson.getClassId().equals(session.getClassId())) {
                throw new BadRequestException("Bài học không thuộc lớp của buổi này");
            }
            Long itemId = entry.curriculumItemId();
            if (itemId != null) {
                if (lesson.getLektionId() == null) {
                    throw new BadRequestException("Bài tự do/bổ trợ không gắn mục giáo trình");
                }
                CurriculumItem item = curriculumItemRepo.findById(itemId)
                        .orElseThrow(() -> new NotFoundException("Mục nội dung không tồn tại"));
                if (!Objects.equals(item.getLektionId(), lesson.getLektionId())) {
                    throw new BadRequestException("Mục nội dung không thuộc Lektion của bài này");
                }
                if (!seenItems.add(itemId)) {
                    throw new BadRequestException("Mục nội dung xuất hiện nhiều lần trong kế hoạch");
                }
                if (keptItemIds.contains(itemId)) {
                    throw new BadRequestException(
                            "Mục nội dung đã có trong phần chuyển tiếp/đã xác nhận của buổi — không thêm trùng");
                }
            }
            if (entry.plannedMinutes() != null && entry.plannedMinutes() <= 0) {
                throw new BadRequestException("Phút dự kiến phải lớn hơn 0");
            }
            created.add(ClassSessionContent.builder()
                    .sessionId(sessionId)
                    .classLessonId(lesson.getId())
                    .curriculumItemId(itemId)
                    .orderIndex(order++)
                    .plannedMinutes(entry.plannedMinutes())
                    .note(entry.note())
                    .build());
        }

        if (!replaced.isEmpty()) contentRepo.deleteAll(replaced);
        contentRepo.flush(); // DELETE xuống DB trước INSERT — tránh vỡ uq_csc_session_item khi giữ nguyên item
        if (!created.isEmpty()) contentRepo.saveAll(created);

        return toDto(session, contentRepo.findBySessionIdOrderByOrderIndexAsc(sessionId), 0);
    }

    /** Xác nhận kết quả thực tế; PARTIAL sinh/cập nhật dòng chuyển tiếp; recompute hoàn thành Lektion. */
    @Transactional
    public SessionContentsDto confirm(Long teacherId, Long sessionId, ConfirmSessionContentsRequest req) {
        ClassSession session = loadOwnedSession(teacherId, sessionId);
        assertNotCancelled(session);
        // P07: xác nhận lại kết quả của buổi quá cửa sổ 7 ngày cần mở khóa của người duyệt học vụ.
        recordEditGuard.assertEditable(session.getClassId(), teacherId, sessionId, session.getStartAt());
        List<ConfirmSessionContentsRequest.ConfirmEntry> entries =
                req == null || req.entries() == null ? List.of() : req.entries();
        if (entries.isEmpty()) {
            throw new BadRequestException("Không có mục nào để xác nhận");
        }

        Map<Long, ClassSessionContent> bySessionContent =
                contentRepo.findBySessionIdOrderByOrderIndexAsc(sessionId).stream()
                        .collect(Collectors.toMap(ClassSessionContent::getId, c -> c));

        List<Map<String, Object>> beforeRows = bySessionContent.values().stream()
                .map(c -> Map.<String, Object>of(
                        "id", c.getId(), "status", c.getStatus(),
                        "actual", String.valueOf(c.getActualMinutes()),
                        "remaining", String.valueOf(c.getRemainingMinutes())))
                .toList();

        int unallocatedCarry = 0;
        Set<Long> lessonsToRecompute = new HashSet<>();
        LocalDateTime now = LocalDateTime.now();

        for (ConfirmSessionContentsRequest.ConfirmEntry entry : entries) {
            ClassSessionContent content = entry == null ? null : bySessionContent.get(entry.contentId());
            if (content == null) {
                throw new NotFoundException("Mục phân bổ không thuộc buổi này");
            }
            String status = entry.status() == null ? "" : entry.status().trim().toUpperCase();
            if (!CONFIRM_STATUSES.contains(status)) {
                throw new BadRequestException("Trạng thái không hợp lệ: " + entry.status()
                        + " (chỉ nhận PLANNED, TAUGHT, PARTIAL)");
            }
            if (entry.actualMinutes() != null && entry.actualMinutes() < 0) {
                throw new BadRequestException("Phút thực dạy không được âm");
            }
            if (entry.remainingMinutes() != null && entry.remainingMinutes() <= 0) {
                throw new BadRequestException("Phút còn lại (ước tính) phải lớn hơn 0");
            }

            content.setStatus(status);
            content.setNote(entry.note() != null ? entry.note() : content.getNote());
            if (ClassSessionContent.STATUS_PLANNED.equals(status)) {
                content.setActualMinutes(null);
                content.setRemainingMinutes(null);
                content.setConfirmedBy(null);
                content.setConfirmedAt(null);
            } else {
                content.setActualMinutes(entry.actualMinutes());
                content.setRemainingMinutes(
                        ClassSessionContent.STATUS_PARTIAL.equals(status) ? entry.remainingMinutes() : null);
                content.setConfirmedBy(teacherId);
                content.setConfirmedAt(now);
            }
            contentRepo.save(content);

            unallocatedCarry += syncCarryOver(session, content);
            lessonsToRecompute.add(content.getClassLessonId());
        }

        lessonsToRecompute.forEach(lessonId -> recomputeLessonCompletion(lessonId, teacherId));

        // P07: một dòng lịch sử cho cả lượt xác nhận (before/after các dòng của buổi).
        recordEditGuard.revise(com.deutschflow.teacher.entity.ClassRecordRevision.EntityType.SESSION_CONTENT,
                sessionId, session.getClassId(), sessionId, teacherId, null, Map.of("rows", beforeRows),
                Map.of("rows", contentRepo.findBySessionIdOrderByOrderIndexAsc(sessionId).stream()
                        .map(c -> Map.<String, Object>of(
                                "id", c.getId(), "status", c.getStatus(),
                                "actual", String.valueOf(c.getActualMinutes()),
                                "remaining", String.valueOf(c.getRemainingMinutes())))
                        .toList()));
        return toDto(session, contentRepo.findBySessionIdOrderByOrderIndexAsc(sessionId), unallocatedCarry);
    }

    // ── Chuyển tiếp phần dở (AC06) ───────────────────────────────────────────

    /**
     * Đồng bộ dòng chuyển tiếp cho một content vừa xác nhận. Trả về số phút còn lại KHÔNG bố trí
     * được (không có buổi kế) để cộng vào cảnh báo — không lặng lẽ nuốt phần dở.
     */
    private int syncCarryOver(ClassSession session, ClassSessionContent content) {
        ClassSessionContent existingCarry = contentRepo
                .findByClassLessonIdOrderBySessionIdAscOrderIndexAsc(content.getClassLessonId()).stream()
                .filter(c -> Objects.equals(c.getCarriedFromId(), content.getId()))
                .findFirst().orElse(null);

        if (!ClassSessionContent.STATUS_PARTIAL.equals(content.getStatus())) {
            // Hết dở (TAUGHT hoặc hoàn tác) → dọn dòng chuyển tiếp còn ở trạng thái kế hoạch.
            if (existingCarry != null && ClassSessionContent.STATUS_PLANNED.equals(existingCarry.getStatus())) {
                contentRepo.delete(existingCarry);
            }
            return 0;
        }

        ClassSession next = nextTeachableSession(session);
        if (next == null) {
            return content.getRemainingMinutes() != null ? content.getRemainingMinutes() : 0;
        }
        if (existingCarry != null) {
            if (ClassSessionContent.STATUS_PLANNED.equals(existingCarry.getStatus())) {
                existingCarry.setPlannedMinutes(content.getRemainingMinutes());
                contentRepo.save(existingCarry);
            }
            return 0;
        }
        // Phần dở đứng ĐẦU buổi kế: dồn orderIndex các dòng hiện có xuống 1.
        List<ClassSessionContent> nextContents = contentRepo.findBySessionIdOrderByOrderIndexAsc(next.getId());
        for (ClassSessionContent c : nextContents) {
            c.setOrderIndex(c.getOrderIndex() + 1);
        }
        contentRepo.saveAll(nextContents);
        contentRepo.save(ClassSessionContent.builder()
                .sessionId(next.getId())
                .classLessonId(content.getClassLessonId())
                .curriculumItemId(content.getCurriculumItemId())
                .orderIndex(0)
                .plannedMinutes(content.getRemainingMinutes())
                .carriedFromId(content.getId())
                .build());
        return 0;
    }

    /** Buổi dạy kế tiếp của lớp sau buổi hiện tại (bỏ buổi đã hủy); null nếu hết lịch. */
    private ClassSession nextTeachableSession(ClassSession session) {
        return sessionRepo.findByClassIdAndStartAtBetweenOrderByStartAt(
                        session.getClassId(), session.getStartAt().plusMinutes(1),
                        session.getStartAt().plusYears(1))
                .stream()
                .filter(s -> s.getStatus() != ClassSession.Status.CANCELLED)
                .findFirst().orElse(null);
    }

    // ── Hoàn thành Lektion theo xác nhận (AC07/AC08) ─────────────────────────

    /**
     * Lesson giáo trình hoàn thành ⇔ MỌI mục bắt buộc của Lektion có ≥1 dòng TAUGHT. Hai chiều:
     * hoàn tác xác nhận làm bài trở lại chưa hoàn thành. Bài tự do không đi qua đây (toggle tay
     * ở tc-checklist như cũ).
     */
    private void recomputeLessonCompletion(Long classLessonId, Long teacherId) {
        ClassLesson lesson = lessonRepo.findById(classLessonId).orElse(null);
        if (lesson == null || lesson.getLektionId() == null) return;

        Set<Long> required = curriculumItemRepo.findByLektionIdOrderByOrderIndexAsc(lesson.getLektionId())
                .stream().map(CurriculumItem::getId).collect(Collectors.toSet());
        if (required.isEmpty()) return; // publish đã chặn Lektion rỗng — phòng hờ, không tự hoàn thành

        Set<Long> taught = new HashSet<>(contentRepo.findTaughtItemIds(classLessonId));
        boolean done = taught.containsAll(required);
        if (done == lesson.isCompleted()) return;

        lesson.setCompleted(done);
        lesson.setCompletedAt(done ? LocalDateTime.now() : null);
        lesson.setCompletedByTeacherId(done ? teacherId : null);
        lessonRepo.save(lesson);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ClassSession loadOwnedSession(Long teacherId, Long sessionId) {
        ClassSession session = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy buổi học"));
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(session.getClassId(), teacherId)) {
            throw new ForbiddenException("Bạn không có quyền với lớp của buổi này");
        }
        return session;
    }

    private static void assertNotCancelled(ClassSession session) {
        if (session.getStatus() == ClassSession.Status.CANCELLED) {
            throw new BadRequestException("Buổi đã hủy (nghỉ) — nội dung của nó dồn sang buổi kế theo lịch");
        }
    }

    private SessionContentsDto toDto(ClassSession session, List<ClassSessionContent> contents,
                                     int unallocatedCarry) {
        Map<Long, String> lessonTitles = contents.isEmpty() ? Map.of()
                : lessonRepo.findAllById(contents.stream()
                                .map(ClassSessionContent::getClassLessonId).distinct().toList())
                        .stream().collect(Collectors.toMap(ClassLesson::getId, ClassLesson::getTitle));
        Map<Long, String> itemTexts = contents.stream()
                .map(ClassSessionContent::getCurriculumItemId).filter(Objects::nonNull).distinct().toList()
                .isEmpty() ? Map.of()
                : curriculumItemRepo.findAllById(contents.stream()
                                .map(ClassSessionContent::getCurriculumItemId).filter(Objects::nonNull)
                                .distinct().toList())
                        .stream().collect(Collectors.toMap(CurriculumItem::getId, CurriculumItem::getText));

        int teaching = session.getTeachingMinutes() != null
                ? session.getTeachingMinutes()
                : session.getDurationMinutes() - session.getBreakMinutes();
        int plannedTotal = contents.stream()
                .filter(c -> c.getPlannedMinutes() != null)
                .mapToInt(ClassSessionContent::getPlannedMinutes).sum();

        List<SessionContentDto> dtos = contents.stream()
                .map(c -> new SessionContentDto(c.getId(), c.getSessionId(), c.getClassLessonId(),
                        lessonTitles.get(c.getClassLessonId()), c.getCurriculumItemId(),
                        c.getCurriculumItemId() != null ? itemTexts.get(c.getCurriculumItemId()) : null,
                        c.getOrderIndex(), c.getPlannedMinutes(), c.getStatus(), c.getActualMinutes(),
                        c.getRemainingMinutes(), c.getCarriedFromId(), c.getConfirmedAt(), c.getNote()))
                .toList();
        return new SessionContentsDto(session.getId(), teaching, plannedTotal, unallocatedCarry, dtos);
    }
}
