package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.ClassSummaryDto;
import com.deutschflow.teacher.dto.ClassTrendDto;
import com.deutschflow.teacher.dto.GradebookDto;
import com.deutschflow.teacher.dto.SkillDistributionDto;
import com.deutschflow.teacher.entity.AssignmentStatus;
import com.deutschflow.teacher.entity.ClassAssignment;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.StudentAssignment;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassAssignmentRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Teacher reporting over the live classroom schema (teacher_classes / class_students /
 * class_assignments / student_assignments). Replaces the retired quiz-based report service,
 * which read a disconnected legacy schema.
 */
@Service
@RequiredArgsConstructor
public class TeacherReportService {

    private final TeacherClassRepository classRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassAssignmentRepository assignmentRepository;
    private final StudentAssignmentRepository studentAssignmentRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long teacherId) {
        List<TeacherClass> classes = classRepository.findByTeacherId(teacherId);
        List<Long> classIds = classes.stream().map(TeacherClass::getId).toList();

        // Audit L-4: one IN-list query instead of one query per class (N+1).
        Set<Long> studentIds = classIds.isEmpty()
                ? new HashSet<>()
                : classStudentRepository.findByIdClassIdIn(classIds).stream()
                        .map(cs -> cs.getId().getStudentId())
                        .collect(Collectors.toCollection(HashSet::new));

        List<ClassAssignment> assignments = classIds.isEmpty()
                ? List.of()
                : assignmentRepository.findByClassIdIn(classIds);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("classCount", classes.size());
        result.put("assignmentCount", assignments.size());
        result.put("studentCount", studentIds.size());
        result.put("avgScore", averageScore(assignments));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> classReport(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền xem báo cáo của lớp này");
        }

        long studentCount = classStudentRepository.countByIdClassId(classId);
        List<ClassAssignment> assignments = assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("classId", classId);
        result.put("studentCount", studentCount);
        result.put("assignmentCount", assignments.size());
        result.put("avgScore", averageScore(assignments));
        return result;
    }

    /**
     * Per-class summary rows for every class the teacher owns, in ONE pass (no N+1): sĩ số, số bài
     * đã giao và điểm trung bình lớp. Batch-loads students, assignments and submissions with three
     * IN-list queries, then groups in memory — replacing the analytics page's overview + one
     * classReport request per class. avgScore uses the same confirmed-only, one-vote-per-student
     * rule as {@link #averageScore}.
     */
    @Transactional(readOnly = true)
    public List<ClassSummaryDto> classesSummary(Long teacherId) {
        List<TeacherClass> classes = classRepository.findByTeacherId(teacherId);
        if (classes.isEmpty()) return List.of();
        List<Long> classIds = classes.stream().map(TeacherClass::getId).toList();

        Map<Long, Long> studentCountByClass = classStudentRepository.findByIdClassIdIn(classIds).stream()
                .collect(Collectors.groupingBy(cs -> cs.getId().getClassId(), Collectors.counting()));

        List<ClassAssignment> assignments = assignmentRepository.findByClassIdIn(classIds);
        Map<Long, Long> assignmentCountByClass = assignments.stream()
                .collect(Collectors.groupingBy(ClassAssignment::getClassId, Collectors.counting()));
        Map<Long, Long> classIdByAssignment = assignments.stream()
                .collect(Collectors.toMap(ClassAssignment::getId, ClassAssignment::getClassId, (a, b) -> a));

        List<StudentAssignment> submissions = assignments.isEmpty() ? List.of()
                : studentAssignmentRepository.findByAssignmentIds(
                        assignments.stream().map(ClassAssignment::getId).toList());
        Map<Long, List<StudentAssignment>> submissionsByClass = new HashMap<>();
        for (StudentAssignment sa : submissions) {
            Long cId = classIdByAssignment.get(sa.getAssignmentId());
            if (cId == null) continue;
            submissionsByClass.computeIfAbsent(cId, k -> new ArrayList<>()).add(sa);
        }

        List<ClassSummaryDto> rows = new ArrayList<>();
        for (TeacherClass c : classes) {
            rows.add(new ClassSummaryDto(
                    c.getId(),
                    c.getName(),
                    studentCountByClass.getOrDefault(c.getId(), 0L),
                    assignmentCountByClass.getOrDefault(c.getId(), 0L),
                    averageOfStudentAverages(submissionsByClass.getOrDefault(c.getId(), List.of()))));
        }
        return rows;
    }

    private static final int TREND_MAX_WEEKS = 12;

    /**
     * Weekly average of confirmed grades per class for the analytics trend chart. Buckets are ISO
     * weeks, sorted oldest → newest and capped to the most recent {@value #TREND_MAX_WEEKS}. A class
     * with no confirmed grades (or only grades outside the window) is omitted; within a kept series a
     * week with no data is a null so the chart draws a gap rather than a false zero.
     */
    @Transactional(readOnly = true)
    public ClassTrendDto weeklyTrends(Long teacherId) {
        List<TeacherClass> classes = classRepository.findByTeacherId(teacherId);
        if (classes.isEmpty()) return new ClassTrendDto(List.of(), List.of());
        List<Long> classIds = classes.stream().map(TeacherClass::getId).toList();

        Map<Long, Map<String, Double>> avgByClassAndWeek = new HashMap<>();
        TreeSet<String> weeks = new TreeSet<>(); // ISO week strings sort lexicographically = chronological
        for (Object[] row : studentAssignmentRepository.findWeeklyConfirmedAverages(classIds)) {
            Long classId = ((Number) row[0]).longValue();
            String week = (String) row[1];
            double avg = round1(((Number) row[2]).doubleValue());
            weeks.add(week);
            avgByClassAndWeek.computeIfAbsent(classId, k -> new HashMap<>()).put(week, avg);
        }

        List<String> allWeeks = new ArrayList<>(weeks);
        List<String> buckets = allWeeks.size() > TREND_MAX_WEEKS
                ? new ArrayList<>(allWeeks.subList(allWeeks.size() - TREND_MAX_WEEKS, allWeeks.size()))
                : allWeeks;

        List<ClassTrendDto.Series> series = new ArrayList<>();
        for (TeacherClass c : classes) {
            Map<String, Double> byWeek = avgByClassAndWeek.get(c.getId());
            if (byWeek == null) continue; // no confirmed grades at all
            List<Double> values = buckets.stream().map(byWeek::get).toList();
            if (values.stream().allMatch(v -> v == null)) continue; // all data fell outside the window
            series.add(new ClassTrendDto.Series(c.getId(), c.getName(), values));
        }
        return new ClassTrendDto(buckets, series);
    }

    /**
     * Cross-class distribution of the four teacher-set skill scores (0–10), averaged over every
     * student in the teacher's classes. A skill with no ratings is null. Feeds the analytics
     * skill-distribution chart.
     */
    @Transactional(readOnly = true)
    public SkillDistributionDto skillDistribution(Long teacherId) {
        List<TeacherClass> classes = classRepository.findByTeacherId(teacherId);
        if (classes.isEmpty()) return new SkillDistributionDto(null, null, null, null, 0);
        List<Long> classIds = classes.stream().map(TeacherClass::getId).toList();

        // A student can be enrolled in several of the teacher's classes, each carrying its own skill
        // row. Collapse to ONE vector per student (mean of their non-null ratings per skill across
        // enrollments) so a multi-class student counts once — matching the DTO's per-student semantics
        // and the distinct-student dedup already used by overview().
        Map<Long, double[]> sumByStudent = new HashMap<>();
        Map<Long, int[]> countByStudent = new HashMap<>();
        for (ClassStudent cs : classStudentRepository.findByIdClassIdIn(classIds)) {
            Long studentId = cs.getId().getStudentId();
            BigDecimal[] skills = {
                    cs.getSkillHoren(), cs.getSkillLesen(), cs.getSkillSchreiben(), cs.getSkillSprechen()
            };
            double[] sums = sumByStudent.computeIfAbsent(studentId, k -> new double[4]);
            int[] counts = countByStudent.computeIfAbsent(studentId, k -> new int[4]);
            for (int i = 0; i < skills.length; i++) {
                if (skills[i] != null) {
                    sums[i] += skills[i].doubleValue();
                    counts[i] += 1;
                }
            }
        }

        double[] skillTotals = new double[4];
        int[] ratedStudentsPerSkill = new int[4];
        long rated = 0;
        for (Long studentId : sumByStudent.keySet()) {
            double[] sums = sumByStudent.get(studentId);
            int[] counts = countByStudent.get(studentId);
            boolean anyRated = false;
            for (int i = 0; i < 4; i++) {
                if (counts[i] > 0) {
                    skillTotals[i] += sums[i] / counts[i]; // this student's mean for skill i
                    ratedStudentsPerSkill[i] += 1;
                    anyRated = true;
                }
            }
            if (anyRated) rated += 1;
        }
        return new SkillDistributionDto(
                skillAverage(skillTotals[0], ratedStudentsPerSkill[0]),
                skillAverage(skillTotals[1], ratedStudentsPerSkill[1]),
                skillAverage(skillTotals[2], ratedStudentsPerSkill[2]),
                skillAverage(skillTotals[3], ratedStudentsPerSkill[3]),
                rated);
    }

    private static Double skillAverage(double sum, int count) {
        return count > 0 ? round1(sum / count) : null;
    }

    /**
     * Sổ điểm lớp: ma trận học viên × bài tập. Hàng sắp theo tên học viên,
     * cột theo thứ tự giao bài cũ → mới. avgScore mỗi học viên = trung bình
     * các ô đã có điểm (null nếu chưa bài nào được chấm).
     */
    @Transactional(readOnly = true)
    public GradebookDto gradebook(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền xem báo cáo của lớp này");
        }
        return buildGradebook(classId);
    }

    /** M-17 (G-3): sổ điểm cho org-admin — verify lớp thuộc org caller; lớp org khác → NotFound. */
    @Transactional(readOnly = true)
    public GradebookDto gradebookForOrg(Long orgId, Long classId) {
        TeacherClass scoped = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));
        if (!orgId.equals(scoped.getOrgId())) {
            throw new NotFoundException("Lớp học không tồn tại");
        }
        return buildGradebook(classId);
    }

    private GradebookDto buildGradebook(Long classId) {
        TeacherClass teacherClass = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Lớp học không tồn tại"));

        List<ClassAssignment> assignments = new ArrayList<>(
                assignmentRepository.findByClassIdOrderByCreatedAtDesc(classId));
        Collections.reverse(assignments); // cũ → mới cho chiều đọc sổ điểm

        List<GradebookDto.AssignmentColumn> columns = assignments.stream()
                .map(a -> new GradebookDto.AssignmentColumn(a.getId(), a.getTopic(), a.getAssignmentType(), a.getSkill(), a.getDueDate()))
                .toList();

        // studentId → assignmentId → bài nộp
        Map<Long, Map<Long, StudentAssignment>> submissionsByStudent = new HashMap<>();
        if (!assignments.isEmpty()) {
            List<Long> assignmentIds = assignments.stream().map(ClassAssignment::getId).toList();
            for (StudentAssignment sa : studentAssignmentRepository.findByAssignmentIds(assignmentIds)) {
                submissionsByStudent
                        .computeIfAbsent(sa.getStudentId(), k -> new HashMap<>())
                        .put(sa.getAssignmentId(), sa);
            }
        }

        List<Long> studentIds = classStudentRepository.findByIdClassId(classId).stream()
                .map(cs -> cs.getId().getStudentId())
                .toList();
        Map<Long, User> usersById = studentIds.isEmpty() ? Map.of()
                : userRepository.findAllById(studentIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        List<GradebookDto.StudentRow> rows = new ArrayList<>();
        for (Long studentId : studentIds) {
            User user = usersById.get(studentId);
            Map<Long, StudentAssignment> byAssignment = submissionsByStudent.getOrDefault(studentId, Map.of());

            Map<Long, GradebookDto.Cell> cells = new LinkedHashMap<>();
            List<Integer> scores = new ArrayList<>();
            for (ClassAssignment a : assignments) {
                StudentAssignment sa = byAssignment.get(a.getId());
                if (sa == null) continue; // chưa từng được giao → ô trống
                cells.put(a.getId(), new GradebookDto.Cell(sa.getStatus(), sa.getScore(), sa.getSubmittedAt()));
                // Only a CONFIRMED grade may move the average. An AI_GRADED row carries a score, but it is
                // a proposal nobody has signed off — counting it would let the AI quietly set the average.
                if (sa.getScore() != null && AssignmentStatus.isFinal(sa.getStatus())) scores.add(sa.getScore());
            }

            Double avgScore = scores.isEmpty() ? null
                    : round1(scores.stream().mapToInt(TeacherReportService::clampPercent).average().orElse(0.0));
            rows.add(new GradebookDto.StudentRow(
                    studentId,
                    user != null ? user.getDisplayName() : "Học viên #" + studentId,
                    user != null ? user.getEmail() : "",
                    avgScore,
                    cells));
        }
        rows.sort(Comparator.comparing(r -> r.name() == null ? "" : r.name(), String.CASE_INSENSITIVE_ORDER));

        return new GradebookDto(classId, teacherClass.getName(), columns, rows);
    }

    /**
     * Class-level average score across the given assignments (0 when none), on a 0-100 scale.
     *
     * <p>Two rules keep this honest and consistent with the gradebook:
     * <ul>
     *   <li><b>Confirmed grades only.</b> Only {@link AssignmentStatus#isFinal} grades count. An
     *       AI_GRADED row carries a score but is an unconfirmed proposal — counting it would let the
     *       AI silently move the average and would disagree with the gradebook, which already
     *       excludes it (this was the bug where the same "Điểm TB" differed between the two pages).</li>
     *   <li><b>One vote per student.</b> Each student's finalized-grade mean is computed first, then
     *       those per-student means are averaged — so a student who submitted many assignments does
     *       not outweigh one who submitted few.</li>
     * </ul>
     * Every score is clamped to [0,100] first (out-of-range manual entry — the "234.4 on a 10-point
     * scale" bug).
     */
    private double averageScore(List<ClassAssignment> assignments) {
        if (assignments.isEmpty()) return 0.0;
        List<Long> assignmentIds = assignments.stream().map(ClassAssignment::getId).toList();
        return averageOfStudentAverages(studentAssignmentRepository.findByAssignmentIds(assignmentIds));
    }

    /** Average of each student's finalized-grade mean (see {@link #averageScore}). 0 when none. */
    private double averageOfStudentAverages(List<StudentAssignment> submissions) {
        Map<Long, List<Integer>> scoresByStudent = new HashMap<>();
        for (StudentAssignment sa : submissions) {
            if (sa.getScore() == null || !AssignmentStatus.isFinal(sa.getStatus())) continue;
            scoresByStudent
                    .computeIfAbsent(sa.getStudentId(), k -> new ArrayList<>())
                    .add(clampPercent(sa.getScore()));
        }
        if (scoresByStudent.isEmpty()) return 0.0;
        double sumOfStudentAverages = scoresByStudent.values().stream()
                .mapToDouble(scores -> scores.stream().mapToInt(Integer::intValue).average().orElse(0.0))
                .sum();
        return round1(sumOfStudentAverages / scoresByStudent.size());
    }

    /** Scores are graded on 0-100; clamp defensively (manual entry isn't capped at the source). */
    private static int clampPercent(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
