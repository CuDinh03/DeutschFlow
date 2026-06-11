package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.CreateMockExamPackRequest;
import com.deutschflow.grammar.dto.MockExamPackAdminDto;
import com.deutschflow.grammar.dto.UpdateMockExamPackRequest;
import com.deutschflow.grammar.entity.MockExamPack;
import com.deutschflow.grammar.repository.MockExamPackRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Admin CRUD over mock-exam packs (D3): defaults, normalization, partial update, soft-delete. */
@ExtendWith(MockitoExtension.class)
class AdminMockExamPackServiceTest {

    @Mock MockExamPackRepository packRepository;
    @Mock JdbcTemplate jdbcTemplate;

    @InjectMocks AdminMockExamPackService service;

    /** save() returns the entity with a generated id, like JPA would. */
    private void saveAssignsId() {
        when(packRepository.save(any(MockExamPack.class))).thenAnswer(inv -> {
            MockExamPack p = inv.getArgument(0);
            if (p.getId() == null) p.setId(42L);
            return p;
        });
    }

    private void examCountsReturn(Map<String, Integer> counts) {
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class))).thenReturn(counts);
    }

    @Test
    @DisplayName("create: applies defaults (GOETHE / requiresPaid / sortOrder) + normalizes level")
    void create_appliesDefaults() {
        saveAssignsId();
        examCountsReturn(Map.of());

        MockExamPackAdminDto dto = service.create(new CreateMockExamPackRequest(
                "  Goethe B1  ", "  mô tả  ", "b1", null, null, null));

        ArgumentCaptor<MockExamPack> captor = ArgumentCaptor.forClass(MockExamPack.class);
        verify(packRepository).save(captor.capture());
        MockExamPack saved = captor.getValue();
        assertThat(saved.getTitle()).isEqualTo("Goethe B1");      // trimmed
        assertThat(saved.getCefrLevel()).isEqualTo("B1");          // upper-cased
        assertThat(saved.getExamFormat()).isEqualTo("GOETHE");     // default
        assertThat(saved.isRequiresPaid()).isTrue();               // default
        assertThat(saved.isActive()).isTrue();
        assertThat(saved.getSortOrder()).isZero();                 // default
        assertThat(saved.getDescriptionVi()).isEqualTo("mô tả");   // trimmed

        assertThat(dto.id()).isEqualTo(42L);
        assertThat(dto.examCount()).isZero();
    }

    @Test
    @DisplayName("create: respects explicit requiresPaid=false and a custom format")
    void create_respectsExplicitFlags() {
        saveAssignsId();
        examCountsReturn(Map.of());

        service.create(new CreateMockExamPackRequest("A1 free", null, "A1", "telc", false, 5));

        ArgumentCaptor<MockExamPack> captor = ArgumentCaptor.forClass(MockExamPack.class);
        verify(packRepository).save(captor.capture());
        assertThat(captor.getValue().isRequiresPaid()).isFalse();
        assertThat(captor.getValue().getExamFormat()).isEqualTo("TELC");
        assertThat(captor.getValue().getSortOrder()).isEqualTo(5);
        assertThat(captor.getValue().getDescriptionVi()).isNull();
    }

    @Test
    @DisplayName("create: blank title → BadRequest, nothing saved")
    void create_blankTitle_throws() {
        assertThatThrownBy(() -> service.create(new CreateMockExamPackRequest(
                "   ", null, "B1", null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(packRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: missing CEFR level → BadRequest")
    void create_blankLevel_throws() {
        assertThatThrownBy(() -> service.create(new CreateMockExamPackRequest(
                "Title", null, null, null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(packRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: invalid CEFR level (typo) → BadRequest, nothing saved")
    void create_invalidLevel_throws() {
        assertThatThrownBy(() -> service.create(new CreateMockExamPackRequest(
                "Title", null, "B 1", null, null, null)))   // "B 1" is not a real CEFR level
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(new CreateMockExamPackRequest(
                "Title", null, "ZZ", null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(packRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: unknown exam format → BadRequest, nothing saved")
    void create_invalidFormat_throws() {
        assertThatThrownBy(() -> service.create(new CreateMockExamPackRequest(
                "Title", null, "B1", "UNKNOWN", null, null)))
                .isInstanceOf(BadRequestException.class);
        verify(packRepository, never()).save(any());
    }

    @Test
    @DisplayName("update: only non-null fields are applied (partial)")
    void update_partial_appliesProvidedOnly() {
        MockExamPack existing = MockExamPack.builder()
                .id(7L).title("Old").descriptionVi("old desc").cefrLevel("B1").examFormat("GOETHE")
                .requiresPaid(true).active(true).sortOrder(1).build();
        when(packRepository.findById(7L)).thenReturn(Optional.of(existing));
        saveAssignsId();
        examCountsReturn(Map.of("B1:GOETHE", 4));

        MockExamPackAdminDto dto = service.update(7L, new UpdateMockExamPackRequest(
                "New title", null, null, null, false, null, 9));

        assertThat(existing.getTitle()).isEqualTo("New title");   // changed
        assertThat(existing.getDescriptionVi()).isEqualTo("old desc"); // untouched (null in request)
        assertThat(existing.getCefrLevel()).isEqualTo("B1");      // untouched
        assertThat(existing.isRequiresPaid()).isFalse();          // changed
        assertThat(existing.getSortOrder()).isEqualTo(9);         // changed
        assertThat(existing.isActive()).isTrue();                 // untouched
        assertThat(dto.examCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("update: unknown id → NotFound")
    void update_missing_throwsNotFound() {
        when(packRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(99L, new UpdateMockExamPackRequest(
                "x", null, null, null, null, null, null)))
                .isInstanceOf(NotFoundException.class);
        verify(packRepository, never()).save(any());
    }

    @Test
    @DisplayName("deactivate: sets active=false")
    void deactivate_setsInactive() {
        MockExamPack existing = MockExamPack.builder()
                .id(3L).title("Pack").cefrLevel("B2").examFormat("GOETHE").active(true).build();
        when(packRepository.findById(3L)).thenReturn(Optional.of(existing));
        saveAssignsId();
        examCountsReturn(Map.of());

        MockExamPackAdminDto dto = service.deactivate(3L);

        assertThat(existing.isActive()).isFalse();
        assertThat(dto.active()).isFalse();
    }

    @Test
    @DisplayName("list: returns all packs with live exam counts")
    void list_returnsAllWithCounts() {
        MockExamPack b1 = MockExamPack.builder()
                .id(1L).title("B1").cefrLevel("B1").examFormat("GOETHE").active(true).sortOrder(1).build();
        MockExamPack c1 = MockExamPack.builder()
                .id(2L).title("C1").cefrLevel("C1").examFormat("GOETHE").active(false).sortOrder(2).build();
        when(packRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(b1, c1));
        examCountsReturn(Map.of("B1:GOETHE", 3)); // C1 has no exams → 0

        List<MockExamPackAdminDto> packs = service.list();

        assertThat(packs).hasSize(2);
        assertThat(packs.get(0).examCount()).isEqualTo(3);
        assertThat(packs.get(1).examCount()).isZero();  // empty pack surfaced to curator
        assertThat(packs.get(1).active()).isFalse();
    }
}
