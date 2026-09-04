package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ScoreAggregatorTest {

    private final RubricScorer scorer = new RubricScorer();
    private final ScoreAggregator aggregator = new ScoreAggregator();
    private final RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B1", 1);

    @Test
    @DisplayName("2 giám khảo lệch 1 band: điểm trung bình, band hiển thị = band thấp hơn, khoảng = [min,max]")
    void twoPassesAverageAndStrictBand() {
        RubricDefinition r = RubricScorerTest.goetheB1();
        Ergebnisbogen p1 = scorer.score(ref, r, RubricScorerTest.uniform(r, "A"));
        Ergebnisbogen p2 = scorer.score(ref, r, RubricScorerTest.uniform(r, "B"));
        assertThat(aggregator.divergentCriteria(r, List.of(p1, p2))).isEmpty();
        Ergebnisbogen c = aggregator.combine(ref, r, List.of(p1, p2));
        assertThat(c.total()).isEqualTo(87.5);
        assertThat(c.totalLow()).isEqualTo(75.0);
        assertThat(c.totalHigh()).isEqualTo(100.0);
        assertThat(c.passes()).isEqualTo(2);
        assertThat(c.parts().get(0).criteria().get(0).band()).isEqualTo("B");
        assertThat(c.parts().get(0).criteria().get(0).points()).isEqualTo(7.0); // (8+6)/2
    }

    @Test
    @DisplayName("Lệch > 1 band ở bất kỳ tiêu chí nào → báo cần pass trọng tài")
    void divergenceDetected() {
        RubricDefinition r = RubricScorerTest.goetheB1();
        PassAssessment a = RubricScorerTest.uniform(r, "A");
        Map<Integer, PassAssessment.PartAssessment> parts = new HashMap<>(a.parts());
        Map<String, PassAssessment.CriterionAssessment> t3 = new HashMap<>(parts.get(3).criteria());
        t3.put("ERFUELLUNG", RubricScorerTest.band("D"));
        parts.put(3, new PassAssessment.PartAssessment(3, Map.of(), t3));
        PassAssessment b = new PassAssessment(parts, a.global(), List.of(), List.of());
        List<Ergebnisbogen> passes = List.of(scorer.score(ref, r, a), scorer.score(ref, r, b));
        assertThat(aggregator.divergentCriteria(r, passes)).containsExactly("T3:ERFUELLUNG");
    }
}
