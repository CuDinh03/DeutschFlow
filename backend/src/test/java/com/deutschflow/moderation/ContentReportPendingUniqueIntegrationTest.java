package com.deutschflow.moderation;

import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.moderation.dto.ModerationDtos.ReportRequest;
import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.repository.ContentReportRepository;
import com.deutschflow.moderation.service.ContentReportService;
import com.deutschflow.moderation.service.ContentReportService.ReportOutcome;
import com.deutschflow.moderation.service.ModerationRateLimiterService;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Vòng review độc lập 10/09/2026 (verdict BLOCK) trên Postgres THẬT — Flyway áp đủ V321 + V322:
 * <ul>
 *   <li>MEDIUM — khử trùng có chốt DB: ba unique partial index {@code uq_content_reports_pending_dm/class/user}
 *       (V321 §4b) chặn dòng PENDING thứ hai cùng khoá; index BỘ PHẬN nên RESOLVED/DISMISSED + PENDING cùng khoá
 *       vẫn được, và ba index tách theo context nên khoá của ngữ cảnh khác tình cờ cùng số không va nhau;</li>
 *   <li>HIGH — FK {@code fk_content_reports_reporter} khai NOT VALID ở V321, VALIDATE ở V322 (transaction Flyway
 *       riêng): sau migration {@code pg_constraint.convalidated} phải là {@code true} và định nghĩa không còn đuôi
 *       NOT VALID;</li>
 *   <li>service thua cuộc đua: INSERT vấp unique trong transaction CON (REQUIRES_NEW), transaction NGOÀI còn dùng
 *       được để tra lại, trả id dòng thắng với {@code duplicate = true}, và lượt throttle được trả.</li>
 * </ul>
 *
 * <p>Không dùng {@code @Transactional} cấp test: dữ liệu commit thật; người dùng sinh mới mỗi ca nên test chạy lại
 * được trên DB local bền vững ({@code DEUTSCHFLOW_IT_JDBC_URL}). Tự bỏ qua khi không có Postgres — xem
 * {@link AbstractPostgresIntegrationTest}.
 */
