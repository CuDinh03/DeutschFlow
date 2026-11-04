package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Trang admin chọn học viên dùng luyện đề telc (04/11/2026): thêm/gỡ có hiệu lực NGAY với cổng
 * {@link MockExamPracticeService#hasAccess} (đọc thẳng DB), mục email cũ gộp về id, chế độ lạ bị chặn.
 */
@SpringBootTest
@DisplayName("Quyền luyện đề telc — trang admin")
class PracticeAccessAdminIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 991_204L;
    private static final String EMAIL = "practice-" + UID + "@test.local";

    @Autowired private PracticeAccessAdminService admin;
    @Autowired private MockExamPracticeService practice;
    @Autowired private JdbcTemplate jdbc;

    private String savedMode;
    private String savedList;

    @BeforeEach
    void setUp() {
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, display_name, role, created_at)
                VALUES (?, ?, 'x', 'Học viên luyện đề', 'STUDENT', NOW())
                ON CONFLICT (id) DO NOTHING
                """, UID, EMAIL);
        savedMode = value(MockExamPracticeService.ACCESS_KEY);
        savedList = value(MockExamPracticeService.ALLOWLIST_KEY);
        admin.setMode("ALLOWLIST");
        jdbc.update("UPDATE system_config SET config_value = '' WHERE config_key = ?", MockExamPracticeService.ALLOWLIST_KEY);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("UPDATE system_config SET config_value = ? WHERE config_key = ?", savedMode, MockExamPracticeService.ACCESS_KEY);
        jdbc.update("UPDATE system_config SET config_value = ? WHERE config_key = ?", savedList, MockExamPracticeService.ALLOWLIST_KEY);
        jdbc.update("DELETE FROM users WHERE id = ?", UID);
    }

    @Test
    void themBangEmailThiVaoDuocNgay_goThiBiChan() {
        User student = student();
        assertThat(practice.hasAccess(student)).isFalse();

        var state = admin.add(EMAIL.toUpperCase());
        assertThat(state.members()).extracting(PracticeAccessAdminService.Member::id).containsExactly(UID);
        assertThat(value(MockExamPracticeService.ALLOWLIST_KEY)).isEqualTo(String.valueOf(UID));
        assertThat(practice.hasAccess(student)).isTrue();

        admin.remove(UID);
        assertThat(practice.hasAccess(student)).isFalse();
    }

    @Test
    void mucEmailCuDuocGopVeId_mucKhongNhanRaHienRieng() {
        jdbc.update("UPDATE system_config SET config_value = ? WHERE config_key = ?",
                EMAIL + ",ai-do@khong-ton-tai.test", MockExamPracticeService.ALLOWLIST_KEY);

        var before = admin.state();
        assertThat(before.members()).extracting(PracticeAccessAdminService.Member::id).containsExactly(UID);
        assertThat(before.unknown()).containsExactly("ai-do@khong-ton-tai.test");

        admin.add(String.valueOf(UID));
        assertThat(value(MockExamPracticeService.ALLOWLIST_KEY)).isEqualTo("ai-do@khong-ton-tai.test," + UID);

        admin.removeToken("ai-do@khong-ton-tai.test");
        assertThat(admin.state().unknown()).isEmpty();
    }

    @Test
    void cheDoAllMoChoMoiNguoi_cheDoLaBiChan_taiKhoanKhongCoThi404() {
        admin.setMode("all");
        assertThat(practice.hasAccess(student())).isTrue();
        assertThatThrownBy(() -> admin.setMode("ON")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> admin.add("khong-co@test.local")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void timTheoEmailHoacTen() {
        assertThat(admin.search("practice-" + UID)).extracting(PracticeAccessAdminService.Member::email).contains(EMAIL);
        assertThat(admin.search("x")).isEmpty();
    }

    private User student() {
        User u = mock(User.class);
        when(u.getId()).thenReturn(UID);
        when(u.getEmail()).thenReturn(EMAIL);
        when(u.getRole()).thenReturn(User.Role.STUDENT);
        return u;
    }

    private String value(String key) {
        return jdbc.queryForObject("SELECT config_value FROM system_config WHERE config_key = ?", String.class, key);
    }
}
