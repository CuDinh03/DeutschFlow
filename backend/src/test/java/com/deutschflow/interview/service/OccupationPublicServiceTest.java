package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDetailDto.SampleQuestion;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static com.deutschflow.interview.entity.OccupationContentStatus.AI_GENERATED;
import static com.deutschflow.interview.entity.OccupationContentStatus.APPROVED;
import static com.deutschflow.interview.entity.OccupationContentStatus.REJECTED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OccupationPublicServiceTest {

    @Mock
    private OccupationCatalogService catalogService;
    @Mock
    private OccupationQuestionRepository questionRepository;
    @Mock
    private OccupationTermRepository termRepository;

    @InjectMocks
    private OccupationPublicService service;

    private static final List<SampleQuestion> BANK = List.of(
            new SampleQuestion("INTRO", "Bitte stellen Sie sich kurz vor.", "Mời bạn giới thiệu ngắn.",
                    "Please introduce yourself briefly.", "BANK"),
            new SampleQuestion("HARD_SKILLS", "Welche Verantwortung hatten Sie zuletzt?", null, null, "BANK"),
            new SampleQuestion("HARD_SKILLS", "Welche Werkzeuge nutzen Sie?", null, null, "BANK"));

    private static OccupationDetailDto base(String code, String questionSet) {
        OccupationDto o = new OccupationDto(code, code + " de", code + " en", code + " vi", "bau", List.of(), questionSet);
        return new OccupationDetailDto(o, "BRANDT", code + " de", BANK, OccupationDto.CURATED.equals(questionSet),
                List.of(), List.of());
    }

    private static OccupationQuestion q(String id, String text, OccupationContentStatus status) {
        return OccupationQuestion.builder().id(id).occupationCode("maurer").phase("HARD_SKILLS").topicKey("k")
                .questionDe(text).questionVi(text + " (vi)").questionEn(text + " (en)")
                .difficulty("INTERMEDIATE").status(status).build();
    }

    private static OccupationTerm t(String term, OccupationContentStatus status) {
        return OccupationTerm.builder().occupationCode("maurer").termDe(term).meaningEn("en").meaningVi("vi")
                .status(status).build();
    }

    @Test
    void general_withLayer_hidesRejected_putsApprovedFirst_andSamplesFromLayer() {
        when(catalogService.detail("maurer")).thenReturn(Optional.of(base("maurer", OccupationDto.GENERAL)));
        when(questionRepository.findByOccupationCodeOrderByCreatedAtAscIdAsc("maurer")).thenReturn(List.of(
                q("a", "KI-Frage 1", AI_GENERATED), q("b", "Abgelehnt", REJECTED),
                q("c", "Geprüfte Frage", APPROVED), q("d", "KI-Frage 2", AI_GENERATED)));
        when(termRepository.findByOccupationCodeOrderByIdAsc("maurer"))
                .thenReturn(List.of(t("die Kelle", AI_GENERATED), t("der Mörtel", APPROVED), t("falsch", REJECTED)));

        OccupationDetailDto d = service.detail("maurer").orElseThrow();

        assertThat(d.occupationQuestions()).extracting(OccupationDetailDto.LayerQuestion::questionDe)
                .containsExactly("Geprüfte Frage", "KI-Frage 1", "KI-Frage 2");
        assertThat(d.terms()).extracting(OccupationDetailDto.Term::termDe).containsExactly("der Mörtel", "die Kelle");
        assertThat(d.sampleQuestions()).extracting(SampleQuestion::questionDe, SampleQuestion::source).containsExactly(
                org.assertj.core.groups.Tuple.tuple("Bitte stellen Sie sich kurz vor.", "BANK"),
                org.assertj.core.groups.Tuple.tuple("Geprüfte Frage", "APPROVED"),
                org.assertj.core.groups.Tuple.tuple("KI-Frage 1", "AI_GENERATED"));
        // K4: bản dịch đi theo câu, cả ở lớp nghề lẫn câu mẫu lấy từ lớp nghề.
        assertThat(d.occupationQuestions().get(0).questionVi()).isEqualTo("Geprüfte Frage (vi)");
        assertThat(d.sampleQuestions()).extracting(SampleQuestion::questionEn).containsExactly(
                "Please introduce yourself briefly.", "Geprüfte Frage (en)", "KI-Frage 1 (en)");
        // Mới 1 câu đã duyệt → chưa đủ để trang được lập chỉ mục.
        assertThat(d.reviewed()).isFalse();
    }

    @Test
    void general_withThreeApproved_isReviewed() {
        when(catalogService.detail("maurer")).thenReturn(Optional.of(base("maurer", OccupationDto.GENERAL)));
        when(questionRepository.findByOccupationCodeOrderByCreatedAtAscIdAsc("maurer")).thenReturn(List.of(
                q("a", "1", APPROVED), q("b", "2", APPROVED), q("c", "3", APPROVED)));
        when(termRepository.findByOccupationCodeOrderByIdAsc("maurer")).thenReturn(List.of());

        assertThat(service.detail("maurer").orElseThrow().reviewed()).isTrue();
    }

    @Test
    void general_withoutLayerYet_keepsBankSamples_notReviewed() {
        when(catalogService.detail("maurer")).thenReturn(Optional.of(base("maurer", OccupationDto.GENERAL)));
        when(questionRepository.findByOccupationCodeOrderByCreatedAtAscIdAsc("maurer")).thenReturn(List.of());
        when(termRepository.findByOccupationCodeOrderByIdAsc("maurer")).thenReturn(List.of());

        OccupationDetailDto d = service.detail("maurer").orElseThrow();

        assertThat(d.sampleQuestions()).isEqualTo(BANK);
        assertThat(d.occupationQuestions()).isEmpty();
        assertThat(d.reviewed()).isFalse();
    }

    @Test
    void curated_isReviewed_andKeepsBankSamples() {
        when(catalogService.detail("kellner")).thenReturn(Optional.of(base("kellner", OccupationDto.CURATED)));
        when(questionRepository.findByOccupationCodeOrderByCreatedAtAscIdAsc("kellner")).thenReturn(List.of());
        when(termRepository.findByOccupationCodeOrderByIdAsc("kellner")).thenReturn(List.of());

        OccupationDetailDto d = service.detail("kellner").orElseThrow();

        assertThat(d.reviewed()).isTrue();
        assertThat(d.sampleQuestions()).isEqualTo(BANK);
    }

    @Test
    void unknownCode_isEmpty_withoutTouchingLayerTables() {
        when(catalogService.detail("astronaut")).thenReturn(Optional.empty());

        assertThat(service.detail("astronaut")).isEmpty();
        verifyNoInteractions(questionRepository, termRepository);
    }
}
