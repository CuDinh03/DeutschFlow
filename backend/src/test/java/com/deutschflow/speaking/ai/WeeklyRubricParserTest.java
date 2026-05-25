package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.dto.WeeklySpeakingDtos;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WeeklyRubricParserTest {

    private final WeeklyRubricParser parser = new WeeklyRubricParser(new ObjectMapper());

    private static final String VALID_JSON = """
            {
              "task_completion": {
                "score_1_to_5": 4,
                "covered_mandatory_indices": [0, 2],
                "missing_mandatory_indices": [1],
                "off_topic": false,
                "ambiguous": false
              },
              "fluency": {
                "subjective_notes_de": "Relativ flüssig.",
                "filler_approx_count": 2,
                "wpm_approx": null,
                "confidence_label": "TEXT_ONLY_PROXY"
              },
              "lexis": {
                "richness_notes_de": ["passend"],
                "replacements_suggested_de_vi": [
                  { "from_de": "machen", "to_de_suggestion": "erledigen", "note_vi": "trang trọng hơn" }
                ]
              },
              "grammar": {
                "summary_de": "kaum Probleme",
                "errors": [
                  {
                    "error_code": "CASE.PREP_AKK_FUER",
                    "severity": "MINOR",
                    "confidence": 0.7,
                    "wrong_span": "für Morgen",
                    "corrected_span": "am Morgen",
                    "rule_vi_short": " Zeit vs Ziel mit für"
                  }
                ]
              },
              "feedback_vi_summary": "Tóm tắt tốt.",
              "disclaimer_vi": "Chỉ ước lượng từ transcript."
            }
            """;

    @Test
    void parseValidated_mapsTreeAndCanonicializes() {
        WeeklyRubricParser.ParsedWeeklyRubric out = parser.parseValidated(VALID_JSON);
        WeeklySpeakingDtos.WeeklyRubricView v = out.view();
        assertThat(v.task_completion().score_1_to_5()).isEqualTo(4);
        assertThat(v.task_completion().covered_mandatory_indices()).containsExactly(0, 2);
        assertThat(v.fluency().confidence_label()).isEqualTo("TEXT_ONLY_PROXY");
        assertThat(v.lexis().replacements_suggested_de_vi()).hasSize(1);
        assertThat(v.grammar().errors()).hasSize(1);
        assertThat(v.grammar().errors().get(0).error_code()).isEqualTo("CASE.PREP_AKK_FUER");

        assertThat(out.validatedJsonCanonical()).contains("\"task_completion\"");
    }

    @Test
    void parseValidated_stripsJsonFence() {
        String fenced = "```json\n" + VALID_JSON + "\n```";
        assertThat(parser.parseValidated(fenced).view().task_completion().score_1_to_5()).isEqualTo(4);
    }

    @Test
    void parseValidated_rejects_invalidGrammarCode() {
        String invalid = VALID_JSON.replace("CASE.PREP_AKK_FUER", "UNKNOWN.CODE");
        WeeklyRubricParser.ParsedWeeklyRubric out = parser.parseValidated(invalid);
        assertThat(out.view().grammar().errors()).isEmpty();
    }

    @Test
    void parseValidated_rejectsMissingBlock() {
        assertThatThrownBy(() -> parser.parseValidated("{}"))
                .hasMessageContaining("task_completion");
    }
}
