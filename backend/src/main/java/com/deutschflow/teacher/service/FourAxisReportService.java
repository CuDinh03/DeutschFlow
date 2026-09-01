package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.teacher.dto.FourAxisReportDto;
import com.deutschflow.teacher.dto.ObjectiveMatrixDto;
import com.deutschflow.teacher.dto.ScheduleForecastDto;
import com.deutschflow.teacher.entity.ClassLesson;
import com.deutschflow.teacher.entity.ClassSession;
import com.deutschflow.teacher.repository.ClassAttendanceRepository;
import com.deutschflow.teacher.repository.ClassLessonLogRepository;
import com.deutschflow.teacher.repository.ClassLessonRepository;
import com.deutschflow.teacher.repository.ClassSessionRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Báo cáo 4 trục (PR-10, spec §7) — thuần TỔNG HỢP từ dữ liệu các PR trước: phân bổ nội dung
 * (PR-4), dự báo (PR-6), điểm danh + chốt buổi (PR-7), đánh giá mục tiêu (PR-9). Không bảng mới,
 * không ghi gì.
 */
@Service
@RequiredArgsConstructor
public class FourAxisReportService {

    private final ClassTeacherRepository classTeacherRepo;
    private final ClassLessonRepository lessonRepo;
    private final ClassSessionRepository sessionRepo;
    private final ClassLessonLogRepository lessonLogRepo;
    private final ClassAttendanceRepository attendanceRepo;
    private final ScheduleForecastService forecastService;
    private final ObjectiveAssessmentService objectiveAssessmentService;

    @Transactional(readOnly = true)
    public FourAxisReportDto report(Long teacherId, Long classId) {
        if (!classTeacherRepo.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không dạy lớp này");
        }
        return new FourAxisReportDto(classId,
                content(classId),
                pacing(classId),
                participation(classId),
                objectives(teacherId, classId));
    }

    private FourAxisReportDto.Content content(Long classId) {
        // Mục đã dạy tính qua remaining-logic của forecast không tách taught/partial → đếm trực tiếp
        // qua trạng thái phân bổ: dùng lesson list (giáo trình) + item TAUGHT từ recompute (PR-4)
        // phản chiếu ở lesson.completed; chi tiết mục ở cấp forecast.remaining.
        List<ClassLesson> curriculumLessons = lessonRepo.findByClassIdAndLektionIdIsNotNullOrderByOrderIndexAsc(classId);
        int completedLessons = (int) curriculumLessons.stream().filter(ClassLesson::isCompleted).count();
        ForecastCounts fc = forecastCounts(classId);
        return new FourAxisReportDto.Content(fc.taught(), fc.partial(), fc.total(),
                completedLessons, curriculumLessons.size());
    }

    /** Đếm mục TAUGHT/PARTIAL/tổng của giáo trình lớp — cùng nguồn dữ liệu với forecast (PR-4). */
    private ForecastCounts forecastCounts(Long classId) {
        var counts = forecastService.itemStatusCounts(classId);
        return new ForecastCounts(counts.taught(), counts.partial(), counts.total());
    }

    private record ForecastCounts(int taught, int partial, int total) {}

    private FourAxisReportDto.Pacing pacing(Long classId) {
        ScheduleForecastDto fc = forecastService.forecast(classId);
        int atRisk = (int) fc.milestones().stream().filter(ScheduleForecastDto.MilestoneView::atRisk).count();
        return new FourAxisReportDto.Pacing(fc.projectedEndDate(), fc.remainingMinutes(),
                fc.availableMinutes(), fc.shortfallMinutes(), fc.suggestedExtraSessions(), atRisk);
    }

    private FourAxisReportDto.Participation participation(Long classId) {
        List<Long> logIds = lessonLogRepo.findByClassIdOrderBySessionDateDesc(classId).stream()
                .map(l -> l.getId())
                .toList();
        long present = 0, late = 0, absent = 0, needsMakeup = 0;
        if (!logIds.isEmpty()) {
            for (var a : attendanceRepo.findByLessonLogIds(logIds)) {
                switch (a.getStatus()) {
                    case "PRESENT" -> present++;
                    case "LATE" -> late++;
                    case "ABSENT" -> absent++;
                    default -> { }
                }
                if (a.isNeedsMakeup()) needsMakeup++;
            }
        }
        LocalDateTime now = LocalDateTime.now();
        List<ClassSession> past = sessionRepo.findByClassIdOrderByStartAt(classId).stream()
                .filter(s -> s.getStatus() != ClassSession.Status.CANCELLED)
                .filter(s -> s.getStartAt().isBefore(now))
                .toList();
        int completed = (int) past.stream().filter(s -> s.getCompletedAt() != null).count();
        return new FourAxisReportDto.Participation(present, late, absent, needsMakeup, completed, past.size());
    }

    private FourAxisReportDto.Objectives objectives(Long teacherId, Long classId) {
        ObjectiveMatrixDto m;
        try {
            m = objectiveAssessmentService.matrix(teacherId, classId);
        } catch (Exception e) {
            // Lớp chưa gắn giáo trình → trục mục tiêu trống trung thực, ba trục kia vẫn có.
            return new FourAxisReportDto.Objectives(0, 0, 0, 0, List.of());
        }
        long achieved = 0, needs = 0, notAssessed = 0;
        for (ObjectiveMatrixDto.StudentRow r : m.students()) {
            for (ObjectiveMatrixDto.Cell c : r.cells()) {
                switch (c.status()) {
                    case "ACHIEVED" -> achieved++;
                    case "NEEDS_PRACTICE" -> needs++;
                    default -> notAssessed++;
                }
            }
        }
        List<String> needingSupport = m.suggestions().stream()
                .flatMap(sg -> sg.studentNames().stream())
                .distinct()
                .toList();
        return new FourAxisReportDto.Objectives(achieved, needs, notAssessed,
                m.objectives().size(), needingSupport);
    }
}
