package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.SessionCompleteResponse;
import com.deutschflow.user.entity.LearningSessionProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Tiến độ buổi học trong lộ trình.
 *
 * <p><b>A2 (09/11/2026) — không tin số liệu client.</b> Trước đây {@code POST /sessions/complete} lưu
 * nguyên {@code abilityScore}/{@code timeSeconds} client gửi và đánh dấu COMPLETED mà không cần bài nộp,
 * trong khi mỗi buổi COMPLETED được cộng 20 XP tuần ({@code StudentDashboardService.computeWeeklyXp}).
 * Giờ:
 * <ul>
 *   <li>Chỉ đánh dấu xong khi đã có lần nộp (bảng {@code learning_session_attempts}, server chấm) đạt
 *       {@link #PASS_THRESHOLD_PERCENT}; chưa có thì giữ nguyên trạng thái, trả {@code completed=false}.</li>
 *   <li>{@code abilityScore} client gửi bị bỏ qua: lưu điểm tốt nhất server chấm.</li>
 *   <li>{@code timeSeconds} chặn trong [0, thời lượng buổi × {@link #TIME_CAP_MULTIPLIER}].</li>
 *   <li>Idempotent: buổi đã COMPLETED thì không ghi gì (không dời {@code completed_at} sang tuần mới
 *       — dời là cộng thêm 20 XP tuần lần nữa).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LearningSessionProgressService {

    /** Ngưỡng "đạt" — trùng cờ {@code passed} của {@code SessionSubmitResponse} (score ≥ 60). */
    public static final int PASS_THRESHOLD_PERCENT = 60;
    /** {@code timeSeconds} tối đa = thời lượng buổi × hệ số này. */
    public static final int TIME_CAP_MULTIPLIER = 3;
    /** Thời lượng buổi mặc định khi không đọc được kế hoạch (giống fallback {@code minutes} của plan JSON). */
    static final int DEFAULT_SESSION_MINUTES = 25;

    private final LearningSessionProgressRepository progressRepository;
    private final StoredLearningPlanSupport storedLearningPlanSupport;
    private final LearningSessionAttemptRepository attemptRepository;
    private final LearningPlanRepository planRepository;

    /**
     * Đường client: {@code POST /api/plan/sessions/complete}.
     *
     * @param clientAbilityScore BỎ QUA — chỉ còn trong chữ ký để DTO cũ không lỗi 400
     */
    @Transactional
    public SessionCompleteResponse completeFromClient(User user, int week, int sessionIndex,
                                                      Double clientAbilityScore, Double clientTimeSeconds) {
        validate(week, sessionIndex);
        Optional<LearningSessionProgress> existing =
                progressRepository.findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex);
        if (existing.isPresent() && existing.get().getStatus() == LearningSessionProgress.Status.COMPLETED) {
            LearningSessionProgress p = existing.get();
            return new SessionCompleteResponse(true, p.getStatus().name(),
                    SessionCompleteResponse.REASON_ALREADY_COMPLETED,
                    p.getAbilityScore() == null ? null : (int) Math.round(p.getAbilityScore()),
                    p.getTimeSeconds());
        }

        Integer best = attemptRepository.maxScorePercent(user.getId(), week, sessionIndex);
        if (best == null || best < PASS_THRESHOLD_PERCENT) {
            log.info("[Plan] complete rejected (no passing submit) user={} w={} s={} best={}",
                    user.getId(), week, sessionIndex, best);
            String status = existing.map(p -> p.getStatus().name())
                    .orElse(LearningSessionProgress.Status.NOT_STARTED.name());
            return new SessionCompleteResponse(false, status,
                    SessionCompleteResponse.REASON_NO_PASSING_SUBMIT, best, null);
        }

        Double time = clampTimeSeconds(clientTimeSeconds, sessionMinutes(user));
        LearningSessionProgress p = existing.orElseGet(() -> newProgress(user, week, sessionIndex));
        p.setStatus(LearningSessionProgress.Status.COMPLETED);
        p.setAbilityScore(best.doubleValue());
        p.setTimeSeconds(time);
        p.setCompletedAt(LocalDateTime.now());
        progressRepository.save(p);
        return new SessionCompleteResponse(true, p.getStatus().name(),
                SessionCompleteResponse.REASON_COMPLETED, best, time);
    }

    /**
     * Đường server: lần nộp MAIN/REINFORCEMENT đạt 100% ({@code LearningSessionWorkflowService}).
     * Idempotent — buổi đã COMPLETED thì giữ nguyên {@code completed_at}.
     */
    @Transactional
    public void markCompletedByServer(User user, int week, int sessionIndex, int serverScorePercent) {
        validate(week, sessionIndex);
        LearningSessionProgress p = progressRepository
                .findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .orElseGet(() -> newProgress(user, week, sessionIndex));
        if (p.getStatus() == LearningSessionProgress.Status.COMPLETED) {
            return;
        }
        p.setStatus(LearningSessionProgress.Status.COMPLETED);
        p.setAbilityScore((double) Math.max(0, Math.min(100, serverScorePercent)));
        p.setCompletedAt(LocalDateTime.now());
        progressRepository.save(p);
    }

    /** {@code null} giữ {@code null}; âm → 0; quá {@code minutes × 60 × 3} → trần. */
    static Double clampTimeSeconds(Double raw, int sessionMinutes) {
        if (raw == null || raw.isNaN()) {
            return null;
        }
        double cap = Math.max(1, sessionMinutes) * 60.0 * TIME_CAP_MULTIPLIER;
        return Math.max(0.0, Math.min(cap, raw));
    }

    private int sessionMinutes(User user) {
        return planRepository.findByUserId(user.getId())
                .map(plan -> plan.getMinutesPerSession() > 0 ? plan.getMinutesPerSession() : DEFAULT_SESSION_MINUTES)
                .orElse(DEFAULT_SESSION_MINUTES);
    }

    private static void validate(int week, int sessionIndex) {
        if (week < 1 || sessionIndex < 1) {
            throw new BadRequestException("Invalid week/sessionIndex");
        }
    }

    private static LearningSessionProgress newProgress(User user, int week, int sessionIndex) {
        return LearningSessionProgress.builder()
                .user(user)
                .weekNumber(week)
                .sessionIndex(sessionIndex)
                .build();
    }

    public void attachProgressSummary(Long userId, Map<String, Object> planObj) {
        var completed = progressRepository.findCompletedByUserId(userId);
        int completedCount = completed.size();

        int currentWeek = 1;
        int currentSessionIndex = 1;
        if (!completed.isEmpty()) {
            var latest = completed.get(0);
            int sessionsPerWeek = storedLearningPlanSupport.extractSessionsPerWeek(planObj);
            int nextIndex = latest.getSessionIndex() + 1;
            int nextWeek = latest.getWeekNumber();
            if (sessionsPerWeek > 0 && nextIndex > sessionsPerWeek) {
                nextWeek = nextWeek + 1;
                nextIndex = 1;
            }
            currentWeek = nextWeek;
            currentSessionIndex = nextIndex;
        }

        planObj.put("progress", new LinkedHashMap<>(Map.of(
                "completedSessions", completedCount,
                "currentWeek", currentWeek,
                "currentSessionIndex", currentSessionIndex
        )));
    }
}

