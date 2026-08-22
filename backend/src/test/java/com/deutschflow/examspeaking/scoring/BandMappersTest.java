package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.metrics.FluencyMetrics;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BandMappersTest {

    @Test
    void errorDensityDecidesAccuracyBand() {
        ErrorDensityBandMapper m = new ErrorDensityBandMapper();
        List<Ergebnisbogen.ErrorItem> errs = List.of(
                new Ergebnisbogen.ErrorItem("CASE.PREP_DAT_MIT", "mit der Bus", "mit dem Bus", "MAJOR", 1),
                new Ergebnisbogen.ErrorItem("ARTICLE.GENDER_WRONG_DER_DIE_DAS", "der Haus", "das Haus", "MINOR", 1));
        double density = m.densityPer100(errs, 50); // 1.5 lỗi / 50 từ = 3 / 100
        assertThat(density).isEqualTo(3.0);
        assertThat(m.band(RubricDefinition.BandScale.A_E, "A1", density)).isEqualTo("A");
        assertThat(m.band(RubricDefinition.BandScale.A_E, "B2", density)).isEqualTo("B");
        assertThat(m.band(RubricDefinition.BandScale.A_D, "B2", 20)).isEqualTo("D");
        assertThat(m.band(RubricDefinition.BandScale.A_E, "B1", 20)).isEqualTo("E");
    }

    @Test
    void fluencyBandByLevelAndPauses() {
        FluencyBandMapper f = new FluencyBandMapper();
        FluencyMetrics fast = new FluencyMetrics(120, 60, 50, 120, 144, 3, 0, 0.1, 8, 0, -0.2);
        assertThat(f.band(RubricDefinition.BandScale.A_E, "A1", fast)).isEqualTo("A");
        assertThat(f.band(RubricDefinition.BandScale.A_E, "B2", fast)).isEqualTo("A");
        FluencyMetrics halting = new FluencyMetrics(40, 60, 20, 40, 120, 12, 8, 0.6, 2, 3, -0.5);
        assertThat(f.band(RubricDefinition.BandScale.A_E, "A1", halting)).isEqualTo("D"); // C theo wpm, -1 vì ngắt dài
        assertThat(f.band(RubricDefinition.BandScale.A_D, "B1", halting)).isEqualTo("D");
    }

    @Test
    void intelligibilityFromLogprob() {
        IntelligibilityBandMapper i = new IntelligibilityBandMapper();
        assertThat(i.band(RubricDefinition.BandScale.A_E, -0.1)).isEqualTo("A");
        assertThat(i.band(RubricDefinition.BandScale.A_E, -0.5)).isEqualTo("C");
        assertThat(i.band(RubricDefinition.BandScale.A_D, -1.2)).isEqualTo("D");
    }
}
