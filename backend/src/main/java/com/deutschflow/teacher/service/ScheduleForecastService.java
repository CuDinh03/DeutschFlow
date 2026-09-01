package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.entity.CurriculumItem;
import com.deutschflow.organization.repository.CurriculumItemRepository;
import com.deutschflow.teacher.dto.ScheduleForecastDto;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassMilestone;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.entity.ClassSessionContent;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassMilestoneRepository;
import com.deutschflow.teacher.repository.ClassSessionContentRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dự báo tiến độ theo phân bổ (PR-6, AC09/AC17). Phần TÍNH là hàm thuần
 * {@link #compute(int, List, List)} trên dữ liệu đã load — unit-test thẳng không cần mock;
 * service chỉ lo gom dữ liệu + quyền. Cùng một hàm dùng cho cả forecast hiện trạng lẫn bản
 * "dự kiến" của preview đề xuất (mô phỏng in-memory, không ghi DB).
 */
@Service
@RequiredArgsConstructor
public class ScheduleForecastService {

    /** Khung phút học chuẩn một buổi trung tâm (D04) — quy đổi phần thiếu thành số buổi cần thêm. */
    static final int ORG_TEACHING_MINUTES = 180;
    /** Mục giáo trình không khai phút ước lượng vẫn phải chiếm chỗ trong dự báo — đặt sàn 30′. */
    static final int DEFAULT_ITEM_MINUTES = 30;

    private final ClassTeacherRepository classTeacherRepo;
    private final ClassLessonRepository lessonRepository;
    private final CurriculumItemRepository curriculumItemRepository;
    private final ClassSessionContentRepository contentRepo;
    private final ClassSessionRepository sessionRepo;
    private final ClassMilestoneRepository milestoneRepo;

    /** Một buổi tương lai rút gọn cho phép tính (và cho mô phỏng preview). */
    public record FutureSession(LocalDate date, int teachingMinutes) {}

    @Transactional(readOnly = true)
    public ScheduleForecastDto forecastForTeacher(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp này");
        }
        return forecast(classId);
    }

    /** Dự báo hiện trạng của lớp — caller phía org đã tự kiểm quyền duyệt theo lớp. */
    @Transactional(readOnly = true)
    public ScheduleForecastDto forecast(Long classId) {
        return compute(remainingCurriculumMinutes(classId), futureSessions(classId),
                milestoneRepo.findByClassIdOrderByPlannedDateAsc(classId));
    }

    /**
     * AC09/AC17 — hàm thuần: đi qua các buổi tương lai theo thứ tự, cộng dồn phút học tới khi phủ
     * hết {@code remainingMinutes}. Đủ → projectedEndDate = ngày buổi đạt ngưỡng; thiếu → shortfall
     * + số buổi 180′ cần thêm (chỉ HIỂN THỊ nhu cầu). Mốc trước ngày-dự-kiến-xong (hoặc khi thiếu
     * khung) mang cờ atRisk — hệ thống không tự dời mốc, không bỏ bài.
     */
    public static ScheduleForecastDto compute(int remainingMinutes, List<FutureSession> future,
                                              List<ClassMilestone> milestones) {
        int available = future.stream().mapToInt(FutureSession::teachingMinutes).sum();

        LocalDate projectedEnd = null;
        if (remainingMinutes <= 0) {
            // Hết nợ nội dung: xong ngay — trước mọi buổi tương lai.
            projectedEnd = LocalDate.now();
        } else {
            int acc = 0;
            for (FutureSession s : future) {
                acc += s.teachingMinutes();
                if (acc >= remainingMinutes) {
                    projectedEnd = s.date();
                    break;
                }
            }
        }
        int shortfall = projectedEnd == null ? remainingMinutes - available : 0;
        int extraSessions = shortfall > 0 ? (shortfall + ORG_TEACHING_MINUTES - 1) / ORG_TEACHING_MINUTES : 0;

        final LocalDate end = projectedEnd;
        List<ScheduleForecastDto.MilestoneView> views = milestones.stream()
                .map(m -> new ScheduleForecastDto.MilestoneView(
                        m.getId(), m.getKind().name(), m.getTitle(), m.getPlannedDate(), m.getNote(),
                        end == null || m.getPlannedDate().isBefore(end)))
                .toList();

        return new ScheduleForecastDto(Math.max(0, remainingMinutes), available, future.size(),
                projectedEnd, Math.max(0, shortfall), extraSessions, views);
    }

    // ── Gom dữ liệu ─────────────────────────────────────────────────────────

    /** Buổi tương lai còn hiệu lực (bỏ CANCELLED), phút HỌC (legacy chưa tách = duration). */
    public List<FutureSession> futureSessions(Long classId) {
        LocalDateTime now = LocalDateTime.now();
        return sessionRepo.findByClassIdOrderByStartAt(classId).stream()
                .filter(s -> s.getStatus() != ClassSession.Status.CANCELLED)
                .filter(s -> !s.getStartAt().isBefore(now))
                .map(s -> new FutureSession(s.getStartAt().toLocalDate(),
                        s.getTeachingMinutes() != null ? s.getTeachingMinutes() : s.getDurationMinutes()))
                .toList();
    }

    /**
     * Tổng phút mục giáo trình bắt buộc CHƯA dạy xong trên các bài của lớp: item chưa TAUGHT tính
     * trọn {@code estimated_minutes} (sàn {@link #DEFAULT_ITEM_MINUTES}); item PARTIAL tính
     * {@code remaining_minutes} ước tính của lần xác nhận gần nhất.
     */
    public int remainingCurriculumMinutes(Long classId) {
        List<ClassLesson> lessons = lessonRepository.findByClassIdAndLektionIdIsNotNullOrderByOrderIndexAsc(classId);
        if (lessons.isEmpty()) return 0;

        List<ClassSessionContent> contents = contentRepo.findByClassLessonIdIn(
                lessons.stream().map(ClassLesson::getId).toList());
        Set<Long> taughtItemIds = new HashSet<>();
        Map<Long, Integer> partialRemaining = new HashMap<>();
        for (ClassSessionContent c : contents) {
            if (c.getCurriculumItemId() == null) continue;
            if ("TAUGHT".equals(c.getStatus())) {
                taughtItemIds.add(c.getCurriculumItemId());
            } else if ("PARTIAL".equals(c.getStatus()) && c.getRemainingMinutes() != null) {
                partialRemaining.merge(c.getCurriculumItemId(), c.getRemainingMinutes(), Math::min);
            }
        }

        int remaining = 0;
        List<Long> lektionIds = lessons.stream().map(ClassLesson::getLektionId).distinct().toList();
        for (Long lektionId : lektionIds) {
            for (CurriculumItem item : curriculumItemRepository.findByLektionIdOrderByOrderIndexAsc(lektionId)) {
                if (taughtItemIds.contains(item.getId())) continue;
                Integer est = item.getEstimatedMinutes();
                int full = est != null && est > 0 ? est : DEFAULT_ITEM_MINUTES;
                remaining += partialRemaining.getOrDefault(item.getId(), full);
            }
        }
        return remaining;
    }

    /** Bản sao danh sách buổi có điều chỉnh — cho preview mô phỏng của đề xuất (không ghi DB). */
    public static List<FutureSession> adjusted(List<FutureSession> base, List<FutureSession> add,
                                               List<LocalDate> removeDates) {
        List<FutureSession> out = new ArrayList<>(base);
        for (LocalDate d : removeDates) {
            out.removeIf(s -> s.date().equals(d));
        }
        out.addAll(add);
        out.sort(java.util.Comparator.comparing(FutureSession::date));
        return out;
    }
}
