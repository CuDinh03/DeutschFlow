package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.QuotaSnapshot;
import com.deutschflow.grammar.dto.MockExamPackDetailDto;
import com.deutschflow.grammar.dto.MockExamPackDto;
import com.deutschflow.grammar.entity.MockExamPack;
import com.deutschflow.grammar.repository.MockExamPackRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Khoá tier-gating bộ đề (D3): GV FREE thấy pack trả-phí bị khoá; gói trả phí mở khoá. */
@ExtendWith(MockitoExtension.class)
class MockExamPackServiceTest {

    @Mock MockExamPackRepository packRepository;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock QuotaService quotaService;

    @InjectMocks MockExamPackService service;

    private MockExamPack pack(long id, boolean requiresPaid) {
        return MockExamPack.builder()
                .id(id).title("Goethe B1").cefrLevel("B1").examFormat("GOETHE")
                .requiresPaid(requiresPaid).active(true).sortOrder((int) id).build();
    }

    private void planIs(String planCode) {
        when(quotaService.getSnapshotReadOnly(anyLong(), any())).thenReturn(snapshot(planCode));
    }

    private QuotaSnapshot snapshot(String planCode) {
        return new QuotaSnapshot(planCode, false, null, null, 0L, 0L, 0L, 0L, 0L, null, null);
    }

    @Test
    @DisplayName("FREE: pack trả-phí → locked=true, pack miễn phí → locked=false")
    void listPacks_freeUser_paidLocked() {
        planIs("FREE");
        when(packRepository.findByActiveTrueOrderBySortOrderAsc())
                .thenReturn(List.of(pack(1L, true), pack(2L, false)));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any())).thenReturn(3);

        List<MockExamPackDto> packs = service.listPacks(7L);

        assertThat(packs).hasSize(2);
        assertThat(packs.get(0).locked()).isTrue();   // requiresPaid pack
        assertThat(packs.get(0).examCount()).isEqualTo(3);
        assertThat(packs.get(1).locked()).isFalse();  // free pack
    }

    @Test
    @DisplayName("gói trả phí (PRO) → mọi pack mở khoá")
    void listPacks_paidUser_allUnlocked() {
        planIs("PRO");
        when(packRepository.findByActiveTrueOrderBySortOrderAsc()).thenReturn(List.of(pack(1L, true)));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any())).thenReturn(5);

        assertThat(service.listPacks(7L).get(0).locked()).isFalse();
    }

    @Test
    @DisplayName("DEFAULT (hết hạn dùng thử PRO) → coi như chưa trả phí, pack trả-phí BỊ KHOÁ")
    void listPacks_defaultPlan_locked() {
        planIs("DEFAULT");
        when(packRepository.findByActiveTrueOrderBySortOrderAsc()).thenReturn(List.of(pack(1L, true)));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(), any())).thenReturn(3);

        assertThat(service.listPacks(7L).get(0).locked()).isTrue();
    }

    @Test
    @DisplayName("getPack: pack trả-phí + user FREE → Forbidden, KHÔNG truy vấn đề")
    void getPack_lockedForFree_throwsForbidden() {
        planIs("FREE");
        when(packRepository.findById(1L)).thenReturn(Optional.of(pack(1L, true)));

        assertThatThrownBy(() -> service.getPack(7L, 1L)).isInstanceOf(ForbiddenException.class);
        verify(jdbcTemplate, never()).query(anyString(), any(RowMapper.class), any(), any());
    }

    @Test
    @DisplayName("getPack: user trả phí (ULTRA) → trả về danh sách đề trong pack")
    void getPack_paidUser_returnsExams() {
        planIs("ULTRA");
        when(packRepository.findById(1L)).thenReturn(Optional.of(pack(1L, true)));
        when(jdbcTemplate.query(anyString(), any(RowMapper.class), any(), any())).thenReturn(
                List.of(new MockExamPackDetailDto.PackExamDto(10L, "Đề số 1", 100, 60, 165)));

        MockExamPackDetailDto detail = service.getPack(7L, 1L);

        assertThat(detail.cefrLevel()).isEqualTo("B1");
        assertThat(detail.exams()).hasSize(1);
        assertThat(detail.exams().get(0).title()).isEqualTo("Đề số 1");
    }

    @Test
    @DisplayName("getPack: không tồn tại → NotFound")
    void getPack_missing_throwsNotFound() {
        when(packRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPack(7L, 99L)).isInstanceOf(NotFoundException.class);
    }
}
