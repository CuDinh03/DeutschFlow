package com.deutschflow.gamification.service;

import com.deutschflow.gamification.dto.XpSummaryDto;
import com.deutschflow.gamification.dto.AchievementDto;
import com.deutschflow.gamification.dto.LeaderboardDto;
import com.deutschflow.gamification.entity.Achievement;
import com.deutschflow.gamification.entity.UserAchievement;
import com.deutschflow.gamification.entity.UserXpEvent;
import com.deutschflow.gamification.entity.UserXpEvent.XpEventType;
import com.deutschflow.gamification.repository.AchievementRepository;
import com.deutschflow.gamification.repository.UserAchievementRepository;
import com.deutschflow.gamification.repository.UserXpEventRepository;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.entity.LearningSessionProgress;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Central XP & Gamification service.
 *
 * <h3>XP Awards (per action)</h3>
 * <pre>
 *   SPEAKING_TURN      : +5
 *   SESSION_COMPLETE   : +30
 *   STREAK_BONUS       : +10/day milestone
 *   VOCAB_REVIEW       : +3
 *   ERROR_FIXED        : +15
 *   FIRST_SESSION      : +100 (one-time)
 *   DAILY_GOAL         : +50
 *   ACHIEVEMENT_REWARD : varies per achievement
 * </pre>
 *
 * <h3>Level thresholds (triangular × 100)</h3>
 * Level 1=0XP, 2=100, 3=300, 4=600, 5=1000, 6=1500 …
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class XpService {

    public static final int XP_SPEAKING_TURN     = 5;
    public static final int XP_SESSION_COMPLETE  = 30;
    public static final int XP_STREAK_BONUS      = 10;
    public static final int XP_VOCAB_REVIEW      = 3;
    public static final int XP_ERROR_FIXED       = 15;
    public static final int XP_FIRST_SESSION     = 100;
    public static final int XP_DAILY_GOAL        = 50;
    public static final int XP_SATELLITE         = 50;
    public static final int XP_SRS_REVIEW        = 2;

    private final UserXpEventRepository xpEventRepository;
    private final AchievementRepository achievementRepository;
    private final UserAchievementRepository userAchievementRepository;
    private final LearningSessionProgressRepository sessionProgressRepository;
    private final UserNotificationService userNotificationService;

    // ─────────────────────────────────────────────────────────────────
    // Public award methods
    // ─────────────────────────────────────────────────────────────────

    @Transactional
    public void awardSpeakingTurn(Long userId, Long sessionId, Long messageId) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_SPEAKING_TURN, XpEventType.SPEAKING_TURN, sessionId, messageId, null);
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    @Transactional
    public void awardSessionComplete(Long userId, Long sessionId) {
        int oldLevel = currentLevel(userId);
        boolean isFirst = !xpEventRepository.existsByUserIdAndEventType(userId, XpEventType.FIRST_SESSION);
        if (isFirst) {
            record(userId, XP_FIRST_SESSION, XpEventType.FIRST_SESSION, sessionId, null, "Phiên nói đầu tiên");
        }
        record(userId, XP_SESSION_COMPLETE, XpEventType.SESSION_COMPLETE, sessionId, null, null);
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    @Transactional
    public void awardVocabReview(Long userId) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_VOCAB_REVIEW, XpEventType.VOCAB_REVIEW, null, null, null);
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    @Transactional
    public void awardErrorFixed(Long userId) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_ERROR_FIXED, XpEventType.ERROR_FIXED, null, null, null);
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    @Transactional
    public void awardStreakBonus(Long userId, int streakDays) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_STREAK_BONUS * streakDays, XpEventType.STREAK_BONUS, null, null,
               "Streak: " + streakDays + " ngày");
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    @Transactional
    public void awardDailyGoal(Long userId) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_DAILY_GOAL, XpEventType.DAILY_GOAL, null, null, null);
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    /**
     * Award XP when a SATELLITE_LEAF (industry) node is completed.
     * @param industry e.g. "IT", "ARZT", "GASTRO", "PFLEGE"
     */
    @Transactional
    public void awardSatelliteComplete(Long userId, String industry) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_SATELLITE, XpEventType.SATELLITE_COMPLETE, null, null,
               industry != null ? "INDUSTRY:" + industry.toUpperCase() : "SATELLITE");
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    /**
     * Award XP for an SRS vocab review (called from SrsService).
     * No daily cap enforcement here — kept simple for now.
     */
    @Transactional
    public void awardSrsReview(Long userId) {
        int oldLevel = currentLevel(userId);
        record(userId, XP_SRS_REVIEW, XpEventType.SRS_REVIEW, null, null, null);
        checkLevelUp(userId, oldLevel);
        checkAchievements(userId);
    }

    // ─────────────────────────────────────────────────────────────────
    // Query
    // ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public XpSummaryDto getSummary(Long userId) {
        long totalXp = xpEventRepository.sumXpByUserId(userId);
        int level = computeLevel((int) totalXp);
        int nextLevelXp = levelThreshold(level + 1);
        int currentLevelXp = levelThreshold(level);
        int progressInLevel = (int) (totalXp - currentLevelXp);
        int xpNeededForNext = nextLevelXp - currentLevelXp;

        List<AchievementDto> allAchievements = achievementRepository.findAll()
                .stream()
                .map(a -> toDto(a, userAchievementRepository.existsByUserIdAndAchievementId(userId, a.getId())))
                .toList();

        List<AchievementDto> pendingBadges = userAchievementRepository.findByUserIdAndNotifiedFalse(userId)
                .stream()
                .map(ua -> toDto(ua.getAchievement(), true))
                .toList();

        return new XpSummaryDto(
                userId, (int) totalXp, level, progressInLevel, xpNeededForNext,
                allAchievements, pendingBadges
        );
    }

    @Transactional
    public void markBadgesNotified(Long userId) {
        userAchievementRepository.findByUserIdAndNotifiedFalse(userId)
                .forEach(ua -> {
                    ua.setNotified(true);
                    userAchievementRepository.save(ua);
                });
    }

    /**
     * Returns top-N users ranked by total XP.
     * Used by the Leaderboard page — only exposes displayName (no email).
     */
    @Transactional(readOnly = true)
    public List<LeaderboardDto> getLeaderboard(int limit) {
        List<Object[]> rows = xpEventRepository.findTopUsersByXp(PageRequest.of(0, limit));
        List<LeaderboardDto> result = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            Object[] row = rows.get(i);
            Long userId = ((Number) row[0]).longValue();
            String displayName = (String) row[1];
            long totalXp = ((Number) row[2]).longValue();
            int level = computeLevel((int) Math.min(totalXp, Integer.MAX_VALUE));
            result.add(new LeaderboardDto(i + 1, userId, displayName, totalXp, level));
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────

    private int currentLevel(Long userId) {
        long totalXp = xpEventRepository.sumXpByUserId(userId);
        return computeLevel((int) Math.min(totalXp, Integer.MAX_VALUE));
    }

    private void checkLevelUp(Long userId, int oldLevel) {
        try {
            long totalXp = xpEventRepository.sumXpByUserId(userId);
            int newLevel = computeLevel((int) Math.min(totalXp, Integer.MAX_VALUE));
            if (newLevel > oldLevel) {
                log.info("[XP] User {} leveled up: Lv.{} → Lv.{} ({}XP)", userId, oldLevel, newLevel, totalXp);
                userNotificationService.onLevelUp(userId, oldLevel, newLevel, totalXp);
            }
        } catch (Exception e) {
            log.warn("[XP] Level-up check failed for user {}: {}", userId, e.getMessage());
        }
    }

    private void record(Long userId, int xp, XpEventType type, Long sessionId, Long messageId, String note) {
        try {
            xpEventRepository.save(UserXpEvent.builder()
                    .userId(userId)
                    .xpAmount(xp)
                    .eventType(type)
                    .refSessionId(sessionId)
                    .refMessageId(messageId)
                    .note(note)
                    .build());
        } catch (Exception e) {
            log.warn("[XP] Failed to record XP event ({}) for user {}: {}", type, userId, e.getMessage());
        }
    }

    private void checkAchievements(Long userId) {
        try {
            long totalXp = xpEventRepository.sumXpByUserId(userId);
            long sessionCount = xpEventRepository.countSessionCompleteByUserId(userId);
            long errorsFixed = xpEventRepository.countErrorsFixedByUserId(userId);
            int streakDays = computeStreakDays(userId);

            for (Achievement a : achievementRepository.findAll()) {
                if (userAchievementRepository.existsByUserIdAndAchievementId(userId, a.getId())) {
                    continue;
                }

                long currentValue = switch (a.getTriggerType()) {
                    case "TOTAL_XP"          -> totalXp;
                    case "SESSION_COUNT",
                         "SESSIONS_SPEAKING" -> sessionCount;
                    case "STREAK_DAYS"       -> streakDays;
                    case "ERRORS_FIXED"      -> errorsFixed;
                    case "SATELLITE_COMPLETE"       -> xpEventRepository.countSatelliteCompleteByUserId(userId);
                    case "SATELLITE_IT_COMPLETE"    -> xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:IT%");
                    case "SATELLITE_ARZT_COMPLETE"  -> xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:ARZT%");
                    case "SATELLITE_GASTRO_COMPLETE"-> xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:GASTRO%");
                    case "SATELLITE_PFLEGE_COMPLETE"-> xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:PFLEGE%");
                    case "SATELLITE_ALL_INDUSTRIES" -> {
                        // Count distinct industries that have at least 1 completion
                        long it    = xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:IT%");
                        long arzt  = xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:ARZT%");
                        long gastro= xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:GASTRO%");
                        long pflege= xpEventRepository.countSatelliteByIndustry(userId, "INDUSTRY:PFLEGE%");
                        yield (it > 0 ? 1 : 0) + (arzt > 0 ? 1 : 0) + (gastro > 0 ? 1 : 0) + (pflege > 0 ? 1 : 0);
                    }
                    case "SRS_REVIEW_COUNT"  -> xpEventRepository.countSrsReviewsByUserId(userId);
                    default -> 0L;
                };

                if (currentValue >= a.getTriggerThreshold()) {
                    userAchievementRepository.save(UserAchievement.builder()
                            .userId(userId)
                            .achievement(a)
                            .notified(false)
                            .build());
                    record(userId, a.getXpReward(), XpEventType.ACHIEVEMENT_REWARD,
                           null, null, "Achievement: " + a.getCode());
                    log.info("[XP] User {} unlocked achievement '{}' (+{}XP)", userId, a.getCode(), a.getXpReward());

                    // Send in-app notification
                    try {
                        userNotificationService.onAchievementUnlocked(
                                userId, a.getCode(), a.getNameVi(),
                                a.getIconEmoji(), a.getXpReward());
                    } catch (Exception ex) {
                        log.warn("[XP] Failed to send achievement notification for user {}: {}", userId, ex.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[XP] Achievement check failed for user {}: {}", userId, e.getMessage());
        }
    }

    private int computeStreakDays(Long userId) {
        try {
            List<LearningSessionProgress> completed = sessionProgressRepository
                    .findCompletedWithTimestampByUserId(userId);
            Set<LocalDate> days = new HashSet<>();
            for (LearningSessionProgress p : completed) {
                if (p.getCompletedAt() != null) {
                    days.add(p.getCompletedAt().toLocalDate());
                }
            }
            LocalDate today = LocalDate.now();
            if (days.isEmpty()) return 0;
            boolean todayOk = days.contains(today);
            boolean yesterdayOk = days.contains(today.minusDays(1));
            if (!todayOk && !yesterdayOk) return 0;
            LocalDate anchor = todayOk ? today : today.minusDays(1);
            int streak = 0;
            while (days.contains(anchor)) {
                streak++;
                anchor = anchor.minusDays(1);
            }
            return streak;
        } catch (Exception e) {
            log.debug("[XP] Could not compute streak for user {}: {}", userId, e.getMessage());
            return 0;
        }
    }

    /** Level from total XP using triangular number formula. */
    public static int computeLevel(int totalXp) {
        int level = 1;
        while (totalXp >= levelThreshold(level + 1)) {
            level++;
            if (level >= 100) break;
        }
        return level;
    }

    /** XP required to start this level. threshold(1)=0, threshold(2)=100, threshold(3)=300 … */
    public static int levelThreshold(int level) {
        if (level <= 1) return 0;
        return 100 * (level - 1) * level / 2;
    }

    private static AchievementDto toDto(Achievement a, boolean unlocked) {
        return new AchievementDto(
                a.getId(), a.getCode(), a.getNameVi(), a.getDescriptionVi(),
                a.getIconEmoji(), a.getXpReward(), a.getRarity(), unlocked
        );
    }
}
