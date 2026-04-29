package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LearningSessionProgressService {
    private final LearningSessionProgressRepository progressRepository;
    private final StoredLearningPlanSupport storedLearningPlanSupport;

    public void markSessionCompleted(User user, int week, int sessionIndex, Double abilityScore, Double timeSeconds) {
        if (week < 1 || sessionIndex < 1) {
            throw new BadRequestException("Invalid week/sessionIndex");
        }
        var p = progressRepository.findByUserIdAndWeekNumberAndSessionIndex(user.getId(), week, sessionIndex)
                .orElse(com.deutschflow.user.entity.LearningSessionProgress.builder()
                        .user(user)
                        .weekNumber(week)
                        .sessionIndex(sessionIndex)
                        .build());
        p.setStatus(com.deutschflow.user.entity.LearningSessionProgress.Status.COMPLETED);
        p.setAbilityScore(abilityScore);
        p.setTimeSeconds(timeSeconds);
        p.setCompletedAt(java.time.LocalDateTime.now());
        progressRepository.save(p);
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