@SpringBootTest
@DisplayName("content_reports: unique partial chống đua khử trùng (V321) + FK NOT VALID → VALIDATE (V322) — review 10/09/2026")
class ContentReportPendingUniqueIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PENDING_LOOKUP_USER =
            "findFirstByReporterIdAndContextAndReportedUserIdAndStatusOrderByCreatedAtDesc";

    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @Autowired private ContentReportRepository reportRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private ClassChannelMessageRepository classChannelMessageRepository;
    @Autowired private ClassStudentRepository classStudentRepository;
    @Autowired private ClassTeacherRepository classTeacherRepository;
    @Autowired private AuditOrgResolver orgResolver;
    @Autowired private PlatformTransactionManager txManager;

    private Long reporter;
    private Long subject;

    @BeforeEach
    void seedUsers() {
        reporter = newUser("dedup-reporter");
        subject = newUser("dedup-subject");
    }

    // ── 1. Tầng DB: ba unique partial index (V321 §4b) ───────────────────────────────────────

    @Test
    @DisplayName("USER: hai INSERT thô cùng (reporter, reported_user) còn PENDING → lần 2 vấp uq_content_reports_pending_user")
    void user_secondPendingInsertHitsUniqueIndex() {
        insertUser(reporter, subject, "PENDING");

        assertThatThrownBy(() -> insertUser(reporter, subject, "PENDING"))
                .isInstanceOf(DuplicateKeyException.class)
                .hasMessageContaining("uq_content_reports_pending_user");

        assertThat(pendingUserCount(reporter, subject)).isEqualTo(1L);
    }

    @Test
    @DisplayName("DIRECT_MESSAGE: cùng (reporter, message_id) còn PENDING → lần 2 vấp uq_content_reports_pending_dm")
    void directMessage_secondPendingInsertHitsUniqueIndex() {
        long messageId = randomId();
        insertDm(reporter, subject, messageId, "PENDING");

        assertThatThrownBy(() -> insertDm(reporter, subject, messageId, "PENDING"))
                .isInstanceOf(DuplicateKeyException.class)
                .hasMessageContaining("uq_content_reports_pending_dm");
    }

    @Test
    @DisplayName("CLASS_MESSAGE: cùng (reporter, class_message_id) còn PENDING → lần 2 vấp uq_content_reports_pending_class")
    void classMessage_secondPendingInsertHitsUniqueIndex() {
        long classMessageId = randomId();
        insertClass(reporter, subject, classMessageId, "PENDING");

        assertThatThrownBy(() -> insertClass(reporter, subject, classMessageId, "PENDING"))
                .isInstanceOf(DuplicateKeyException.class)
                .hasMessageContaining("uq_content_reports_pending_class");
    }

    @Test
    @DisplayName("index BỘ PHẬN: RESOLVED, DISMISSED và PENDING cùng khoá đều được — đã phán quyết rồi mà báo lại là sự việc mới")
    void resolvedAndPendingWithSameKeyCoexist() {
        insertUser(reporter, subject, "RESOLVED");
        insertUser(reporter, subject, "DISMISSED");
        insertUser(reporter, subject, "PENDING");

        assertThat(countUser(reporter, subject)).isEqualTo(3L);
        assertThat(pendingUserCount(reporter, subject)).isEqualTo(1L);
    }

    @Test
    @DisplayName("ba index chứ không phải một: USER (reporter, X), DIRECT_MESSAGE message_id = X, CLASS_MESSAGE class_message_id = X cùng PENDING không va nhau")
    void keysOfDifferentContextsNeverCollide() {
        // Cột đối tượng của ba ngữ cảnh tình cờ cùng số — một index ghép chung sẽ khớp nhầm; ba index tách theo
        // context (cùng lý do ContentReportRepository tách ba hàm tra) thì không.
        insertUser(reporter, subject, "PENDING");
        insertDm(reporter, subject, subject, "PENDING");
        insertClass(reporter, subject, subject, "PENDING");

        assertThat(countAllPending(reporter)).isEqualTo(3L);
    }

    @Test
    @DisplayName("reporter_id NULL (người tố cáo đã xoá tài khoản) không bao giờ va unique: hai dòng PENDING mồ côi cùng đối tượng đều được")
    void orphanedReportsNeverCollide() {
        insertUser(null, subject, "PENDING");
        insertUser(null, subject, "PENDING");

        Long orphans = jdbc.queryForObject(
                "SELECT count(*) FROM content_reports WHERE reporter_id IS NULL AND reported_user_id = ? "
                        + "AND context = 'USER' AND status = 'PENDING'", Long.class, subject);
        assertThat(orphans).isEqualTo(2L);
    }

    // ── 2. Catalog: V321 NOT VALID → V322 VALIDATE ──────────────────────────────────────────

    @Test
    @DisplayName("fk_content_reports_reporter: REFERENCES users ON DELETE SET NULL, convalidated = true sau V322, định nghĩa không còn NOT VALID")
    void reporterFkIsValidatedAndSetNull() {
        Map<String, Object> con = jdbc.queryForMap(
                "SELECT convalidated, pg_get_constraintdef(oid) AS def FROM pg_constraint "
                        + "WHERE conname = 'fk_content_reports_reporter'");

        assertThat(con.get("convalidated")).isEqualTo(Boolean.TRUE);
        String def = String.valueOf(con.get("def"));
        assertThat(def).contains("FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL");
        assertThat(def).doesNotContain("NOT VALID");
    }

    @Test
    @DisplayName("V321 + V322 đều success trong flyway_schema_history; ba unique partial index tồn tại, đều UNIQUE và có vị từ PENDING")
    void migrationsAppliedAndIndexesPresent() {
        List<Map<String, Object>> history = jdbc.queryForList(
                "SELECT version, success FROM flyway_schema_history WHERE version IN ('321','322') ORDER BY version");
        assertThat(history).extracting(r -> r.get("version")).containsExactly("321", "322");
        assertThat(history).allSatisfy(r -> assertThat(r.get("success")).isEqualTo(Boolean.TRUE));

        List<Map<String, Object>> indexes = jdbc.queryForList(
                "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'content_reports' "
                        + "AND indexname LIKE 'uq_content_reports_pending_%' ORDER BY indexname");
        assertThat(indexes).extracting(r -> r.get("indexname")).containsExactly(
                "uq_content_reports_pending_class", "uq_content_reports_pending_dm", "uq_content_reports_pending_user");
        for (Map<String, Object> r : indexes) {
            String def = String.valueOf(r.get("indexdef"));
            assertThat(def).startsWith("CREATE UNIQUE INDEX").contains("WHERE").contains("'PENDING'");
        }
    }

    // ── 3. Service: thua cuộc đua trên Postgres thật ───────────────────────────────────────

    @Test
    @DisplayName("service thua đua: tra-trước trượt (cửa sổ đua giả lập) → INSERT vấp unique trong transaction CON → tra lại, trả id dòng thắng, duplicate=true; transaction NGOÀI còn dùng được; lượt throttle được trả")
    void serviceLosingTheInsertRaceReturnsWinnerWithoutPoisoningOuterTransaction() {
        Long winner = insertUser(reporter, subject, "PENDING"); // "request song song" đã thắng và commit

        AtomicInteger lookups = new AtomicInteger();
        ModerationRateLimiterService limiter = new ModerationRateLimiterService(true, 1, 3600, 1, 86400, null);
        ContentReportService service = new ContentReportService(blindOnce(lookups), messageRepository,
                classChannelMessageRepository, classStudentRepository, classTeacherRepository, orgResolver, limiter,
                txManager);
        ReportRequest req = new ReportRequest(ContentReport.Context.USER, ContentReport.Reason.OTHER, subject,
                null, null, null, "thua đua");

        // Service ở đây là đối tượng thường (không proxy @Transactional) nên transaction ngoài dựng tay —
        // cùng ranh giới với lúc controller gọi bean thật. Trong đời thật dòng thắng commit SAU khi transaction
        // này mở; READ COMMITTED của Postgres cho câu lệnh kế tiếp thấy nó, ở đây nó có sẵn từ trước.
        TransactionTemplate outer = new TransactionTemplate(txManager);
        long[] pendingSeenByOuter = new long[1];
        ReportOutcome outcome = outer.execute(status -> {
            ReportOutcome o = service.report(reporter, req);
            // Nếu vi phạm unique đã làm hỏng transaction ngoài (cùng connection với INSERT), câu này ném
            // "current transaction is aborted" — đúng điều REQUIRES_NEW phải ngăn.
            pendingSeenByOuter[0] = pendingUserCount(reporter, subject);
            return o;
        });

        assertThat(outcome).isNotNull();
        assertThat(outcome.duplicate()).isTrue();
        assertThat(outcome.id()).isEqualTo(winner);
        assertThat(pendingSeenByOuter[0]).isEqualTo(1L);
        assertThat(pendingUserCount(reporter, subject)).as("không có dòng thứ hai lọt qua").isEqualTo(1L);
        assertThat(lookups.get()).as("tra-trước (mù) + tra-lại (thật)").isEqualTo(2);
        // hourMax = dayMax = 1: lượt duy nhất đã cấp cho lần thua đua phải được trả — người dùng vẫn nộp được
        // báo cáo kế tiếp, vì theo B2 lần trùng không "mua" slot nào.
        assertThat(limiter.decide(reporter).allowed()).isTrue();
    }

    /**
     * Repository "mù một lần": lời gọi ĐẦU của hàm tra PENDING theo USER trả rỗng — giả lập đúng cửa sổ đua
     * (tra-trước chạy khi request song song chưa commit); mọi lời gọi khác đi thẳng vào bean thật, kể cả
     * {@code saveAndFlush} để INSERT vấp unique thật. Proxy JDK thay vì Mockito.spy trên proxy Spring Data:
     * không phụ thuộc mock-maker, không đổi Spring context.
     */
    private ContentReportRepository blindOnce(AtomicInteger lookups) {
        AtomicBoolean blind = new AtomicBoolean(true);
        return (ContentReportRepository) Proxy.newProxyInstance(
                ContentReportRepository.class.getClassLoader(),
                new Class<?>[] {ContentReportRepository.class},
                (proxy, method, args) -> {
                    if (PENDING_LOOKUP_USER.equals(method.getName())) {
                        lookups.incrementAndGet();
                        if (blind.compareAndSet(true, false)) {
                            return Optional.empty();
                        }
                    }
                    try {
                        return method.invoke(reportRepository, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();
                    }
                });
    }

    // ── dựng cảnh + truy vấn thẳng DB ─────────────────────────────────────────────────────

    private Long insertUser(Long reporterId, Long reportedUserId, String status) {
        return jdbc.queryForObject(
                "INSERT INTO content_reports(reporter_id, reported_user_id, context, reason, status, created_at) "
                        + "VALUES (?, ?, 'USER', 'SPAM', ?, now()) RETURNING id",
                Long.class, reporterId, reportedUserId, status);
    }

    private Long insertDm(Long reporterId, Long reportedUserId, long messageId, String status) {
        return jdbc.queryForObject(
                "INSERT INTO content_reports(reporter_id, reported_user_id, context, message_id, reason, status, created_at) "
                        + "VALUES (?, ?, 'DIRECT_MESSAGE', ?, 'SPAM', ?, now()) RETURNING id",
                Long.class, reporterId, reportedUserId, messageId, status);
    }

    private Long insertClass(Long reporterId, Long reportedUserId, long classMessageId, String status) {
        return jdbc.queryForObject(
                "INSERT INTO content_reports(reporter_id, reported_user_id, context, class_message_id, reason, status, created_at) "
                        + "VALUES (?, ?, 'CLASS_MESSAGE', ?, 'SPAM', ?, now()) RETURNING id",
                Long.class, reporterId, reportedUserId, classMessageId, status);
    }

    private long pendingUserCount(Long reporterId, Long reportedUserId) {
        Long n = jdbc.queryForObject(
                "SELECT count(*) FROM content_reports WHERE reporter_id = ? AND reported_user_id = ? "
                        + "AND context = 'USER' AND status = 'PENDING'", Long.class, reporterId, reportedUserId);
        return n == null ? 0L : n;
    }

    private long countUser(Long reporterId, Long reportedUserId) {
        Long n = jdbc.queryForObject(
                "SELECT count(*) FROM content_reports WHERE reporter_id = ? AND reported_user_id = ? AND context = 'USER'",
                Long.class, reporterId, reportedUserId);
        return n == null ? 0L : n;
    }

    private long countAllPending(Long reporterId) {
        Long n = jdbc.queryForObject(
                "SELECT count(*) FROM content_reports WHERE reporter_id = ? AND status = 'PENDING'", Long.class, reporterId);
        return n == null ? 0L : n;
    }

    /** message_id / class_message_id cố ý không có FK (V244) nên số ngẫu nhiên là đủ; tránh va dữ liệu cũ trên DB bền vững. */
    private static long randomId() {
        return ThreadLocalRandom.current().nextLong(1_000_000_000L, Long.MAX_VALUE);
    }

    private Long newUser(String prefix) {
        return userRepository.save(User.builder()
                .email(prefix + "-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Dedup Tester")
                .role(User.Role.STUDENT)
                .build()).getId();
    }
}
