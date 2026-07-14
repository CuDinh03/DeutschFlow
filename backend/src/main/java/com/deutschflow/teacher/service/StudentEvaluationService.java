package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.MySkillReportDto;
import com.deutschflow.teacher.dto.SkillReportDto;
import com.deutschflow.teacher.dto.StudentAttendanceDto;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.dto.StudentEvaluationRequest;
import com.deutschflow.teacher.entity.*;
import com.deutschflow.teacher.repository.*;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentEvaluationService {

    /**
     * Certificate gate. {@code avgScore} is the mean of {@link StudentAssignment#getScore()}, which is a
     * 0–100 grade (GradingService validates 0–100) — NOT the 0–10 scale used by the manual {@code skill_*}
     * columns. The threshold must live on the same scale: 50/100 is the pass mark.
     */
    private static final double CERT_MIN_AVG_SCORE = 50.0;   // 0–100 scale
    private static final double CERT_MIN_ATTENDANCE = 0.8;   // 80% of recorded sessions

    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassLessonLogRepository lessonLogRepository;
    private final ClassAttendanceRepository attendanceRepository;
    private final ClassAssignmentRepository assignmentRepository;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final TeacherClassRepository classRepository;
    private final UserRepository userRepository;

    @Transactional
    public StudentEvaluationDto saveEvaluation(Long teacherId, Long classId, Long studentId,
                                                StudentEvaluationRequest req) {
        assertTeacherOwnsClass(teacherId, classId);
        ClassStudent cs = classStudentRepository.findById(new ClassStudentId(classId, studentId))
                .orElseThrow(() -> new NotFoundException("Học viên không thuộc lớp này"));

        cs.setTeacherComment(req.teacherComment());
        cs.setSkillHoren(req.skillHoren());
        cs.setSkillLesen(req.skillLesen());
        cs.setSkillSchreiben(req.skillSchreiben());
        cs.setSkillSprechen(req.skillSprechen());
        cs.setEvaluatedAt(LocalDateTime.now());
        classStudentRepository.save(cs);

        return buildEvaluationDto(teacherId, classId, studentId, cs);
    }

    @Transactional(readOnly = true)
    public StudentEvaluationDto getEvaluation(Long teacherId, Long classId, Long studentId) {
        assertTeacherOwnsClass(teacherId, classId);
        ClassStudent cs = classStudentRepository.findById(new ClassStudentId(classId, studentId))
                .orElseThrow(() -> new NotFoundException("Học viên không thuộc lớp này"));
        return buildEvaluationDto(teacherId, classId, studentId, cs);
    }

    @Transactional(readOnly = true)
    public List<StudentEvaluationDto> getAllEvaluations(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);
        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        return students.stream()
                .map(cs -> buildEvaluationDto(teacherId, classId, cs.getId().getStudentId(), cs))
                .sorted(Comparator.comparing(StudentEvaluationDto::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * Bảng điểm 4 kỹ năng: dùng điểm đã lưu trực tiếp từ teacher evaluation.
     * Fallback: tính trung bình từ bài tập đã chấm nếu chưa có evaluation.
     */
    @Transactional(readOnly = true)
    public SkillReportDto skillReport(Long teacherId, Long classId) {
        assertTeacherOwnsClass(teacherId, classId);
        TeacherClass cls = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));

        List<ClassStudent> students = classStudentRepository.findByIdClassId(classId);
        List<Long> studentIds = students.stream().map(cs -> cs.getId().getStudentId()).toList();
        Map<Long, User> users = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        // Fallback: skill-tagged assignment averages per student
        List<ClassAssignment> assignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);
        Map<Long, Map<String, List<Integer>>> assignmentScoresByStudentAndSkill = new HashMap<>();
        if (!assignments.isEmpty()) {
            List<Long> assignmentIds = assignments.stream().map(ClassAssignment::getId).toList();
            Map<Long, String> skillByAssignment = assignments.stream()
                    .filter(a -> a.getSkill() != null)
                    .collect(Collectors.toMap(ClassAssignment::getId,
                            a -> a.getSkill().toUpperCase()));
            for (StudentAssignment sa : studentAssignmentRepository.findByAssignmentIds(assignmentIds)) {
                if (sa.getScore() == null) continue;
                String skill = skillByAssignment.getOrDefault(sa.getAssignmentId(), "GENERAL");
                assignmentScoresByStudentAndSkill
                        .computeIfAbsent(sa.getStudentId(), k -> new HashMap<>())
                        .computeIfAbsent(skill, k -> new ArrayList<>())
                        .add(sa.getScore());
            }
        }

        List<SkillReportDto.StudentSkillRow> rows = students.stream().map(cs -> {
            Long sid = cs.getId().getStudentId();
            User u = users.get(sid);

            Double horen = toDouble(cs.getSkillHoren(),
                    assignmentScoresByStudentAndSkill.getOrDefault(sid, Map.of()).get("HOREN"));
            Double lesen = toDouble(cs.getSkillLesen(),
                    assignmentScoresByStudentAndSkill.getOrDefault(sid, Map.of()).get("LESEN"));
            Double schreiben = toDouble(cs.getSkillSchreiben(),
                    assignmentScoresByStudentAndSkill.getOrDefault(sid, Map.of()).get("SCHREIBEN"));
            Double sprechen = toDouble(cs.getSkillSprechen(),
                    assignmentScoresByStudentAndSkill.getOrDefault(sid, Map.of()).get("SPRECHEN"));

            Double total = avgOfPresent(horen, lesen, schreiben, sprechen);
            return new SkillReportDto.StudentSkillRow(sid,
                    u != null ? u.getDisplayName() : "Học viên #" + sid,
                    u != null ? u.getEmail() : "",
                    horen, lesen, schreiben, sprechen, total,
                    SkillReportDto.gradeOf(total));
        }).sorted(Comparator.comparing(r -> r.name() == null ? "" : r.name(), String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new SkillReportDto(classId, cls.getName(), rows);
    }

    // ── Student-facing reads (P4): a student may see ONLY their own data ────────

    /**
     * The requesting student's own attendance for a class — one row per session log, with
     * PRESENT/ABSENT/LATE (or null when not marked). Never exposes other students' attendance.
     */
    @Transactional(readOnly = true)
    public List<StudentAttendanceDto> myAttendance(Long studentId, Long classId) {
        assertEnrolled(studentId, classId);
        List<ClassLessonLog> logs = lessonLogRepository.findByClassIdOrderBySessionDateDesc(classId);
        if (logs.isEmpty()) return List.of();
        List<Long> logIds = logs.stream().map(ClassLessonLog::getId).toList();
        Map<Long, ClassAttendance> mine = attendanceRepository.findByLessonLogIds(logIds).stream()
                .filter(a -> a.getId().getStudentId().equals(studentId))
                .collect(Collectors.toMap(a -> a.getId().getLessonLogId(), a -> a, (a, b) -> a));
        return logs.stream()
                .map(log -> {
                    ClassAttendance att = mine.get(log.getId());
                    return new StudentAttendanceDto(
                            log.getId(), log.getSessionDate(), log.getSessionNumber(), log.getTopic(),
                            att != null ? att.getStatus() : null,
                            att != null ? att.getNote() : null);
                })
                .toList();
    }

    /**
     * The requesting student's OWN 4-skill report row (teacher-set score, or their own
     * skill-tagged assignment averages as a fallback). Never returns the class list.
     */
    @Transactional(readOnly = true)
    public MySkillReportDto mySkillReport(Long studentId, Long classId) {
        assertEnrolled(studentId, classId);
        ClassStudent cs = classStudentRepository.findById(new ClassStudentId(classId, studentId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy lớp học"));

        Map<String, List<Integer>> myScoresBySkill = new HashMap<>();
        List<ClassAssignment> assignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);
        if (!assignments.isEmpty()) {
            List<Long> assignmentIds = assignments.stream().map(ClassAssignment::getId).toList();
            Map<Long, String> skillByAssignment = assignments.stream()
                    .filter(a -> a.getSkill() != null)
                    .collect(Collectors.toMap(ClassAssignment::getId, a -> a.getSkill().toUpperCase()));
            for (StudentAssignment sa : studentAssignmentRepository.findByAssignmentIds(assignmentIds)) {
                if (sa.getScore() == null || !sa.getStudentId().equals(studentId)) continue;
                String skill = skillByAssignment.getOrDefault(sa.getAssignmentId(), "GENERAL");
                myScoresBySkill.computeIfAbsent(skill, k -> new ArrayList<>()).add(sa.getScore());
            }
        }

        Double horen = toDouble(cs.getSkillHoren(), myScoresBySkill.get("HOREN"));
        Double lesen = toDouble(cs.getSkillLesen(), myScoresBySkill.get("LESEN"));
        Double schreiben = toDouble(cs.getSkillSchreiben(), myScoresBySkill.get("SCHREIBEN"));
        Double sprechen = toDouble(cs.getSkillSprechen(), myScoresBySkill.get("SPRECHEN"));
        Double total = avgOfPresent(horen, lesen, schreiben, sprechen);
        return new MySkillReportDto(horen, lesen, schreiben, sprechen, total, SkillReportDto.gradeOf(total));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void assertTeacherOwnsClass(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền truy cập lớp này");
        }
    }

    /** A student may only read their own class data — reject non-members. */
    private void assertEnrolled(Long studentId, Long classId) {
        if (!classStudentRepository.existsById(new ClassStudentId(classId, studentId))) {
            throw new NotFoundException("Không tìm thấy lớp học");
        }
    }

    private StudentEvaluationDto buildEvaluationDto(Long teacherId, Long classId, Long studentId,
                                                      ClassStudent cs) {
        User u = userRepository.findById(studentId).orElse(null);
        TeacherClass cls = classRepository.findById(classId).orElse(null);

        // Attendance stats
        List<ClassLessonLog> logs = lessonLogRepository.findByClassIdOrderBySessionDateDesc(classId);
        List<Long> logIds = logs.stream().map(ClassLessonLog::getId).toList();
        List<ClassAttendance> allAtt = logIds.isEmpty() ? List.of()
                : attendanceRepository.findByLessonLogIds(logIds);
        List<ClassAttendance> myAtt = allAtt.stream()
                .filter(a -> a.getId().getStudentId().equals(studentId)).toList();
        int presentCount = (int) myAtt.stream().filter(a -> "PRESENT".equals(a.getStatus())).count();
        int absentCount  = (int) myAtt.stream().filter(a -> "ABSENT".equals(a.getStatus())).count();
        int lateCount    = (int) myAtt.stream().filter(a -> "LATE".equals(a.getStatus())).count();
        int totalSessions = logs.size();

        // Avg score from assignments
        List<ClassAssignment> assignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);
        double avgScore = 0.0;
        if (!assignments.isEmpty()) {
            List<Long> aIds = assignments.stream().map(ClassAssignment::getId).toList();
            OptionalDouble avg = studentAssignmentRepository.findByAssignmentIds(aIds).stream()
                    .filter(sa -> sa.getStudentId().equals(studentId) && sa.getScore() != null)
                    .mapToInt(StudentAssignment::getScore)
                    .average();
            if (avg.isPresent()) avgScore = avg.getAsDouble();
        }

        // Certificate: avg assignment score >= 50/100 AND attendance >= 80% of recorded sessions.
        // A class with no lesson logs yet has no attendance evidence at all — it must not read as a
        // perfect 100% (the old `totalSessions == 0 ? 1.0` made a brand-new class instantly eligible).
        boolean hasAttendanceEvidence = totalSessions > 0;
        double attendanceRate = hasAttendanceEvidence
                ? (double) (presentCount + lateCount) / totalSessions
                : 0.0;
        boolean eligible = hasAttendanceEvidence
                && avgScore >= CERT_MIN_AVG_SCORE
                && attendanceRate >= CERT_MIN_ATTENDANCE;

        return new StudentEvaluationDto(
                studentId,
                u != null ? u.getDisplayName() : "Học viên #" + studentId,
                u != null ? u.getEmail() : "",
                classId,
                cls != null ? cls.getName() : "",
                cs.getTeacherComment(),
                cs.getSkillHoren(), cs.getSkillLesen(), cs.getSkillSchreiben(), cs.getSkillSprechen(),
                avgScore, totalSessions, presentCount, absentCount, lateCount, eligible,
                cs.getEvaluatedAt());
    }

    /**
     * Resolves a skill score onto the 0–10 scale used by the manual {@code skill_*} columns
     * (V232 CHECK) and {@link SkillReportDto#gradeOf}. The assignment-derived fallback is a
     * 0–100 grade (GradingService), so it MUST be normalized to 0–10 before it is averaged with
     * manual scores or graded — otherwise a 75/100 fallback maps to "Xuất sắc" (audit H-4).
     */
    private Double toDouble(BigDecimal explicit, List<Integer> fallbackScores) {
        if (explicit != null) return explicit.doubleValue();
        if (fallbackScores == null || fallbackScores.isEmpty()) return null;
        double avg100 = fallbackScores.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        return avg100 / 10.0;
    }

    private Double avgOfPresent(Double... values) {
        double sum = 0; int count = 0;
        for (Double v : values) { if (v != null) { sum += v; count++; } }
        return count == 0 ? null : sum / count;
    }
}
