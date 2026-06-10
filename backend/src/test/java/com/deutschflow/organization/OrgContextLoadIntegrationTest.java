package com.deutschflow.organization;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Full-context smoke test. Boots the entire Spring application against a fresh
 * Testcontainers PostgreSQL: Flyway applies every migration (V1..V206), {@code ddl-auto=validate}
 * checks every entity maps to its table, and Spring Data validates all derived queries against
 * their entities — including {@code TeacherClassRepository.findByOrgId}, which previously had a
 * matching DB column but no {@code TeacherClass.orgId} field and would have failed startup.
 *
 * <p>This guards the whole org module against the class of latent "missing entity field /
 * unresolvable derived query" bug that ordinary mock-based unit tests cannot catch.
 */
@SpringBootTest
class OrgContextLoadIntegrationTest extends AbstractPostgresIntegrationTest {

    @Test
    void contextLoads() {
        // Success = the application context started cleanly with all migrations + mappings valid.
    }
}
