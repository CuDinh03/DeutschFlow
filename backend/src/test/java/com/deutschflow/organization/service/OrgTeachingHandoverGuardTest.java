package com.deutschflow.organization.service;

import com.deutschflow.common.exception.ConflictException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * G-07 — chốt chặn LỚP MỒ CÔI. Kiểm cả hai nửa: hàm quyết định thuần (thông điệp nói đúng số lớp,
 * đúng hệ quả, đúng việc phải làm) và đường ném qua {@link OrgTeachingHandoverGuard}.
 */
@ExtendWith(MockitoExtension.class)
class OrgTeachingHandoverGuardTest {

    @Mock JdbcTemplate jdbc;
    @InjectMocks OrgTeachingHandoverGuard guard;

    // ── hàm quyết định thuần ──────────────────────────────────────────────────

    @Test
    @DisplayName("Không lớp nào mồ côi → không chặn")
    void noOrphanedClasses_noBlock() {
        assertThat(OrgTeachingHandoverGuard.blockReason(0, List.of(),
                OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG)).isNull();
    }

    @Test
    @DisplayName("Thông điệp nêu SỐ LỚP, tên lớp, hệ quả thật và việc phải làm trước — không phải 409 trống")
    void blockMessage_namesCountConsequenceAndFix() {
        String msg = OrgTeachingHandoverGuard.blockReason(1, List.of("A1.1 Tối T2-T4"),
                OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG);

        assertThat(msg)
                .contains("1 lớp")
                .contains("A1.1 Tối T2-T4")
                .contains("điểm danh")
                .contains("bàn giao");
    }

    @Test
    @DisplayName("Nhiều lớp hơn số tên đọc được → nêu 'và N lớp khác' chứ không cắt cụt im lặng")
    void blockMessage_moreClassesThanNames_mentionsRest() {
        String msg = OrgTeachingHandoverGuard.blockReason(5, List.of("A1", "A2", "B1"),
                OrgTeachingHandoverGuard.Action.REVOKE_TEACHING);

        assertThat(msg).contains("5 lớp").contains("A1, A2, B1").contains("và 2 lớp khác");
    }

    @Test
    @DisplayName("Không đọc được tên lớp nào → vẫn chặn và vẫn nêu số lớp")
    void blockMessage_withoutNames_stillBlocks() {
        String msg = OrgTeachingHandoverGuard.blockReason(3, List.of(),
                OrgTeachingHandoverGuard.Action.LEAVE_ORG);

        assertThat(msg).isNotNull().contains("3 lớp").doesNotContain("và 0 lớp khác");
    }

    @Test
    @DisplayName("Mỗi thao tác có câu mở đầu và câu 'rồi thử lại' riêng — người đọc biết mình vừa bấm gì")
    void blockMessage_isSpecificPerAction() {
        assertThat(OrgTeachingHandoverGuard.blockReason(1, List.of(),
                OrgTeachingHandoverGuard.Action.REVOKE_TEACHING)).contains("Tắt quyền dạy");
        assertThat(OrgTeachingHandoverGuard.blockReason(1, List.of(),
                OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG)).contains("Gỡ người này khỏi trung tâm");
        assertThat(OrgTeachingHandoverGuard.blockReason(1, List.of(),
                OrgTeachingHandoverGuard.Action.LEAVE_ORG)).contains("Rời trung tâm");
    }

    // ── đường ném ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Còn lớp mồ côi → ném 409 (ConflictException)")
    void assertNoOrphanedClasses_throwsWhenOrphaned() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any(), any()))
                .thenReturn(2L);
        when(jdbc.queryForList(anyString(), eq(String.class), any(), any(), any(), any()))
                .thenReturn(List.of("A1", "B2"));

        assertThatThrownBy(() -> guard.assertNoOrphanedClasses(10L, 99L,
                OrgTeachingHandoverGuard.Action.REMOVE_FROM_ORG))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("2 lớp");
    }

    @Test
    @DisplayName("Không lớp nào mồ côi → đi tiếp, và KHÔNG tốn thêm truy vấn đọc tên lớp")
    void assertNoOrphanedClasses_passesAndSkipsNameQuery() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any(), any()))
                .thenReturn(0L);

        assertThatCode(() -> guard.assertNoOrphanedClasses(10L, 99L,
                OrgTeachingHandoverGuard.Action.LEAVE_ORG)).doesNotThrowAnyException();
        org.mockito.Mockito.verify(jdbc, org.mockito.Mockito.never())
                .queryForList(anyString(), eq(String.class), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Truy vấn đếm trả null (không có dòng) → coi như 0, không NPE")
    void assertNoOrphanedClasses_nullCountTreatedAsZero() {
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any(), any()))
                .thenReturn(null);

        assertThat(guard.countOrphanedClasses(10L, 99L)).isZero();
    }
}
