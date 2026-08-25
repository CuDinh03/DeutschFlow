package com.deutschflow.examspeaking.golden;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.examspeaking.entity.SpeakingExamGoldenRating;
import com.deutschflow.examspeaking.entity.SpeakingExamResult;
import com.deutschflow.examspeaking.repository.SpeakingExamGoldenRatingRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamResultRepository;
import com.deutschflow.examspeaking.repository.SpeakingExamTurnRepository;
import com.deutschflow.examspeaking.scoring.RubricScorer;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** G.1: điểm giám khảo NGƯỜI phải đi qua CÙNG RubricScorer với máy; thống kê đồng thuận đúng số. */
class ExamGoldenServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExamGoldenService service = new ExamGoldenService(
            mock(SpeakingExamResultRepository.class), mock(SpeakingExamTurnRepository.class),
            mock(SpeakingExamGoldenRatingRepository.class), mock(com.deutschflow.examspeaking.api.ExamBlueprintCatalog.class),
            new RubricScorer(), null, null, mock(UserRepository.class), objectMapper);

    static RubricDefinition goetheB1() {
        Map<String, Double> fr = Map.of("A", 1.0, "B", 0.75, "C", 0.5, "D", 0.25, "E", 0.0);
        return new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.A_E, fr, 100, 60.0, null, null, null,
                true, true, List.of(
                new RubricDefinition.RubricPart(1, List.of(
                        new RubricDefinition.RubricCriterion("ERFUELLUNG", "", 8, Map.of()),
                        new RubricDefinition.RubricCriterion("WORTSCHATZ", "", 8, Map.of())), List.of())),
                List.of(new RubricDefinition.RubricCriterion("AUSSPRACHE", "", 16, Map.of())), null, null);
    }

    static SpeakingExamGoldenRating rating(int teil, String code, String band) {
        return SpeakingExamGoldenRating.builder().sessionId(1L).raterUserId(9L)
                .teilNo(teil).criterionCode(code).band(band).build();
    }

    private SpeakingExamResult resultWithSheet(Ergebnisbogen sheet) {
        SpeakingExamResult r = new SpeakingExamResult();
        r.setScoreSheetJson(objectMapper.convertValue(sheet, new TypeReference<Map<String, Object>>() {}));
        return r;
    }

    private Ergebnisbogen machineSheet() {
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B1", 1);
        return new Ergebnisbogen(ref,
                List.of(new Ergebnisbogen.PartResult(1, List.of(
                        new Ergebnisbogen.CriterionResult("ERFUELLUNG", "", "A", 8, 8, true, "high", List.of()),
                        new Ergebnisbogen.CriterionResult("WORTSCHATZ", "", "B", 6, 8, true, "high", List.of())),
                        14, 16, false, null)),
                List.of(new Ergebnisbogen.CriterionResult("AUSSPRACHE", "", "C", 8, 16, true, "low", List.of())),
                22, 22, 22, 32, 100, false, "", List.of(), List.of(), 1);
    }

    @Test
    @DisplayName("scoreHuman: band tay → điểm qua đúng bảng quy điểm của rubric (A=1.0, B=0.75…)")
    void scoreHumanUsesSameRubricScorer() {
        RubricDefinition rubric = goetheB1();
        SpeakingExamResult result = resultWithSheet(machineSheet());

        Ergebnisbogen human = service.scoreHuman(result, rubric, List.of(
                rating(1, "ERFUELLUNG", "B"),   // 8 × 0.75 = 6
                rating(1, "WORTSCHATZ", "A"),   // 8 × 1.0  = 8
                rating(0, "AUSSPRACHE", "C"))); // 16 × 0.5 = 8

        assertThat(human.total()).isEqualTo(22.0);
        assertThat(human.maxPoints()).isEqualTo(32.0);
        // Rubric fixture chỉ 32/100 điểm → quy đổi tỉ lệ: 22×100/32 = 68.75 ≥ passMin 60 → đỗ.
        assertThat(human.passed()).isTrue();
    }

    @Test
    @DisplayName("bandAgreement: exact/±1 đếm đúng trên các cặp cả hai bên đều chấm")
    void bandAgreementCounts() {
        Map<String, String> machine = Map.of("T1:ERFUELLUNG", "A", "T1:WORTSCHATZ", "B", "G:AUSSPRACHE", "C");
        Map<String, String> human = Map.of("T1:ERFUELLUNG", "B", "T1:WORTSCHATZ", "B", "G:AUSSPRACHE", "E");

        GoldenView.AgreementStats s = ExamGoldenService.bandAgreement(machine, human, RubricDefinition.BandScale.A_E);

        assertThat(s.pairs()).isEqualTo(3);
        assertThat(s.exact()).isEqualTo(1);   // WORTSCHATZ B=B
        assertThat(s.within1()).isEqualTo(2); // + ERFUELLUNG A↔B; AUSSPRACHE C↔E lệch 2 → loại
    }

    @Test
    @DisplayName("bandsByKey: chỉ lấy tiêu chí đã chấm, khoá T{n}: / G:")
    void bandsByKeyExtractsScoredOnly() {
        Map<String, String> keys = ExamGoldenService.bandsByKey(machineSheet());
        assertThat(keys).containsEntry("T1:ERFUELLUNG", "A")
                .containsEntry("T1:WORTSCHATZ", "B")
                .containsEntry("G:AUSSPRACHE", "C")
                .hasSize(3);
    }

    @Test
    @DisplayName("validKeys + structure: đủ criteria/items/global cho FE render phiếu")
    void validKeysAndStructure() {
        RubricDefinition rubric = goetheB1();
        assertThat(ExamGoldenService.validKeys(rubric))
                .containsExactlyInAnyOrder("T1:ERFUELLUNG", "T1:WORTSCHATZ", "G:AUSSPRACHE");
        GoldenView.SheetStructure st = ExamGoldenService.structure(rubric);
        assertThat(st.scale()).isEqualTo("A_E");
        assertThat(st.bands()).containsExactly("A", "B", "C", "D", "E");
        assertThat(st.parts()).hasSize(1);
        assertThat(st.global()).hasSize(1);
    }
}
