package com.deutschflow.user.onboarding.service;

import com.deutschflow.user.onboarding.FirstLessonKind;
import com.deutschflow.user.onboarding.dto.ActivationDtos.ActivationResponse;
import com.deutschflow.user.onboarding.dto.ActivationDtos.CoreDoneResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * ACTIVATION — ghi {@code user_onboarding_progress.activated_at} đúng MỘT lần, từ đúng MỘT chỗ.
 *
 * <p>Vì sao tồn tại (kế hoạch 17/09 §4.6, gap B-1): bảng V287 có cột {@code activated_at} từ
 * #412 nhưng chưa bao giờ được ghi — "thành công" của onboarding vì thế không có mẫu số. Nay mọi
 * nguồn hoàn thành bài đầu tiên (5 {@link FirstLessonKind}) đều đi qua đây; dashboard funnel đọc
 * từ bảng, PostHog chỉ là bản đối chiếu.
 *
 * <p>Thiết kế:
 * <ul>
 *   <li><b>Idempotent + an toàn đua:</b> {@code INSERT … ON CONFLICT DO NOTHING} rồi
 *       {@code UPDATE … WHERE activated_at IS NULL} — hai request song song thì đúng một bên
 *       thấy {@code firstTime=true}. Không read-then-write bằng JPA.</li>
 *   <li><b>Giao dịch RIÊNG ({@code REQUIRES_NEW}) qua {@link TransactionTemplate}:</b> hook nằm
 *       trong giao dịch của việc hoàn thành thật (Ngày 1, placement, chặng lộ trình…). Một lỗi ở
 *       đây KHÔNG được làm hỏng việc học của người dùng, và một câu SQL đổ trong giao dịch chung
 *       sẽ đầu độc cả giao dịch ấy dù có catch. Dùng template, không dùng annotation, để tránh
 *       bẫy tự-gọi qua proxy (memory {@code reference_spring_proxy_scheduled_gotchas}).</li>
 *   <li><b>Không phụ thuộc guest session:</b> người đăng ký thẳng (chưa claim) cũng phải có dòng
 *       tiến độ — {@code ensureRow} tạo với {@code flow_version=onb_v3}.</li>
 * </ul>
 */
@Service
@Slf4j
public class OnboardingActivationService {

    public static final String FLOW_VERSION = "onb_v3";
    static final String STEP_FIRST_LESSON = "FIRST_LESSON";
    static final String STEP_CORE_DONE = "CORE_DONE";
    static final String ACTIVITY_PREFIX = "FIRST_LESSON:";

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate requiresNew;

    public OnboardingActivationService(JdbcTemplate jdbc, ObjectMapper objectMapper,
                                       PlatformTransactionManager txManager) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.requiresNew = new TransactionTemplate(txManager);
        this.requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Endpoint client (mobile Câu đầu tiên) và các hook server đều gọi vào đây. */
    public ActivationResponse recordFirstLesson(long userId, FirstLessonKind kind) {
        return requiresNew.execute(status -> {
            Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
            ensureRow(userId, now);
            int won = jdbc.update(
                    "UPDATE user_onboarding_progress SET activated_at = ? WHERE user_id = ? AND activated_at IS NULL",
                    odt(now), userId);
            String activity = ACTIVITY_PREFIX + kind.name();
            jdbc.update("""
                    UPDATE user_onboarding_progress
                    SET completed_activities = CASE
                            WHEN completed_activities @> jsonb_build_array(CAST(? AS text)) THEN completed_activities
                            ELSE completed_activities || jsonb_build_array(CAST(? AS text)) END,
                        last_step = CASE WHEN core_completed_at IS NULL THEN ? ELSE last_step END,
                        updated_at = ?
                    WHERE user_id = ?
                    """, activity, activity, STEP_FIRST_LESSON, odt(now), userId);
            Row row = read(userId);
            if (won == 1) {
                log.info("[ACTIVATION] userId={} kind={} — kích hoạt lần đầu", userId, kind);
            }
            return new ActivationResponse(row.activatedAt(), won == 1, row.completedActivities());
        });
    }

    /**
     * Bản dùng cho HOOK server: nuốt mọi lỗi, chỉ log. Việc hoàn thành thật của người dùng
     * (Ngày 1, placement, chặng lộ trình, nói thử) không bao giờ được đổ vì sổ activation.
     */
    public void recordFirstLessonQuietly(Long userId, FirstLessonKind kind) {
        if (userId == null) {
            return;
        }
        try {
            recordFirstLesson(userId, kind);
        } catch (RuntimeException e) {
            log.warn("[ACTIVATION] userId={} kind={} không ghi được activation: {}", userId, kind, e.toString());
        }
    }

    /** Đi hết luồng onboarding kể cả bước nhắc học (kể cả từ chối — I-4). Idempotent. */
    public CoreDoneResponse recordCoreDone(long userId) {
        return requiresNew.execute(status -> {
            Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
            ensureRow(userId, now);
            int won = jdbc.update(
                    "UPDATE user_onboarding_progress SET core_completed_at = ? WHERE user_id = ? AND core_completed_at IS NULL",
                    odt(now), userId);
            jdbc.update("UPDATE user_onboarding_progress SET last_step = ?, updated_at = ? WHERE user_id = ?",
                    STEP_CORE_DONE, odt(now), userId);
            return new CoreDoneResponse(read(userId).coreCompletedAt(), won == 1);
        });
    }

    // ─── Nội bộ ────────────────────────────────────────────────────────────────

    private void ensureRow(long userId, Instant now) {
        jdbc.update("""
                INSERT INTO user_onboarding_progress
                    (user_id, flow_version, last_step, completed_activities, created_at, updated_at)
                VALUES (?, ?, ?, '[]'::jsonb, ?, ?)
                ON CONFLICT (user_id) DO NOTHING
                """, userId, FLOW_VERSION, STEP_FIRST_LESSON, odt(now), odt(now));
    }

    private Row read(long userId) {
        return jdbc.queryForObject("""
                SELECT activated_at, core_completed_at, completed_activities::text AS activities
                FROM user_onboarding_progress WHERE user_id = ?
                """, (rs, i) -> new Row(
                toInstant(rs.getObject("activated_at", OffsetDateTime.class)),
                toInstant(rs.getObject("core_completed_at", OffsetDateTime.class)),
                parse(rs.getString("activities"))), userId);
    }

    private List<String> parse(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, STRING_LIST);
        } catch (Exception e) {
            log.warn("[ACTIVATION] completed_activities không đọc được: {}", e.toString());
            return List.of();
        }
    }

    private static OffsetDateTime odt(Instant i) {
        return OffsetDateTime.ofInstant(i, ZoneOffset.UTC);
    }

    private static Instant toInstant(OffsetDateTime o) {
        return o == null ? null : o.toInstant();
    }

    private record Row(Instant activatedAt, Instant coreCompletedAt, List<String> completedActivities) {}

    /** Dùng cho log/test: meta client gửi kèm không được lưu, chỉ in ra. */
    static String describe(Map<String, Object> meta) {
        return meta == null || meta.isEmpty() ? "" : meta.toString();
    }
}
