package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService;
import com.deutschflow.organization.service.OrgQuotaService.OrgMembership;
import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AiUsageLedgerService {

    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;
    private final OrgQuotaService orgQuotaService;

    /**
     * Token-tương-đương cho mỗi giây audio STT. Whisper bị Groq tính theo giây (không theo
     * token), nên để STT cũng trừ vào org token pool + ví người dùng như các tính năng token
     * khác (audit M-3: trước đây STT KHÔNG trừ gì → org metered chạy Speaking "miễn phí" với
     * pool). Hiệu chỉnh để 1 clip ~10s ≈ {@code STT_ESTIMATED_TOKENS} (200) mà OrgPoolGuard
     * dùng ở bước pre-check gate.
     */
    private static final long STT_TOKENS_PER_SECOND = 20L;

    @Transactional(rollbackFor = Exception.class)
    public void recordStt(Long userId, String feature, String model, double durationSeconds) {
        // M-4 (V269): ghi org_id ngay tại event để STT COGS quy được về từng tenant — STT là driver
        // COGS lặp lớn nhất của AI-Speaking. Org resolve qua org_members ACTIVE (M-5, cùng nguồn gate).
        jdbcTemplate.update("""
                        INSERT INTO stt_usage_events (user_id, feature, model, audio_duration_secs, org_id)
                        VALUES (?, ?, ?, ?,
                                (SELECT om.org_id FROM org_members om
                                  WHERE om.user_id = ? AND om.status = 'ACTIVE'
                                  ORDER BY (om.role = 'STUDENT'), om.org_id LIMIT 1))
                        """,
                userId, feature, model, durationSeconds, userId);

        // B2B-COGS (audit M-3): quy giây audio → token-tương-đương và trừ vào org pool + ví,
        // giống record(). No-op cho user không thuộc org (pool) / plan không có ví.
        if (userId != null && durationSeconds > 0) {
            chargeOrgPoolAndWallet(userId, Math.round(durationSeconds * STT_TOKENS_PER_SECOND));
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void record(long userId,
                       String provider,
                       String model,
                       int promptTokens,
                       int completionTokens,
                       int totalTokens,
                       String feature,
                       String requestId,
                       Long sessionId) {
        // Capture org_id at event time via subquery (D-2) — single round-trip, no separate lookup.
        // M-5: org đọc từ org_members ACTIVE (cùng nguồn với gate tryReserve) thay vì users.org_id —
        // hết cảnh charge và gate nhìn hai nguồn tenant khác nhau rồi drift. ORDER BY khớp
        // resolveActiveMembership (staff-first) để event và chỗ trừ pool luôn quy CÙNG một org.
        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, org_id, provider, model,
                          prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, session_id
                        )
                        SELECT ?,
                               (SELECT om.org_id FROM org_members om
                                 WHERE om.user_id = u.id AND om.status = 'ACTIVE'
                                 ORDER BY (om.role = 'STUDENT'), om.org_id LIMIT 1),
                               ?, ?, ?, ?, ?, ?, ?, ?
                        FROM users u WHERE u.id = ?
                        """,
                userId, provider, model,
                promptTokens, completionTokens, totalTokens,
                feature, requestId, sessionId,
                userId
        );

        chargeOrgPoolAndWallet(userId, totalTokens);
    }

    /**
     * Trừ {@code totalTokens} vào ĐÚNG MỘT kênh theo vai trò org (2 kênh token — 26/07).
     * Dùng chung cho {@link #record} (tính năng token) và {@link #recordStt} (STT).
     *
     * <ul>
     *   <li><b>STUDENT org + B2C (kênh 1)</b>: chỉ {@link QuotaService#applyUsageDebit} ví cá nhân
     *       (tự no-op cho plan không phải ví — FREE/INTERNAL). KHÔNG cộng counter pool trung tâm —
     *       tiền HV tiêu không còn đổ vào pool GV. Suất giữ chỗ còn sót trong holder (role đổi giữa
     *       request — cực hiếm) được ĐỂ NGUYÊN cho {@code OrgReservationRefundFilter} hoàn trả.</li>
     *   <li><b>Staff org (kênh 2)</b>: cộng counter pool; KHÔNG debit ví cá nhân (Q1 — hết cảnh ví
     *       GV bị trừ ngầm rồi {@code downgradePaidPlansToDefault} oan). H-3 reconcile: nếu request
     *       đã GIỮ CHỖ tại gate ({@link OrgReservationHolder}) chỉ ghi phần chênh
     *       {@code delta = actual − reserved} vào đúng org đã giữ (floor 0); không có suất
     *       (unlimited, hoặc charge chạy ở thread khác với gate) → ghi đủ số thật vào org của
     *       membership hiện tại.</li>
     * </ul>
     *
     * <p>Sổ cái event ({@code ai_token_usage_events}/{@code stt_usage_events}) vẫn ghi
     * {@code org_id} cho MỌI thành viên kể cả HV — báo cáo COGS per-org/per-user không đổi;
     * chỉ chỗ TRỪ POOL tách kênh.
     *
     * <p>⚠ Nếu transaction bọc ngoài rollback SAU khi đã {@code take()} suất giữ chỗ, phần counter
     * rollback theo nhưng suất (đã commit REQUIRES_NEW ở gate) không ai hoàn trả — pool lệch tối đa
     * một suất ước lượng, tự hết khi sang kỳ tháng. Đường này chỉ xảy ra khi ghi ledger fail sau khi
     * LLM đã thành công — hiếm và nghiêng về phía an toàn doanh thu (giữ chỗ thừa, không thất thoát).
     */
    private void chargeOrgPoolAndWallet(long userId, long totalTokens) {
        if (totalTokens <= 0) {
            return;
        }
        OrgMembership membership = orgQuotaService.resolveActiveMembership(userId);
        if (membership == null || !membership.staff()) {
            quotaService.applyUsageDebit(userId, totalTokens, Instant.now());
            return;
        }

        OrgReservation reserved = OrgReservationHolder.take();
        if (reserved != null && reserved.orgId() != null) {
            long delta = totalTokens - reserved.reservedTokens();
            if (delta != 0L) {
                jdbcTemplate.update("""
                                INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
                                VALUES (?, date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, GREATEST(?, 0))
                                ON CONFLICT (org_id, month_start)
                                DO UPDATE SET tokens_used = GREATEST(org_monthly_token_counters.tokens_used + ?, 0)
                                """,
                        reserved.orgId(), delta, delta
                );
            }
        } else {
            jdbcTemplate.update("""
                            INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
                            VALUES (?, date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, ?)
                            ON CONFLICT (org_id, month_start)
                            DO UPDATE SET tokens_used = org_monthly_token_counters.tokens_used + EXCLUDED.tokens_used
                            """,
                    membership.orgId(), totalTokens
            );
        }
    }
}
