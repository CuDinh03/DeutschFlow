package com.deutschflow.examspeaking.blueprint;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class BlueprintJsonCodecTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final BlueprintJsonCodec codec = new BlueprintJsonCodec(mapper);

    @Test
    void parsesPartsAndTelcRubricWithBandPoints() throws Exception {
        Map<String, Object> parts = mapper.readValue("""
                {"prepSec":1200,"parts":[{"teilNo":1,"archetype":"TOPIC_EXCHANGE","title":"Kontaktaufnahme","durationSec":210,
                 "flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"CONTACT_CARD","cardsNeeded":1,"maxCandidateTurns":6}]}
                """, new TypeReference<Map<String, Object>>() {});
        assertThat(codec.parsePrepSec(parts)).isEqualTo(1200);
        List<BlueprintPart> p = codec.parseParts(parts);
        assertThat(p).hasSize(1);
        assertThat(p.get(0).archetype()).isEqualTo(TaskArchetype.TOPIC_EXCHANGE);
        assertThat(p.get(0).flow()).isEqualTo(PartFlow.DIALOGUE);
        assertThat(p.get(0).hasPartner()).isTrue();

        Map<String, Object> rubric = mapper.readValue("""
                {"scheme":"TELC","scale":"A_D","maxTotal":75,"passMin":null,"speakingOnlyMin":45,
                 "parts":[{"teilNo":1,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}}]}],
                 "global":[],"approximation":"nội suy"}
                """, new TypeReference<Map<String, Object>>() {});
        RubricDefinition r = codec.parseRubric(rubric);
        assertThat(r.scale()).isEqualTo(RubricDefinition.BandScale.A_D);
        assertThat(r.speakingOnlyMin()).isEqualTo(45.0);
        assertThat(r.passMin()).isNull();
        assertThat(r.parts().get(0).criteria().get(0).bandPoints()).containsEntry("B", 3.0);
        assertThat(r.approximation()).isEqualTo("nội suy");
        assertThat(r.lowestBand()).isEqualTo("D");
    }
}
