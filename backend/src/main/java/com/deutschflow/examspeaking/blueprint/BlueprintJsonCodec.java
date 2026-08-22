package com.deutschflow.examspeaking.blueprint;

import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.PartFlow;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Chuyển parts_json / rubric_json (JSONB) thành record bất biến. Khoan dung với field thiếu (default),
 * nghiêm với field sai kiểu (ném IllegalArgumentException để seed lỗi lộ ngay lúc boot/test).
 */
@Component
@RequiredArgsConstructor
public class BlueprintJsonCodec {

    private final ObjectMapper objectMapper;

    public int parsePrepSec(Map<String, Object> partsJson) {
        JsonNode root = objectMapper.valueToTree(partsJson);
        return root.path("prepSec").asInt(0);
    }

    public List<BlueprintPart> parseParts(Map<String, Object> partsJson) {
        JsonNode root = objectMapper.valueToTree(partsJson);
        JsonNode parts = root.path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new IllegalArgumentException("parts_json.parts must be a non-empty array");
        }
        List<BlueprintPart> out = new ArrayList<>();
        for (JsonNode p : parts) {
            out.add(new BlueprintPart(
                    p.path("teilNo").asInt(),
                    TaskArchetype.valueOf(p.path("archetype").asText().toUpperCase(Locale.ROOT)),
                    p.path("title").asText(""),
                    p.path("durationSec").asInt(180),
                    PartFlow.valueOf(p.path("flow").asText("DIALOGUE").toUpperCase(Locale.ROOT)),
                    p.path("partnerRole").asText("NONE"),
                    p.path("stimulusType").asText("NONE"),
                    p.path("cardsNeeded").asInt(1),
                    p.path("rounds").asInt(1),
                    p.path("maxCandidateTurns").asInt(4)
            ));
        }
        return List.copyOf(out);
    }

    public RubricDefinition parseRubric(Map<String, Object> rubricJson) {
        JsonNode r = objectMapper.valueToTree(rubricJson);
        ExamProvider scheme = ExamProvider.valueOf(r.path("scheme").asText().toUpperCase(Locale.ROOT));
        RubricDefinition.BandScale scale = RubricDefinition.BandScale.valueOf(r.path("scale").asText().toUpperCase(Locale.ROOT));

        Map<String, Double> fractions = new HashMap<>();
        r.path("bandFractions").fields().forEachRemaining(e -> fractions.put(e.getKey(), e.getValue().asDouble()));

        List<RubricDefinition.RubricPart> parts = new ArrayList<>();
        for (JsonNode p : r.path("parts")) {
            parts.add(new RubricDefinition.RubricPart(
                    p.path("teilNo").asInt(),
                    parseCriteria(p.path("criteria")),
                    parseItems(p.path("items"))));
        }
        return new RubricDefinition(
                scheme,
                scale,
                fractions,
                r.path("maxTotal").asDouble(),
                nullableDouble(r.path("passMin")),
                nullableDouble(r.path("speakingOnlyMin")),
                nullableDouble(r.path("rawMax")),
                nullableDouble(r.path("rawMultiplier")),
                r.path("zeroPartIfErfuellungLowest").asBoolean(false),
                r.path("aStarEqualsA").asBoolean(true),
                parts,
                parseCriteria(r.path("global")),
                textOrNull(r.path("approximation")),
                textOrNull(r.path("notes")));
    }

    private List<RubricDefinition.RubricCriterion> parseCriteria(JsonNode arr) {
        List<RubricDefinition.RubricCriterion> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) {
            return out;
        }
        for (JsonNode c : arr) {
            Map<String, Double> bandPoints = new HashMap<>();
            c.path("bandPoints").fields().forEachRemaining(e -> bandPoints.put(e.getKey(), e.getValue().asDouble()));
            out.add(new RubricDefinition.RubricCriterion(
                    c.path("code").asText(), c.path("label").asText(""), c.path("max").asDouble(), bandPoints));
        }
        return out;
    }

    private List<RubricDefinition.RubricItem> parseItems(JsonNode arr) {
        List<RubricDefinition.RubricItem> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) {
            return out;
        }
        for (JsonNode i : arr) {
            out.add(new RubricDefinition.RubricItem(i.path("code").asText(), i.path("label").asText(""), i.path("max").asDouble()));
        }
        return out;
    }

    private static Double nullableDouble(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode() ? null : n.asDouble();
    }

    private static String textOrNull(JsonNode n) {
        return n == null || n.isNull() || n.isMissingNode() ? null : n.asText();
    }
}
