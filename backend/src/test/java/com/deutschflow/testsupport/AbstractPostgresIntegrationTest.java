package com.deutschflow.testsupport;

import com.deutschflow.system.service.MaintenanceStateService;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Shared PostgreSQL (Testcontainers) for Spring Boot integration tests. Flyway runs on startup
 * using real migrations; do not use H2 or hand-written schema SQL on this branch.
 */
@ActiveProfiles("test")
public abstract class AbstractPostgresIntegrationTest {

    // Trạng thái TOÀN CỤC có thể rò giữa các lớp test (context Spring cache + DB dùng chung).
    // `required = false` để lớp con nào dựng context cắt (không có bean) vẫn chạy được.
    @Autowired(required = false)
    private JdbcTemplate globalStateJdbc;

    @Autowired(required = false)
    private MaintenanceStateService maintenanceStateService;

    @BeforeAll
    static void assumePostgresAvailable() {
        // availableOrFailWhenMandatory() NÉM lỗi khi DEUTSCHFLOW_IT_REQUIRE_DB=true mà không có DB
        // → CI đỏ. Máy dev không đặt cờ thì vẫn skip êm như cũ.
        Assumptions.assumeTrue(
                PostgresIntegrationDb.availableOrFailWhenMandatory(),
                () -> "Skipping PostgreSQL integration tests: Docker/Testcontainers is unavailable and "
                        + PostgresIntegrationDb.ENV_JDBC_URL + " is not configured.");
    }

    /**
     * Dọn trạng thái toàn cục TRƯỚC mỗi test — chạy trước {@code @BeforeEach} của lớp con (JUnit 5:
     * lớp cha trước), nên lớp con nào cần dựng cửa sổ bảo trì vẫn dựng được sau đó.
     *
     * <p>Vì sao (CI đỏ 17/09/2026, run 35227627362): {@code MaintenanceModeFilter} trả 503 cho MỌI
     * request ngoài whitelist khi {@link MaintenanceStateService} giữ snapshot "đang ACTIVE". Snapshot
     * là cache in-memory, được {@code @Scheduled} refresh mỗi 15 s và {@code refreshNow()} sau mutation.
     * Một lớp test dựng cửa sổ ACTIVE rồi {@code deleteAll()} ở {@code @AfterEach} — nếu nhịp refresh
     * định kỳ đọc DB đúng lúc cửa sổ còn sống và ghi snapshot SAU {@code refreshNow()} (hoặc lớp đó
     * đổ trước khi tới {@code @AfterEach}), snapshot "đang bảo trì" sống tới 15 s và MỌI lớp chạy
     * kế tiếp ({@code AdminForceOwnerIntegrationTest}, {@code OrgAuditControllerRbacIntegrationTest}
     * 7/7) đỏ hàng loạt {@code expected 200|403 but was 503}. Rerun thì xanh vì thứ tự/nhịp khác.
     *
     * <p>Dọn ở LỚP NỀN chứ không ở từng lớp bảo trì: bên bị hại là lớp bất kỳ chạy sau, nên phòng
     * thủ phải nằm ở nơi mọi lớp đi qua. Xoá DB rồi ép cache đọc lại; hai bước đều idempotent và
     * rẻ (bảng gần như luôn rỗng). Không có FK nào trỏ tới {@code maintenance_windows}.
     */
    @BeforeEach
    void purgeLeakedGlobalState() {
        if (globalStateJdbc != null) {
            globalStateJdbc.update("DELETE FROM maintenance_windows");
        }
        if (maintenanceStateService != null) {
            maintenanceStateService.refreshNow();
        }
    }

    @DynamicPropertySource
    static void registerDatasource(DynamicPropertyRegistry registry) {
        PostgresIntegrationDb.Config db = PostgresIntegrationDb.resolve();
        registry.add("spring.datasource.url", db::jdbcUrl);
        registry.add("spring.datasource.username", db::username);
        registry.add("spring.datasource.password", db::password);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }
}
