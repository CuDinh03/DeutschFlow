package com.deutschflow.srs.service;

import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.repository.VocabReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * SRS Service implementing the SM-2 (SuperMemo 2) spaced repetition algorithm.
 *
 * <p>SM-2 Quality ratings:
 * <ul>
 *   <li>0 = Quên hoàn toàn (Blackout)</li>
 *   <li>2 = Khó — nhớ được nhưng vất vả</li>
 *   <li>4 = OK — nhớ được với chút do dự</li>
 *   <li>5 = Dễ — nhớ ngay lập tức</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrsService {

    private static final BigDecimal MIN_EASE = new BigDecimal("1.30");
    private static final BigDecimal MAX_EASE = new BigDecimal("5.00");

    private final VocabReviewRepository repo;

    // ─── Schedule (add vocab after node completion) ───────────────────────────

    /**
     * Adds a vocab to the user's SRS schedule if not already present.
     * Idempotent — safe to call multiple times.
     */
    @Transactional
    public void scheduleVocab(Long userId, ScheduleVocabRequest req) {
        repo.findByUserIdAndVocabId(userId, req.vocabId()).ifPresentOrElse(
                existing -> log.debug("[SRS] vocab {} already scheduled for user {}", req.vocabId(), userId),
                () -> {
                    var entry = VocabReviewSchedule.builder()
                            .userId(userId)
                            .nodeId(req.nodeId())
                            .vocabId(req.vocabId())
                            .german(req.german())
                            .meaning(req.meaning())
                            .exampleDe(req.exampleDe())
                            .speakDe(req.speakDe())
                            .build();
                    repo.save(entry);
                    log.debug("[SRS] Scheduled vocab '{}' for user {}", req.german(), userId);
                }
        );
    }

    /**
     * Convenience batch: schedule multiple vocab items for the same node.
     */
    @Transactional
    public void scheduleVocabBatch(Long userId, List<ScheduleVocabRequest> items) {
        items.forEach(item -> scheduleVocab(userId, item));
    }

    // ─── Due cards ────────────────────────────────────────────────────────────

    /** Returns up to 10 cards due for review today. */
    @Transactional(readOnly = true)
    public List<VocabReviewCard> getDueCards(Long userId) {
        return repo.findDueCards(userId, OffsetDateTime.now())
                .stream()
                .map(this::toCard)
                .toList();
    }

    /** Count of due cards (for badge in nav). */
    @Transactional(readOnly = true)
    public long countDue(Long userId) {
        return repo.countDue(userId, OffsetDateTime.now());
    }

    // ─── Record review result (SM-2 update) ───────────────────────────────────

    /**
     * Records a review result and updates the SM-2 schedule.
     *
     * @param userId  the authenticated user
     * @param req     vocabId + quality (0-5)
     * @return updated schedule entry
     */
    @Transactional
    public VocabReviewCard recordReview(Long userId, ReviewRequest req) {
        var entry = repo.findByUserIdAndVocabId(userId, req.vocabId())
                .orElseThrow(() -> new IllegalArgumentException("Vocab not found in SRS schedule"));

        int quality = Math.max(0, Math.min(5, req.quality()));
        applySmTwo(entry, quality);
        entry.setLastReviewAt(OffsetDateTime.now());
        entry.setLastQuality((short) quality);

        repo.save(entry);
        log.debug("[SRS] Reviewed '{}' q={} → interval={}d EF={}", entry.getGerman(), quality,
                entry.getIntervalDays(), entry.getEaseFactor());

        return toCard(entry);
    }

    // ─── SM-2 core algorithm ──────────────────────────────────────────────────

    /**
     * SuperMemo 2 algorithm:
     * - quality >= 3: "pass"  → increment repetitions, increase interval
     * - quality <  3: "fail"  → reset repetitions, reset interval to 1
     * EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
     */
    private void applySmTwo(VocabReviewSchedule entry, int quality) {
        if (quality >= 3) {
            int rep = entry.getRepetitions();
            int newInterval = switch (rep) {
                case 0 -> 1;
                case 1 -> 6;
                default -> (int) Math.round(entry.getIntervalDays() * entry.getEaseFactor().doubleValue());
            };
            entry.setIntervalDays(newInterval);
            entry.setRepetitions(rep + 1);
        } else {
            entry.setRepetitions(0);
            entry.setIntervalDays(1);
        }

        // Update ease factor
        double q = quality;
        double ef = entry.getEaseFactor().doubleValue();
        double newEf = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        BigDecimal clampedEf = BigDecimal.valueOf(newEf)
                .max(MIN_EASE)
                .min(MAX_EASE)
                .setScale(2, RoundingMode.HALF_UP);
        entry.setEaseFactor(clampedEf);

        // Schedule next review
        entry.setNextReviewAt(OffsetDateTime.now().plusDays(entry.getIntervalDays()));
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────

    private VocabReviewCard toCard(VocabReviewSchedule e) {
        return new VocabReviewCard(
                e.getId(), e.getVocabId(), e.getGerman(), e.getMeaning(),
                e.getExampleDe(), e.getSpeakDe(), e.getRepetitions(), e.getNextReviewAt()
        );
    }

    /** Stats summary for dashboard */
    public Map<String, Object> getStats(Long userId) {
        long due = repo.countDue(userId, OffsetDateTime.now());
        long total = repo.countByUserId(userId);
        return Map.of("dueCount", due, "totalCards", total);
    }
}
