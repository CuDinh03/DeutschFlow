package com.deutschflow.teacher.service;

import com.deutschflow.teacher.dto.StudentPerformanceAnalyticsDto;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.StudentAssignmentRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.ErrorReviewTaskRepository;
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
    private final ErrorReviewTaskRepository reviewTaskRepository;
    private final UserErrorSkillRepository errorSkillRepository;
    private final UserRepository userRepository;

    public StudentPerformanceAnalyticsDto getComprehensiveAnalytics(Long classId, Long studentId) {
        String studentName = userRepository.findById(studentId)
                .map(User::getDisplayName)
                .orElse("Học sinh #" + studentId);

        LocalDateTime joinedAt = classStudentRepository
                .findById(new ClassStudentId(classId, studentId))
                .map(cs -> cs.getJoinedAt())
                .orElseGet(() -> LocalDateTime.now().minusDays(30));

        long preAssignmentCount = assignmentRepository.countCompletedBefore(studentId, joinedAt);
        double preAssignmentAvg  = assignmentRepository.avgScoreBefore(studentId, joinedAt);
        long preSpeakingCount    = speakingSessionRepository.countEndedBefore(studentId, joinedAt);
        double preSpeakingAvg    = speakingSessionRepository.avgScoreBefore(studentId, joinedAt);

        int pendingReviewItems = (int) reviewTaskRepository.findDueTasks(studentId, "PENDING", LocalDateTime.now(), org.springframework.data.domain.PageRequest.of(0, 9999)).size();

        StudentPerformanceAnalyticsDto.Metrics preMetrics = StudentPerformanceAnalyticsDto.Metrics.builder()
                .totalAssignmentsCompleted((int) preAssignmentCount)
                .averageScore(round2(preAssignmentAvg))
                .totalSpeakingSessions((int) preSpeakingCount)
                .averageSpeakingScore(round2(preSpeakingAvg))
                .pendingReviewItems(pendingReviewItems)
                .reviewCompletionRate(0d)
                .build();

        long inAssignmentCount = assignmentRepository.countCompletedAfter(studentId, joinedAt);
        double inAssignmentAvg  = assignmentRepository.avgScoreAfter(studentId, joinedAt);
        long inSpeakingCount    = speakingSessionRepository.countEndedAfter(studentId, joinedAt);
        double inSpeakingAvg    = speakingSessionRepository.avgScoreAfter(studentId, joinedAt);

        StudentPerformanceAnalyticsDto.Metrics inMetrics = StudentPerformanceAnalyticsDto.Metrics.builder()
                .totalAssignmentsCompleted((int) inAssignmentCount)
                .averageScore(round2(inAssignmentAvg))
                .totalSpeakingSessions((int) inSpeakingCount)
                .averageSpeakingScore(round2(inSpeakingAvg))
                .pendingReviewItems(pendingReviewItems)
                .reviewCompletionRate(inSpeakingCount + preSpeakingCount > 0 ? round2((double) inSpeakingCount / Math.max(1, inSpeakingCount + preSpeakingCount) * 100.0) : 0d)
                .build();

        List<String> topWeaknesses = errorSkillRepository
                .findByUserIdOrderByPriorityScoreDesc(studentId)
                .stream()
                .limit(5)
                .map(e -> String.format("%s (gặp %d lần%s)",
                        e.getErrorCode(),
                        e.getTotalCount(),
                        e.getLastSeverity() != null ? ", mức: " + e.getLastSeverity() : ""))
                .collect(Collectors.toList());

        List<String> recommendedNextActions = List.of(
                inSpeakingCount > 0 ? "Ưu tiên ôn lỗi speaking gần nhất" : "Khuyến khích làm speaking 1 phiên ngắn",
                inAssignmentCount < 3 ? "Giao thêm bài luyện tập cơ bản" : "Giữ nhịp ôn tập đều",
                topWeaknesses.isEmpty() ? "Theo dõi thêm tiến độ" : "Ôn lại 3 lỗi lặp lại nhiều nhất"
        );

        return StudentPerformanceAnalyticsDto.builder()
                .studentId(studentId)
                .studentName(studentName)
                .preClassMetrics(preMetrics)
                .inClassMetrics(inMetrics)
                .topWeaknesses(topWeaknesses)
                .recommendedNextActions(recommendedNextActions)
                .build();
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
