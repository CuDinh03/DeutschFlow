package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.dto.CurriculumItemInput;
import com.deutschflow.organization.dto.ImportCurriculumRequest;
import com.deutschflow.organization.dto.UpdateCurriculumRequest;
import com.deutschflow.organization.entity.OrgCurriculum;
import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.CurriculumItemRepository;
import com.deutschflow.organization.repository.CurriculumLektionRepository;
import com.deutschflow.organization.repository.CurriculumObjectiveRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit các nhánh validate của import/metadata (đường RED); vòng đời đầy đủ nằm ở IT. */
@ExtendWith(MockitoExtension.class)
class OrgCurriculumServiceTest {

    @Mock private OrgCurriculumRepository curriculumRepo;
    @Mock private OrgCurriculumVersionRepository versionRepo;
    @Mock private CurriculumLektionRepository lektionRepo;
    @Mock private CurriculumItemRepository itemRepo;
    @Mock private CurriculumObjectiveRepository objectiveRepo;
    @Mock private ClassCurriculumLinkRepository linkRepo;

    private OrgCurriculumService service;

    private static final Long USER_ID = 1L;
    private static final Long ORG_ID = 5L;

    @BeforeEach
    void setUp() {
        service = new OrgCurriculumService(curriculumRepo, versionRepo, lektionRepo, itemRepo,
                objectiveRepo, linkRepo);
    }

    @Test
    @DisplayName("import: thiếu tên → 400, không ghi gì")
    void import_blankName_rejected() {
        assertThatThrownBy(() -> service.importDraft(USER_ID, ORG_ID,
                new ImportCurriculumRequest("  ", "A1", null, null, List.of())))
                .isInstanceOf(BadRequestException.class);
        verify(curriculumRepo, never()).save(any());
    }

    @Test
    @DisplayName("import: không có Lektion nào → 400")
    void import_emptyLektionen_rejected() {
        assertThatThrownBy(() -> service.importDraft(USER_ID, ORG_ID,
                new ImportCurriculumRequest("Bộ thật", "A1", null, null, List.of())))
                .isInstanceOf(BadRequestException.class);
        verify(curriculumRepo, never()).save(any());
    }

    @Test
    @DisplayName("import: vượt trần 100 Lektion → 400 (không tin dữ liệu ngoài)")
    void import_tooManyLektionen_rejected() {
        List<ImportCurriculumRequest.ImportLektion> many = new ArrayList<>();
        for (int i = 0; i < 101; i++) {
            many.add(new ImportCurriculumRequest.ImportLektion("L" + i, null,
                    List.of(new CurriculumItemInput("x", null, null, null)), null));
        }
        assertThatThrownBy(() -> service.importDraft(USER_ID, ORG_ID,
                new ImportCurriculumRequest("Bộ thật", "A1", null, null, many)))
                .isInstanceOf(BadRequestException.class);
        verify(curriculumRepo, never()).save(any());
    }

    @Test
    @DisplayName("import: Lektion thiếu tiêu đề → 400 kèm vị trí")
    void import_lektionWithoutTitle_rejected() {
        when(curriculumRepo.save(any())).thenAnswer(inv -> {
            OrgCurriculum c = inv.getArgument(0);
            c.setId(9L);
            return c;
        });
        when(versionRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> service.importDraft(USER_ID, ORG_ID,
                new ImportCurriculumRequest("Bộ thật", "A1", null, null,
                        List.of(new ImportCurriculumRequest.ImportLektion("  ", null, null, null)))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("thứ 1");
    }

    @Test
    @DisplayName("updateMeta: CEFR không hợp lệ → 400")
    void updateMeta_invalidCefr_rejected() {
        when(curriculumRepo.findByIdAndOrgId(9L, ORG_ID))
                .thenReturn(Optional.of(OrgCurriculum.builder().id(9L).orgId(ORG_ID).name("Bộ").build()));

        assertThatThrownBy(() -> service.updateMeta(ORG_ID, 9L,
                new UpdateCurriculumRequest(null, "Z9", null)))
                .isInstanceOf(BadRequestException.class);
        verify(curriculumRepo, never()).save(any());
    }
}
