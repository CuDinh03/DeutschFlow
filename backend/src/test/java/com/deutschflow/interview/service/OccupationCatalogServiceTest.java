package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.entity.Occupation;
import com.deutschflow.interview.repository.OccupationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OccupationCatalogServiceTest {

    @Mock
    private OccupationRepository repository;

    private static Occupation occ(String code, String de, String persona, String legacyPos, String aliases) {
        return Occupation.builder()
                .code(code).nameDe(de).nameEn(code + " en").nameVi(code + " vi")
                .workplace("gastro").aliases(aliases)
                .legacyPersonaCode(persona).legacyPositionDe(legacyPos)
                .build();
    }

    private static final Occupation KELLNER = occ("kellner", "Kellner/in", "NIKLAS", "Kellner/in", "kellner, bồi bàn ,kellner,");
    private static final Occupation PFLEGE = occ("pflegefachkraft", "Pflegefachmann/-frau", null, null, "y tá,điều dưỡng viên");

    @Test
    void list_marksCuratedAndGeneral_andSplitsAliases() {
        when(repository.findByActiveTrueOrderBySortRankAscCodeAsc()).thenReturn(List.of(KELLNER, PFLEGE));

        List<OccupationDto> list = new OccupationCatalogService(repository).list();

        assertThat(list).extracting(OccupationDto::code).containsExactly("kellner", "pflegefachkraft");
        assertThat(list.get(0).questionSet()).isEqualTo(OccupationDto.CURATED);
        assertThat(list.get(0).aliases()).containsExactly("kellner", "bồi bàn");
        // Chưa có bộ câu hỏi riêng → nói thật là bộ chung (trang chủ vẫn ghi "Sắp có").
        assertThat(list.get(1).questionSet()).isEqualTo(OccupationDto.GENERAL);
    }

    @Test
    void detail_curated_usesPersonaAndLegacyPosition_andBankQuestionsVerbatim() {
        when(repository.findByActiveTrueOrderBySortRankAscCodeAsc()).thenReturn(List.of(KELLNER, PFLEGE));

        Optional<OccupationDetailDto> detail = new OccupationCatalogService(repository).detail("Kellner");

        assertThat(detail).isPresent();
        assertThat(detail.get().personaCode()).isEqualTo("NIKLAS");
        assertThat(detail.get().interviewPosition()).isEqualTo("Kellner/in");
        assertThat(detail.get().sampleQuestions()).extracting(OccupationDetailDto.SampleQuestion::phase)
                .containsExactly("INTRO", "HARD_SKILLS", "HARD_SKILLS");
        // Cùng câu với frontend/src/data/interviewSamples.ts (đối chiếu bằng interviewSamplesParity).
        assertThat(detail.get().sampleQuestions().get(1).questionDe())
                .isEqualTo("Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für Kellner/in.");
    }

    @Test
    void detail_general_usesDefaultPersonaAndOccupationName() {
        when(repository.findByActiveTrueOrderBySortRankAscCodeAsc()).thenReturn(List.of(KELLNER, PFLEGE));

        OccupationDetailDto detail = new OccupationCatalogService(repository).detail("pflegefachkraft").orElseThrow();

        assertThat(detail.personaCode()).isEqualTo("DEFAULT");
        assertThat(detail.interviewPosition()).isEqualTo("Pflegefachmann/-frau");
        assertThat(detail.sampleQuestions().get(0).questionDe()).contains("relevante Erfahrung für Pflegefachmann/-frau");
        assertThat(detail.sampleQuestions().get(1).questionDe())
                .isEqualTo("Welche Verantwortung hatten Sie zuletzt für Pflegefachmann/-frau — messbares Ergebnis?");
    }

    @Test
    void detail_unknownOrBlankCode_isEmpty() {
        when(repository.findByActiveTrueOrderBySortRankAscCodeAsc()).thenReturn(List.of(KELLNER));
        OccupationCatalogService service = new OccupationCatalogService(repository);

        assertThat(service.detail("astronaut")).isEmpty();
        assertThat(service.detail(" ")).isEmpty();
        assertThat(service.detail(null)).isEmpty();
    }

    @Test
    void unknownLegacyPersona_fallsBackToGeneral() {
        Occupation broken = occ("ghost", "Geist/in", "NOT_A_PERSONA", "Geist/in", null);
        when(repository.findByActiveTrueOrderBySortRankAscCodeAsc()).thenReturn(List.of(broken));

        OccupationCatalogService service = new OccupationCatalogService(repository);

        assertThat(service.list().get(0).questionSet()).isEqualTo(OccupationDto.GENERAL);
        assertThat(service.detail("ghost").orElseThrow().personaCode()).isEqualTo("DEFAULT");
    }

    @Test
    void snapshot_isReusedWithinTtl_andReloadedAfter() {
        when(repository.findByActiveTrueOrderBySortRankAscCodeAsc()).thenReturn(List.of(KELLNER));

        OccupationCatalogService cached = new OccupationCatalogService(repository);
        cached.list();
        cached.detail("kellner");
        cached.list();
        verify(repository, times(1)).findByActiveTrueOrderBySortRankAscCodeAsc();

        OccupationCatalogService expiring = new OccupationCatalogService(repository, -1);
        expiring.list();
        expiring.list();
        verify(repository, times(3)).findByActiveTrueOrderBySortRankAscCodeAsc();
    }
}
