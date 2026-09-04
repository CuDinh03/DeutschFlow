package com.deutschflow.common.audit;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * C14/F-L9 (03/09/2026): audit_logs phải append-only ở TẦNG DB (trigger V303), không chỉ theo quy
 * ước tầng app — một câu SQL lạc cũng không sửa/xoá được vết. Chạy trên PostgreSQL thật vì đây là
 * hành vi trigger, mock không chứng minh được gì.
 */
@SpringBootTest
class AuditLogsImmutableIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String EVENT = "__c14_immutability_probe__";

    @Autowired
    JdbcTemplate jdbcTemplate;

    @AfterEach
    void cleanupNote() {
        // KHÔNG dọn dòng probe — chính trigger đang test cấm DELETE. Một dòng event __c14__ nằm lại
        // trong DB test là vô hại và tự nó là bằng chứng trigger sống.
    }

    private long insertProbe() {
        return jdbcTemplate.queryForObject("""
                INSERT INTO audit_logs (event_name, target_type, target_id)
                VALUES (?, 'TEST', 'c14') RETURNING id
                """, Long.class, EVENT);
    }

    @Test
    @DisplayName("INSERT vẫn hoạt động bình thường (append-only, không phải khoá bảng)")
    void insertStillWorks() {
        long id = insertProbe();
        assertThat(id).isPositive();
    }

    @Test
    @DisplayName("UPDATE một dòng audit bị trigger chặn")
    void updateIsBlocked() {
        long id = insertProbe();

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE audit_logs SET event_name = 'tampered' WHERE id = ?", id))
                .hasMessageContaining("append-only");
    }

    @Test
    @DisplayName("DELETE một dòng audit bị trigger chặn")
    void deleteIsBlocked() {
        long id = insertProbe();

        assertThatThrownBy(() -> jdbcTemplate.update(
                "DELETE FROM audit_logs WHERE id = ?", id))
                .hasMessageContaining("append-only");
    }
}
