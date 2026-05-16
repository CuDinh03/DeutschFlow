package com.deutschflow.srs.service;

import com.deutschflow.srs.dto.ReviewRequest;
import com.deutschflow.srs.dto.ScheduleVocabRequest;
import com.deutschflow.srs.dto.VocabReviewCard;
import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.entity.VocabReviewSchedule.AlgorithmVersion;
import com.deutschflow.srs.repository.VocabReviewRepository;
import com.deutschflow.gamification.service.XpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * SRS Service — dual-algorithm router (SM-2 legacy + FSRS-4.5).
 *
 * <h3>Migrate-on-Read strategy:</h3>
 * <ul>
 *   <li>Cards with {@code algorithmVersion = SM2} use the classic SM-2 formulas.</li>
 *   <li>When an SM-2 card is reviewed, it is transparently <em>upgraded</em> to FSRS-4.5
 *       and {@code algorithmVersion} is set to {@code FSRS}. SM-2 parameter fields
 *       (easeFactor, intervalDays, repetitions) are preserved for audit/rollback.</li>
 *   <li>New cards scheduled after V138 start as {@code FSRS} directly.</li>
 * </ul>
 *
 * <h3>Rating compatibility:</h3>
 * The REST API still accepts SM-2 quality (0-5) in {@link ReviewRequest}.
 * {@link FsrsService#mapSm2ToFsrs(int)} converts it to FSRS rating (1-4) for FSRS cards.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrsService {

    private static final BigDecimal MIN_EASE = new BigDecimal("1.30");
    private static final BigDecimal MAX_EASE = new BigDecimal("5.00");

    private final VocabReviewRepository repo;
    private final FsrsService fsrsService;
    private final XpService xpService;

    // ─── Schedule ─────────────────────────────────────────────────────────────

    /**
     * Adds a vocab to the user's SRS schedule if not already present.
     * New cards start with FSRS algorithm directly (post-V138).
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
                            .algorithmVersion(AlgorithmVersion.FSRS.name())
                            .build();
                    repo.save(entry);
                    log.debug("[SRS] Scheduled vocab '{}' (FSRS) for user {}", req.german(), userId);
                }
        );
    }

    /** Convenience batch: schedule multiple vocab items for the same node. */
    @Transactional
    public void scheduleVocabBatch(Long userId, List<ScheduleVocabRequest> items) {
        items.forEach(item -> scheduleVocab(userId, item));
    }

    // ─── Due cards ────────────────────────────────────────────────────────────

    /** Returns up to 10 cards due for review today (both SM-2 and FSRS cards). */
    @Transactional(readOnly = true)
    public List<VocabReviewCard> getDueCards(Long userId) {
        return repo.findDueCards(userId, OffsetDateTime.now())
                .stream()
                .map(this::toCard)
                .toList();
    }

    /** Count of due cards (for badge in nav — both algorithms). */
    @Transactional(readOnly = true)
    public long countDue(Long userId) {
        return repo.countDue(userId, OffsetDateTime.now());
    }

    // ─── Record review ────────────────────────────────────────────────────────

    /**
     * Records a review result and updates the SRS schedule.
     *
     * <p>Routing logic:
     * <ul>
     *   <li>Card is FSRS → apply FSRS-4.5 update</li>
     *   <li>Card is SM2 → transparently upgrade to FSRS (migrate-on-read)</li>
     * </ul>
     *
     * @param userId the authenticated user
     * @param req    vocabId + quality (0-5, SM-2 scale kept for backward compat)
     * @return updated review card
     */
    @Transactional
    public VocabReviewCard recordReview(Long userId, ReviewRequest req) {
        var entry = repo.findByUserIdAndVocabId(userId, req.vocabId())
                .orElseThrow(() -> new IllegalArgumentException("Vocab not found in SRS schedule"));

        int quality = Math.max(0, Math.min(5, req.quality()));
        entry.setLastReviewAt(OffsetDateTime.now());
        entry.setLastQuality((short) quality);

        if (AlgorithmVersion.FSRS.name().equals(entry.getAlgorithmVersion())) {
            applyFsrs(entry, quality);
        } else {
            upgradeSm2ToFsrs(entry, quality);
        }

        repo.save(entry);
        log.debug("[SRS] Reviewed '{}' algo={} q={} next={}",
                entry.getGerman(), entry.getAlgorithmVersion(), quality, entry.getNextReviewAt());

        try { xpService.awardSrsReview(userId); } catch (Exception ignored) {}

        return toCard(entry);
    }

    // ─── FSRS routing helpers ─────────────────────────────────────────────────

    private void applyFsrs(VocabReviewSchedule card, int sm2Quality) {
        int fsrsRating = fsrsService.mapSm2ToFsrs(sm2Quality);
        if (card.getStability() == null) {
            // First review of a newly-scheduled FSRS card (stability not yet computed)
            fsrsService.initializeCard(card, fsrsRating);
        } else {
            long elapsed = card.getLastReviewAt() != null
                    ? Duration.between(card.getLastReviewAt(), OffsetDateTime.now()).toDays()
                    : 0L;
            fsrsService.scheduleReview(card, fsrsRating, elapsed);
        }
    }

    /**
     * Transparently upgrades an SM-2 card to FSRS on its first review after V138.
     * Seeds FSRS stability from the existing SM-2 interval to preserve scheduling
     * continuity (avoids resetting mature cards back to a 1-day interval).
     */
    private void upgradeSm2ToFsrs(VocabReviewSchedule card, int sm2Quality) {
        int fsrsRating = fsrsService.mapSm2ToFsrs(sm2Quality);

        if (card.getRepetitions() == 0) {
            // Never reviewed — clean FSRS init
            fsrsService.initializeCard(card, fsrsRating);
        } else {
            // Has SM-2 history: seed FSRS from interval_days
            card.setStability(BigDecimal.valueOf(Math.max(card.getIntervalDays(), 1))
                    .setScale(4, RoundingMode.HALF_UP));
            card.setDifficulty(BigDecimal.valueOf(5.0).setScale(2, RoundingMode.HALF_UP));
            card.setRetrievability(BigDecimal.valueOf(0.9).setScale(4, RoundingMode.HALF_UP));
            card.setAlgorithmVersion(AlgorithmVersion.FSRS.name());

            long elapsed = card.getLastReviewAt() != null
                    ? Duration.between(card.getLastReviewAt(), OffsetDateTime.now()).toDays()
                    : (long) card.getIntervalDays();
            fsrsService.scheduleReview(card, fsrsRating, elapsed);
        }

        log.info("[SRS] Upgraded card '{}' SM2→FSRS for user {}", card.getGerman(), card.getUserId());
    }

    // ─── SM-2 core (preserved for audit / rollback reference) ────────────────

    /** SM-2 algorithm — no longer called in recordReview; kept for rollback reference. */
    @SuppressWarnings("unused")
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
        double q = quality;
        double ef = entry.getEaseFactor().doubleValue();
        double newEf = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        BigDecimal clampedEf = BigDecimal.valueOf(newEf)
                .max(MIN_EASE).min(MAX_EASE).setScale(2, RoundingMode.HALF_UP);
        entry.setEaseFactor(clampedEf);
        entry.setNextReviewAt(OffsetDateTime.now().plusDays(entry.getIntervalDays()));
    }

    // ─── Stats ────────────────────────────────────────────────────────────────

    public Map<String, Object> getStats(Long userId) {
        long due   = repo.countDue(userId, OffsetDateTime.now());
        long total = repo.countByUserId(userId);
        return Map.of("dueCount", due, "totalCards", total);
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────

    private VocabReviewCard toCard(VocabReviewSchedule e) {
        return new VocabReviewCard(
                e.getId(), e.getVocabId(), e.getGerman(), e.getMeaning(),
                e.getExampleDe(), e.getSpeakDe(), e.getRepetitions(), e.getNextReviewAt()
        );
    }
}
