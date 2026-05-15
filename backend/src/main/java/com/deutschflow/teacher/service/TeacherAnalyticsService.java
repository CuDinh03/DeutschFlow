package com.deutschflow.teacher.service;

import com.deutschflow.teacher.dto.StudentPerformanceAnalyticsDto;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherAnalyticsService {

    // Note: Assuming these repositories exist. 
    // In a real implementation, you would inject ClassStudentRepository, StudentAssignmentRepository etc.
    // private final ClassStudentRepository classStudentRepository;
    // private final StudentAssignmentRepository assignmentRepository;
    private final AiSpeakingSessionRepository speakingSessionRepository;

    /**
     * Thu thập dữ liệu Before/After của học sinh dựa trên thời điểm vào lớp.
     */
    public StudentPerformanceAnalyticsDto getComprehensiveAnalytics(Long classId, Long studentId) {
        // 1. Lấy mốc thời gian joined_at mới nhất của học sinh trong lớp này
        // Instant joinedAt = classStudentRepository.findLatestJoinedAt(classId, studentId)
        //        .orElse(Instant.now().minus(30, ChronoUnit.DAYS)); // Mock fallback
        Instant joinedAt = Instant.now().minus(java.time.Duration.ofDays(14)); // Mock for compilation

        // 2. Query Metrics Before
        StudentPerformanceAnalyticsDto.Metrics preMetrics = StudentPerformanceAnalyticsDto.Metrics.builder()
                .totalAssignmentsCompleted(5) // assignmentRepository.countByStudentIdAndCreatedAtBefore(...)
                .averageScore(75.5)
                .totalSpeakingSessions(2)
                .averageSpeakingScore(65.0)
                .build();

        // 3. Query Metrics In-Class (After joined_at)
        StudentPerformanceAnalyticsDto.Metrics inMetrics = StudentPerformanceAnalyticsDto.Metrics.builder()
                .totalAssignmentsCompleted(8)
                .averageScore(88.0)
                .totalSpeakingSessions(4)
                .averageSpeakingScore(80.0)
                .build();

        // 4. Lấy Top lỗi sai (Mocked for now, in reality queried from ReviewQueue / Grammar mistakes)
        List<String> topWeaknesses = List.of(
                "Chia động từ Modalverben (Sai 15 lần)",
                "Giới từ đi với Dativ (Sai 10 lần)",
                "Trật tự từ trong câu phụ (Sai 8 lần)"
        );

        return StudentPerformanceAnalyticsDto.builder()
                .studentId(studentId)
                .studentName("Học sinh " + studentId)
                .preClassMetrics(preMetrics)
                .inClassMetrics(inMetrics)
                .topWeaknesses(topWeaknesses)
                .build();
    }
}
