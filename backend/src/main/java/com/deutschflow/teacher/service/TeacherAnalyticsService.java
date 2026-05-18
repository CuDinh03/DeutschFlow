package com.deutschflow.teacher.service;

import com.deutschflow.teacher.dto.StudentPerformanceAnalyticsDto;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherAnalyticsService {

    private final ClassStudentRepository classStudentRepository;
    private final StudentAssignmentRepository assignmentRepository;
    private final AiSpeakingSessionRepository speakingSessionRepository;
    private final UserErrorSkillRepository errorSkillRepository;
    private final UserRepository userRepository;

    /**
     * Thu thập dữ liệu phân tích thật của học sinh, phân chia Before/After thời điểm vào lớp.
     * Tất cả số liệu được tính bằng aggregation query trực tiếp tại DB — không pull records về RAM.
     */
    public StudentPerformanceAnalyticsDto getComprehensiveAnalytics(Long classId, Long studentId) {

        // 1. Lấy tên thật của học sinh
        String studentName = userRepository.findById(studentId)
                .map(User::getDisplayName)
                .orElse("Học sinh #" + studentId);

        // 2. Lấy mốc joinedAt thật từ bảng class_students
        LocalDateTime joinedAt = classStudentRepository
                .findById(new ClassStudentId(classId, studentId))
                .map(cs -> cs.getJoinedAt())
                .orElseGet(() -> {
                    log.warn("ClassStudent not found for classId={}, studentId={}. Fallback to 30 days ago.", classId, studentId);
                    return LocalDateTime.now().minusDays(30);
                });

        log.debug("Analytics for studentId={}, classId={}, joinedAt={}", studentId, classId, joinedAt);

        // 3. Pre-class metrics (trước joinedAt) — pure aggregation, no record loading
        long preAssignmentCount = assignmentRepository.countCompletedBefore(studentId, joinedAt);
        double preAssignmentAvg  = assignmentRepository.avgScoreBefore(studentId, joinedAt);
        long preSpeakingCount    = speakingSessionRepository.countEndedBefore(studentId, joinedAt);
        double preSpeakingAvg    = speakingSessionRepository.avgScoreBefore(studentId, joinedAt);

        StudentPerformanceAnalyticsDto.Metrics preMetrics = StudentPerformanceAnalyticsDto.Metrics.builder()
                .totalAssignmentsCompleted((int) preAssignmentCount)
                .averageScore(round2(preAssignmentAvg))
                .totalSpeakingSessions((int) preSpeakingCount)
                .averageSpeakingScore(round2(preSpeakingAvg))
                .build();

        // 4. In-class metrics (từ joinedAt trở đi) — pure aggregation
        long inAssignmentCount = assignmentRepository.countCompletedAfter(studentId, joinedAt);
        double inAssignmentAvg  = assignmentRepository.avgScoreAfter(studentId, joinedAt);
        long inSpeakingCount    = speakingSessionRepository.countEndedAfter(studentId, joinedAt);
        double inSpeakingAvg    = speakingSessionRepository.avgScoreAfter(studentId, joinedAt);

        StudentPerformanceAnalyticsDto.Metrics inMetrics = StudentPerformanceAnalyticsDto.Metrics.builder()
                .totalAssignmentsCompleted((int) inAssignmentCount)
                .averageScore(round2(inAssignmentAvg))
                .totalSpeakingSessions((int) inSpeakingCount)
                .averageSpeakingScore(round2(inSpeakingAvg))
                .build();

        // 5. Top điểm yếu thật — từ UserErrorSkill, sort by priorityScore DESC, limit 5
        List<String> topWeaknesses = errorSkillRepository
                .findByUserIdOrderByPriorityScoreDesc(studentId)
                .stream()
                .limit(5)
                .map(e -> String.format("%s (gặp %d lần%s)",
                        e.getErrorCode(),
                        e.getTotalCount(),
                        e.getLastSeverity() != null ? ", mức: " + e.getLastSeverity() : ""))
                .collect(Collectors.toList());

        return StudentPerformanceAnalyticsDto.builder()
                .studentId(studentId)
                .studentName(studentName)
                .preClassMetrics(preMetrics)
                .inClassMetrics(inMetrics)
                .topWeaknesses(topWeaknesses)
                .build();
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
