package com.deutschflow.vocabulary.service;

import com.deutschflow.vocabulary.dto.LearningProgressDto;
import com.deutschflow.vocabulary.entity.SpacedRepetitionSchedule;
import com.deutschflow.vocabulary.entity.Word;
import com.deutschflow.vocabulary.repository.SpacedRepetitionRepository;
import com.deutschflow.vocabulary.repository.WordRepository;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spaced Repetition Service using SM-2 Algorithm
 * Tracks vocabulary learning schedule for optimal retention
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SpacedRepetitionService {

    private final SpacedRepetitionRepository srsRepository;
    private final WordRepository wordRepository;

    /**
     * Schedule a new word for learning (SM-2 initial state)
     */
    @Transactional
    public SpacedRepetitionSchedule scheduleWord(User user, Long wordId) {
        if (srsRepository.existsByUserIdAndWordId(user.getId(), wordId)) {
            return srsRepository.findByUserIdAndWordId(user.getId(), wordId).orElse(null);
        }

        Word word = wordRepository.findById(wordId)
                .orElseThrow(() -> new RuntimeException("Word not found: " + wordId));

        SpacedRepetitionSchedule schedule = SpacedRepetitionSchedule.builder()
                .userId(user.getId())
                .wordId(wordId)
                .nextReviewDate(LocalDateTime.now())
                .reviewCount(0)
                .easinessFactor(2.5)
                .interval(1)
                .retentionStatus("LEARNING")
                .build();

        return srsRepository.save(schedule);
    }

    /**
     * Get words due for review today (for given user)
     */
    public List<SpacedRepetitionSchedule> getReviewDue(User user, int limit) {
        return srsRepository.findDueForReview(user.getId(), LocalDateTime.now(), limit);
    }

    /**
     * Record user's response and update SRS schedule using SM-2 algorithm
     * confidence: 1-5 (1=forgot, 5=perfect recall)
     */
    @Transactional
    public SpacedRepetitionSchedule recordReview(User user, Long wordId, int confidence) {
        return recordReview(user.getId(), wordId, confidence);
    }

    /**
     * Record review for user ID (overloaded)
     */
    @Transactional
    public SpacedRepetitionSchedule recordReview(Long userId, Long wordId, int confidence) {
        SpacedRepetitionSchedule schedule = srsRepository.findByUserIdAndWordId(userId, wordId)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        // SM-2 Algorithm
        int oldReviewCount = schedule.getReviewCount();
        double oldEasiness = schedule.getEasinessFactor();

        double newEasiness = Math.max(1.3, oldEasiness + (0.1 - (5.0 - confidence) * (0.08 + (5.0 - confidence) * 0.02)));
        int newInterval;

        if (confidence < 3) {
            // User forgot: reset
            newInterval = 1;
            schedule.setRetentionStatus("LEARNING");
        } else {
            // User remembered
            if (oldReviewCount == 0) {
                newInterval = 1;
            } else if (oldReviewCount == 1) {
                newInterval = 3;
            } else {
                newInterval = (int) Math.round(schedule.getInterval() * newEasiness);
            }

            // Mark as reviewing or mastered
            if (oldReviewCount >= 3 && confidence >= 4) {
                schedule.setRetentionStatus("MASTERED");
            } else {
                schedule.setRetentionStatus("REVIEWING");
            }
        }

        schedule.setReviewCount(oldReviewCount + 1);
        schedule.setEasinessFactor(newEasiness);
        schedule.setInterval(newInterval);
        schedule.setLastReviewDate(LocalDateTime.now());
        schedule.setNextReviewDate(LocalDateTime.now().plusDays(newInterval));

        return srsRepository.save(schedule);
    }

    /**
     * Get learning progress for user (overloaded)
     */
    public LearningProgressDto getLearningProgress(User user) {
        return getLearningProgress(user.getId());
    }

    /**
     * Get learning progress for user ID
     */
    public LearningProgressDto getLearningProgress(Long userId) {
        long totalWords = srsRepository.countByUserId(userId);
        long masteredWords = srsRepository.countByUserIdAndRetentionStatus(userId, "MASTERED");
        long reviewingWords = srsRepository.countByUserIdAndRetentionStatus(userId, "REVIEWING");
        long learningWords = srsRepository.countByUserIdAndRetentionStatus(userId, "LEARNING");
        long wordsDueForReview = srsRepository.findDueForReview(userId, LocalDateTime.now(), Integer.MAX_VALUE).size();

        return new LearningProgressDto(
                (int) totalWords,
                (int) masteredWords,
                (int) reviewingWords,
                (int) learningWords,
                totalWords > 0 ? (double) masteredWords / totalWords : 0.0,
                wordsDueForReview
        );
    }
}
