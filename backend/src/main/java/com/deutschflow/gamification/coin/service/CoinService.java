package com.deutschflow.gamification.coin.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.InsufficientCoinsException;
import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.gamification.coin.dto.CoinBalanceDto;
import com.deutschflow.gamification.coin.dto.CoinEventDto;
import com.deutschflow.gamification.coin.entity.UserCoinEvent;
import com.deutschflow.gamification.coin.entity.UserCoinEvent.CoinEventType;
import com.deutschflow.gamification.coin.entity.UserMockTrialPass;
import com.deutschflow.gamification.coin.repository.UserCoinEventRepository;
import com.deutschflow.gamification.coin.repository.UserMockTrialPassRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Student virtual currency ("coin"). Bonus-only economy:
 *
 * <ul>
 *   <li><b>Earn</b>: {@code COINS_PER_NODE} per learning-node completion, first completion only
 *       (enforced by {@code uq_coin_earn_once_per_node} + a per-user advisory lock — not farmable).</li>
 *   <li><b>Spend — mock exam</b>: buy a single-attempt trial pass on a PRO pack (relocks after one
 *       attempt; PRO subscription stays the only unlimited path).</li>
 *   <li><b>Spend — AI speaking</b>: buy a one-day token top-up so an exhausted FREE user can do one
 *       extra session. Never elevates the tier; the grant lapses at day end.</li>
 * </ul>
 *
 * Mirrors {@code XpService} (advisory lock keyspace + append-only ledger) and {@code QuotaService}
 * (JdbcTemplate wallet upsert/debit). The coin advisory-lock class is <b>2</b>, distinct from XP's
 * class 1 and subscription's single-arg lock, so coin mutations never contend with those.
 *
 * <p>All mutations run {@code REQUIRES_NEW} so a coin failure can never poison or roll back the
 * caller's transaction (e.g. a node completion), and concurrent same-user awards serialize on the
 * advisory lock instead of racing the unique index.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CoinService {

    public static final int COINS_PER_NODE = 1;
    public static final int PRICE_MOCK_TRIAL_PASS = 5;
    public static final int PRICE_BONUS_SPEAKING = 3;
    /** One-day AI-speaking token top-up granted per bonus-session purchase (~one session's worth). */
    public static final long BONUS_SPEAKING_TOKENS = 8_000L;

    /** Coin advisory-lock keyspace (class). DISTINCT from XpService (1) and subscription (single-arg). */
    private static final int COIN_LOCK_CLASS = 2;

    private final UserCoinEventRepository coinEventRepository;
    private final UserMockTrialPassRepository trialPassRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.coins.enabled:false}")
    private boolean enabled;

    // ─────────────────────────────────────────────────────────────────
    // Earn
    // ─────────────────────────────────────────────────────────────────

    /**
     * Award {@code COINS_PER_NODE} the first time a node is completed. No-op when coins are disabled
     * or the node already earned. Best-effort and self-contained ({@code REQUIRES_NEW}) — callers
     * wrap this so a coin issue never affects the learning-completion transaction.
     *
     * @param nodeKind {@code TREE} (RoadmapTreeService) or {@code SKILL_TREE} (legacy)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void awardNodeComplete(Long userId, String nodeId, String nodeKind) {
        if (!enabled || userId == null || nodeId == null) {
            return;
        }
        lockUserCoins(userId);
        if (coinEventRepository.existsByUserIdAndRefNodeKindAndRefNodeIdAndEventType(
                userId, nodeKind, nodeId, CoinEventType.NODE_COMPLETE)) {
            return; // already earned for this node — anti-farm
        }
        coinEventRepository.save(UserCoinEvent.builder()
                .userId(userId)
                .amount(COINS_PER_NODE)
                .eventType(CoinEventType.NODE_COMPLETE)
                .refNodeId(nodeId)
                .refNodeKind(nodeKind)
                .build());
        creditWallet(userId, COINS_PER_NODE);
    }

    // ─────────────────────────────────────────────────────────────────
    // Query
    // ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CoinBalanceDto getBalance(Long userId) {
        return new CoinBalanceDto(loadBalance(userId));
    }

    @Transactional(readOnly = true)
    public List<CoinEventDto> history(Long userId, Pageable pageable) {
        return coinEventRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(CoinEventDto::from)
                .getContent();
    }

    @Transactional(readOnly = true)
    public boolean hasTrialPassFor(Long userId, Long packId) {
        if (!enabled) {
            return false;
        }
        return trialPassRepository.existsByUserIdAndPackIdAndStatus(userId, packId, UserMockTrialPass.PURCHASED);
    }

    /** Pack ids the user currently holds an unused trial pass for (so the catalog can show them unlocked). */
    @Transactional(readOnly = true)
    public Set<Long> activeTrialPackIds(Long userId) {
        if (!enabled) {
            return Set.of();
        }
        return new HashSet<>(trialPassRepository.findPackIdsByUserIdAndStatus(userId, UserMockTrialPass.PURCHASED));
    }

    /** Bonus AI-speaking tokens granted for the current VN day (0 if none). */
    @Transactional(readOnly = true)
    public long bonusSpeakingTokensToday(Long userId) {
        return loadBonusTokens(userId, QuotaVnCalendar.localDateOf(Instant.now()));
    }

    // ─────────────────────────────────────────────────────────────────
    // Spend — purchase (explicit)
    // ─────────────────────────────────────────────────────────────────

    /** Buy a single-attempt trial pass for a mock pack. Idempotent against duplicate active passes. */
    @Transactional
    public void purchaseTrialPass(Long userId, Long packId) {
        requireEnabled();
        lockUserCoins(userId);
        if (trialPassRepository.existsByUserIdAndPackIdAndStatus(userId, packId, UserMockTrialPass.PURCHASED)) {
            throw new ConflictException("Bạn đã có lượt dùng thử cho bộ đề này.");
        }
        debitOrThrow(userId, PRICE_MOCK_TRIAL_PASS);
        recordSpend(userId, PRICE_MOCK_TRIAL_PASS, CoinEventType.SPEND_MOCK_TRIAL, packId, "trial pass");
        trialPassRepository.save(UserMockTrialPass.builder()
                .userId(userId)
                .packId(packId)
                .status(UserMockTrialPass.PURCHASED)
                .build());
    }

    /** Buy a one-day AI-speaking token top-up for today. */
    @Transactional
    public void purchaseBonusSpeakingSession(Long userId) {
        requireEnabled();
        lockUserCoins(userId);
        debitOrThrow(userId, PRICE_BONUS_SPEAKING);
        recordSpend(userId, PRICE_BONUS_SPEAKING, CoinEventType.SPEND_BONUS_SPEAKING, null, "bonus speaking session");
        creditBonusTokens(userId, QuotaVnCalendar.localDateOf(Instant.now()), BONUS_SPEAKING_TOKENS);
    }

    // ─────────────────────────────────────────────────────────────────
    // Spend — consume (at action time)
    // ─────────────────────────────────────────────────────────────────

    /**
     * Consume the active trial pass for a pack, linking it to the started attempt. Returns false
     * when there is no active pass (caller then falls back to the normal paid gate). Idempotent: a
     * pack that has already been consumed has no PURCHASED pass left.
     *
     * <p>Default propagation — JOINS the caller's transaction ({@code MockExamController.startExam})
     * so consuming the pass and inserting the attempt commit/roll back atomically.
     */
    @Transactional
    public boolean consumeTrialPass(Long userId, Long packId, Long attemptId) {
        if (!enabled) {
            return false;
        }
        lockUserCoins(userId);
        UserMockTrialPass pass = trialPassRepository
                .findFirstByUserIdAndPackIdAndStatusOrderByPurchasedAtAsc(userId, packId, UserMockTrialPass.PURCHASED)
                .orElse(null);
        if (pass == null) {
            return false;
        }
        pass.setStatus(UserMockTrialPass.CONSUMED);
        pass.setConsumedAt(LocalDateTime.now());
        pass.setAttemptId(attemptId);
        trialPassRepository.save(pass);
        return true;
    }

    // ─────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────

    private void requireEnabled() {
        if (!enabled) {
            throw new ConflictException("Tính năng xu thưởng chưa được bật.");
        }
    }

    private long loadBalance(Long userId) {
        List<Long> rows = jdbcTemplate.query(
                "SELECT balance FROM user_coin_wallets WHERE user_id = ? LIMIT 1",
                (rs, n) -> rs.getLong(1), userId);
        return rows.isEmpty() ? 0L : rows.get(0);
    }

    private void creditWallet(Long userId, long amount) {
        jdbcTemplate.update("""
                INSERT INTO user_coin_wallets (user_id, balance, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET balance = user_coin_wallets.balance + EXCLUDED.balance,
                              updated_at = CURRENT_TIMESTAMP
                """, userId, amount);
    }

    /** Atomic conditional debit. Throws when the balance is too low (or no wallet row exists). */
    private void debitOrThrow(Long userId, long amount) {
        int rows = jdbcTemplate.update("""
                UPDATE user_coin_wallets SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND balance >= ?
                """, amount, userId, amount);
        if (rows == 0) {
            throw new InsufficientCoinsException("Không đủ xu để thực hiện. Hãy hoàn thành thêm bài học để nhận xu.");
        }
    }

    private long loadBonusTokens(Long userId, LocalDate day) {
        List<Long> rows = jdbcTemplate.query(
                "SELECT bonus_tokens FROM user_bonus_speaking_tokens WHERE user_id = ? AND local_date = ? LIMIT 1",
                (rs, n) -> rs.getLong(1), userId, Date.valueOf(day));
        return rows.isEmpty() ? 0L : rows.get(0);
    }

    private void creditBonusTokens(Long userId, LocalDate day, long tokens) {
        jdbcTemplate.update("""
                INSERT INTO user_bonus_speaking_tokens (user_id, local_date, bonus_tokens, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, local_date)
                DO UPDATE SET bonus_tokens = user_bonus_speaking_tokens.bonus_tokens + EXCLUDED.bonus_tokens,
                              updated_at = CURRENT_TIMESTAMP
                """, userId, Date.valueOf(day), tokens);
    }

    private void recordSpend(Long userId, int price, CoinEventType type, Long packId, String note) {
        coinEventRepository.save(UserCoinEvent.builder()
                .userId(userId)
                .amount(-price)
                .eventType(type)
                .refPackId(packId)
                .note(note)
                .build());
    }

    /**
     * Transaction-scoped advisory lock per user (keyspace class 2). Serializes a user's coin
     * mutations so earn/spend can't interleave and double-credit or double-spend. {@code userId}
     * fits int4 for this id range. Released automatically at transaction end.
     */
    private void lockUserCoins(Long userId) {
        jdbcTemplate.query("SELECT pg_advisory_xact_lock(?, ?)", rs -> null, COIN_LOCK_CLASS, userId.intValue());
    }
}
