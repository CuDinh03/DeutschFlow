package com.deutschflow.contract;

import com.deutschflow.curriculum.dto.RoadmapMetaDto;
import com.deutschflow.curriculum.dto.RoadmapSetupResultDto;
import com.deutschflow.curriculum.dto.RoadmapSetupStateDto;
import com.deutschflow.notification.dto.AnnounceResultDto;
import com.deutschflow.payment.dto.SepayWebhookResponse;
import com.deutschflow.speaking.dto.TranscribeDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the byte-level JSON contract of the Round-10 residual DTOs (transcribe, roadmap meta/setup,
 * sepay webhook, teacher announce): each replaced a raw {@code Map} response and MUST stay identical.
 */
class Round10ResidualDtoSerializationTest {

    private final ObjectMapper omd = new ObjectMapper().disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private void assertSameJson(Object dto, Map<String, Object> legacyMap) throws Exception {
        JsonNode fromDto = omd.readTree(omd.writeValueAsString(dto));
        JsonNode fromMap = omd.readTree(omd.writeValueAsString(legacyMap));
        assertThat(fromDto).isEqualTo(fromMap);
    }

    @Test
    @DisplayName("TranscribeDto == legacy Map.of(transcript)")
    void transcribeEqualsLegacyMap() throws Exception {
        assertSameJson(new TranscribeDto("Hallo, wie geht es dir?"),
                Map.of("transcript", "Hallo, wie geht es dir?"));
    }

    @Test
    @DisplayName("RoadmapMetaDto.from == the exact getRoadmapMeta map")
    void roadmapMetaEqualsLegacyMap() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("roadmapVersion", "PERSONALIZED_CEFR_V1");
        legacy.put("roadmapType", "PERSONALIZED");
        legacy.put("entryNodeCode", "A1_START");
        legacy.put("currentLevel", "A1");
        legacy.put("targetLevel", "B1");
        legacy.put("currentNodeCode", "A1_LESEN_1");
        legacy.put("completedNodes", 12L);
        legacy.put("totalNodes", 80L);
        legacy.put("progressPercent", 15L);
        legacy.put("progressModel", "NODE_COMPLETION");
        assertSameJson(RoadmapMetaDto.from(legacy), legacy);
    }

    @Test
    @DisplayName("RoadmapSetupResultDto == legacy POST /setup map")
    void roadmapSetupResultEqualsLegacyMap() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("saved", true);
        legacy.put("roadmapVersion", "PERSONALIZED_CEFR_V1");
        legacy.put("roadmapType", "PERSONALIZED");
        legacy.put("currentLevel", "A1");
        legacy.put("targetLevel", "B1");
        legacy.put("nextRoute", "/roadmap");
        assertSameJson(new RoadmapSetupResultDto(true, "PERSONALIZED_CEFR_V1", "PERSONALIZED", "A1", "B1", "/roadmap"),
                legacy);
    }

    @Test
    @DisplayName("RoadmapSetupStateDto.exists (all values) == legacy exists-true map")
    void roadmapSetupExistsEqualsLegacyMap() throws Exception {
        Map<String, Object> legacy = new LinkedHashMap<>();
        legacy.put("exists", true);
        legacy.put("goalType", "EXAM");
        legacy.put("currentLevel", "A1");
        legacy.put("targetLevel", "B1");
        legacy.put("sessionsPerWeek", 3);
        legacy.put("minutesPerSession", 30);
        legacy.put("learningSpeed", "NORMAL");
        legacy.put("industry", "IT");
        legacy.put("examType", "GOETHE");
        legacy.put("interestsJson", "[\"travel\"]");
        assertSameJson(RoadmapSetupStateDto.exists("EXAM", "A1", "B1", 3, 30, "NORMAL", "IT", "GOETHE", "[\"travel\"]"),
                legacy);
    }

    @Test
    @DisplayName("RoadmapSetupStateDto.notExists == {exists:false} (only)")
    void roadmapSetupNotExistsEqualsLegacyMap() throws Exception {
        assertSameJson(RoadmapSetupStateDto.notExists(), Map.of("exists", false));
    }

    @Test
    @DisplayName("RoadmapSetupStateDto.exists omits null industry/examType (deliberate, FE reads only `exists`)")
    void roadmapSetupExistsOmitsNullOptionalFields() throws Exception {
        var json = omd.writeValueAsString(
                RoadmapSetupStateDto.exists("EXAM", "A1", "B1", 3, 30, "NORMAL", null, null, "[]"));
        assertThat(json).contains("\"exists\":true").doesNotContain("industry").doesNotContain("examType");
    }

    @Test
    @DisplayName("SepayWebhookResponse == legacy Map.of(success)")
    void sepayEqualsLegacyMap() throws Exception {
        assertSameJson(new SepayWebhookResponse(true), Map.of("success", true));
        assertSameJson(new SepayWebhookResponse(false), Map.of("success", false));
    }

    @Test
    @DisplayName("AnnounceResultDto == legacy Map.of(recipientCount, status)")
    void announceEqualsLegacyMap() throws Exception {
        assertSameJson(new AnnounceResultDto(5, "sent"), Map.of("recipientCount", 5, "status", "sent"));
    }
}
