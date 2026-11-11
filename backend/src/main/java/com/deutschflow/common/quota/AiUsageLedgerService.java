package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService;
import com.deutschflow.organization.service.OrgQuotaService.OrgMembership;
import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;
import com.deutschflow.speaking.ai.TokenUsage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

@Service
public class AiUsageLedgerService {

    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;
    private final OrgQuotaService orgQuotaService;
    /**
     * Mốc "bây giờ" của bước trừ ví. Đọc qua bean ({@link com.deutschflow.common.config.ClockConfig})
     * chứ không gọi {@code Instant.now()} tĩnh: ví cộng dồn theo NGÀY LỊCH giờ VN, nên test phải ghim
     * được cùng một mốc cho cả dữ liệu dựng sẵn lẫn lời gọi này, thay vì hên xui theo giờ CI chạy.
     * Chi tiết: {@code backend/QUOTA_CLOCK_TESTING.md}.
     */
    private final Clock clock;

    /**
     * Mặc định của {@code app.quota.stt-tokens-per-second}: token-tương-đương cho mỗi giây ghi âm.
     * Chủ dự án chốt 90 (trước đó 20) vì 20 thấp hơn chi phí thật của một giây ghi âm nhiều lần.
     */
    public static final long DEFAULT_STT_TOKENS_PER_SECOND = 90L;

    /**
     * Token-tương-đương cho mỗi giây audio STT, đọc từ {@code app.quota.stt-tokens-per-second}.
     * Nhà cung cấp STT tính tiền theo giây (không theo token), nên để STT cũng trừ vào org token
     * pool + ví người dùng như các tính năng token khác (audit M-3: trước đây STT KHÔNG trừ gì →
     * org metered chạy Speaking "miễn phí" với pool) phải quy giây ra token.
     *
     * <p>Các cổng kiểm tra trước khi gọi STT ({@code STT_ESTIMATED_TOKENS} = 900 ở
     * {@code AiSessionController}, {@code PronunciationController}, {@code SkillTreeController},
     * {@code ExamSessionService}) được đặt bằng một clip ~10 giây theo mặc định 90. Đổi cấu hình
     * này đáng kể thì rà lại các hằng đó.
     */
    private final long sttTokensPerSecond;

    @Autowired
    public AiUsageLedgerService(JdbcTemplate jdbcTemplate,
                                QuotaService quotaService,
                                OrgQuotaService orgQuotaService,
                                Clock clock,
                                @Value("${app.quota.stt-tokens-per-second:" + DEFAULT_STT_TOKENS_PER_SECOND + "}")
                                long sttTokensPerSecond) {
        if (sttTokensPerSecond <= 0) {
            // 0 hoặc âm = ghi âm miễn phí (hoặc CỘNG token) cho mọi người — sai cấu hình, không chạy tiếp.
            throw new IllegalArgumentException(
                    "app.quota.stt-tokens-per-second phải > 0, đang là " + sttTokensPerSecond);
        }
        this.jdbcTemplate = jdbcTemplate;
        this.quotaService = quotaService;
        this.orgQuotaService = orgQuotaService;
        this.clock = clock;
        this.sttTokensPerSecond = sttTokensPerSecond;
    }

    /** Dùng mặc định {@link #DEFAULT_STT_TOKENS_PER_SECOND} — cho test dựng service bằng tay. */
    public AiUsageLedgerService(JdbcTemplate jdbcTemplate, QuotaService quotaService,
                                OrgQuotaService orgQuotaService, Clock clock) {
        this(jdbcTemplate, quotaService, orgQuotaService, clock, DEFAULT_STT_TOKENS_PER_SECOND);
    }

    /** Số token-tương-đương tính cho {@code durationSeconds} giây ghi âm (làm tròn; không âm). */
    public long sttTokensFor(double durationSeconds) {
        if (!(durationSeconds > 0)) {
            return 0L;
        }
        return Math.round(durationSeconds * sttTokensPerSecond);
    }

    @Transactional(rollbackFor = Exception.class)
    public void recordStt(Long userId, String feature, String model, double durationSeconds) {
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("usage-ledger");
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
            chargeOrgPoolAndWallet(userId, sttTokensFor(durationSeconds));
        }
    }

    /**
     * Ghi ledger từ {@link TokenUsage} của chính lượt gọi — <b>overload nên dùng</b> cho mọi call
     * site đang có {@code AiChatCompletionResult} trong tay.
     *
     * <p>Vì sao tồn tại thay vì cứ truyền 4 số: nó mang theo {@code cachedPromptTokens} mà không
     * bắt call site nhớ thứ tự 4 tham số int liền nhau (dễ đặt lệch slot), và bảo đảm mọi luồng
     * đều ghi phần cache. Nhà cung cấp tính token cache rẻ hơn 2–10× nên thiếu nó là báo cáo COGS
     * khai vống (đo 09/08: cache hit ~99% ở cả 8 tier — xem V270).
     */
    @Transactional(rollbackFor = Exception.class)
    public void record(long userId,
                       String provider,
                       String model,
                       TokenUsage usage,
                       String feature,
                       String requestId,
                       Long sessionId) {
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("usage-ledger");
        if (usage == null) {
            return;
        }
        record(userId, provider, model, usage.promptTokens(), usage.cachedPromptTokens(),
                usage.completionTokens(), usage.totalTokens(), feature, requestId, sessionId);
    }

    /**
     * Chữ ký cũ (không có số liệu cache) — giữ cho call site tự dựng số bằng tay (sinh ảnh, ước
     * lượng). Phần prompt sẽ được định giá TOÀN BỘ theo giá input thường, tức ước CAO.
     */
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
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("usage-ledger");
        record(userId, provider, model, promptTokens, 0, completionTokens, totalTokens,
                feature, requestId, sessionId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void record(long userId,
                       String provider,
                       String model,
                       int promptTokens,
                       int cachedPromptTokens,
                       int completionTokens,
                       int totalTokens,
                       String feature,
                       String requestId,
                       Long sessionId) {
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("usage-ledger");
        // Capture org_id at event time via subquery (D-2) — single round-trip, no separate lookup.
        // M-5: org đọc từ org_members ACTIVE (cùng nguồn với gate tryReserve) thay vì users.org_id —
        // hết cảnh charge và gate nhìn hai nguồn tenant khác nhau rồi drift. ORDER BY khớp
        // resolveActiveMembership (staff-first) để event và chỗ trừ pool luôn quy CÙNG một org.
        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, org_id, provider, model,
                          prompt_tokens, cached_prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, session_id
                        )
                        SELECT ?,
                               (SELECT om.org_id FROM org_members om
                                 WHERE om.user_id = u.id AND om.status = 'ACTIVE'
                                 ORDER BY (om.role = 'STUDENT'), om.org_id LIMIT 1),
                               ?, ?, ?, ?, ?, ?, ?, ?, ?
                        FROM users u WHERE u.id = ?
                        """,
                userId, provider, model,
                // cached_prompt_tokens là phần CON của prompt_tokens (V270) — kẹp lại để một
                // upstream báo số vô lý không tạo ra hàng ledger tự mâu thuẫn (và cost âm).
                promptTokens, Math.max(0, Math.min(cachedPromptTokens, promptTokens)),
                completionTokens, totalTokens,
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
            quotaService.applyUsageDebit(userId, totalTokens, clock.instant());
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
