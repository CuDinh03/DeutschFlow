package com.deutschflow.examspeaking.scoring;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.examspeaking.api.ExamBlueprintCatalog;
import com.deutschflow.examspeaking.api.ExamGradingService;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen.Msg;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import com.deutschflow.examspeaking.api.model.Utterance;
import com.deutschflow.examspeaking.config.ExamSpeakingProperties;
import com.deutschflow.examspeaking.metrics.FluencyMetricExtractor;
import com.deutschflow.examspeaking.metrics.FluencyMetrics;
import com.deutschflow.examspeaking.metrics.LexicalProfile;
import com.deutschflow.examspeaking.metrics.LexicalProfiler;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Pipeline chấm mock (kế hoạch 2.4):
 * [0] metric extractor (code) → [1][2][3] LLM trích bằng chứng/lỗi/band theo tiêu chí của hệ → code quyết điểm
 * (mật độ lỗi → band độ đúng; số liệu → Flüssigkeit; logprob → Aussprache ước lượng) → [6] 2 pass độc lập,
 * lệch >1 band → pass trọng tài → gộp thành Ergebnisbogen có khoảng tin cậy.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DefaultExamGradingService implements ExamGradingService {

    static final String FEATURE = "EXAM_SPEAKING_GRADING";
    static final Set<String> ACCURACY_CRITERIA = Set.of("STRUKTUREN", "FORMALE_RICHTIGKEIT");
    static final Set<String> FLUENCY_BLEND_CRITERIA = Set.of("KOHAERENZ_FLUESSIGKEIT", "AUFGABENBEWAELTIGUNG");
    static final Set<String> PRONUNCIATION_CRITERIA = Set.of("AUSSPRACHE", "AUSSPRACHE_INTONATION");
    private static final double[] PASS_TEMPERATURES = {0.2, 0.35, 0.3};

    private final ExamBlueprintCatalog catalog;
    private final OpenAiChatClient chatClient;
    private final LlmTierResolver tierResolver;
    private final ObjectMapper objectMapper;
    private final FluencyMetricExtractor fluencyExtractor;
    private final LexicalProfiler lexicalProfiler;
    private final FluencyBandMapper fluencyBandMapper;
    private final ErrorDensityBandMapper errorDensityBandMapper;
    private final IntelligibilityBandMapper intelligibilityBandMapper;
    private final GradingPromptBuilder promptBuilder;
    private final RubricScorer rubricScorer;
    private final ScoreAggregator aggregator;
    private final AiUsageLedgerService ledger;
    private final ExamSpeakingProperties props;

    @Override
    public Ergebnisbogen grade(long userId, ParticipantBundle bundle, RubricRef ref) {
        ExamBlueprint bp = catalog.find(ref.provider(), ref.level())
                .orElseThrow(() -> new IllegalArgumentException("Blueprint not found: " + ref.provider() + " " + ref.level()));
        RubricDefinition rubric = bp.rubric();

        List<Ergebnisbogen> passes = new ArrayList<>();
        int n = props.passes();
        for (int i = 0; i < n; i++) {
            passes.add(rubricScorer.score(ref, rubric, assessOnePass(userId, bundle, ref, rubric, PASS_TEMPERATURES[i])));
        }
        if (n == 2 && !aggregator.divergentCriteria(rubric, passes).isEmpty()) {
            log.info("[ExamGrading] divergent criteria → arbiter pass (user={})", userId);
            passes.add(rubricScorer.score(ref, rubric, assessOnePass(userId, bundle, ref, rubric, PASS_TEMPERATURES[2])));
        }
        Ergebnisbogen combined = aggregator.combine(ref, rubric, passes);
        long scored = combined.parts().stream().flatMap(p -> p.criteria().stream()).filter(Ergebnisbogen.CriterionResult::scored).count()
                + combined.global().stream().filter(Ergebnisbogen.CriterionResult::scored).count();
        if (scored == 0) {
            throw new IllegalStateException("Grading produced no scored criteria (LLM output unusable)");
        }
        return combined;
    }

    // ── một lượt "giám khảo" ─────────────────────────────────────────────────────────────────

    PassAssessment assessOnePass(long userId, ParticipantBundle bundle, RubricRef ref, RubricDefinition rubric,
                                 double temperature) {
        Map<Integer, PassAssessment.PartAssessment> parts = new HashMap<>();
        List<Ergebnisbogen.ErrorItem> errors = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        List<Msg> noteMsgs = new ArrayList<>();
        List<Utterance> allCandidate = new ArrayList<>();

        for (RubricDefinition.RubricPart rp : rubric.parts()) {
            Optional<ParticipantBundle.PartTranscript> ptOpt = bundle.parts().stream()
                    .filter(p -> p.teilNo() == rp.teilNo()).findFirst();
            if (ptOpt.isEmpty() || ptOpt.get().candidate().isEmpty()) {
                // N1c-1: Teil không nói = 0 điểm CÓ CHẤM (vẫn nằm trong mẫu số) — khác tiêu chí thiếu tín hiệu.
                notes.add("Teil " + rp.teilNo() + ": thí sinh không nói gì → 0 điểm cho Teil này.");
                noteMsgs.add(Msg.of("silentTeil", "teil", rp.teilNo()));
                parts.put(rp.teilNo(), new PassAssessment.PartAssessment(rp.teilNo(), Map.of(), Map.of(), true, null));
                continue;
            }
            ParticipantBundle.PartTranscript pt = ptOpt.get();
            allCandidate.addAll(pt.candidate());
            Optional<JsonNode> json = callJson(userId, promptBuilder.partPrompt(ref.provider(), ref.level(), rubric, rp, pt,
                    bundle.partnerKind()), temperature);
            if (json.isEmpty()) {
                notes.add("Teil " + rp.teilNo() + ": AI không trả kết quả hợp lệ → tiêu chí của Teil chưa chấm được.");
                noteMsgs.add(Msg.of("llmInvalidTeil", "teil", rp.teilNo()));
                parts.put(rp.teilNo(), new PassAssessment.PartAssessment(rp.teilNo(), Map.of(), Map.of()));
                continue;
            }
            List<Ergebnisbogen.ErrorItem> partErrors = parseErrors(json.get(), rp.teilNo());
            errors.addAll(partErrors);
            parts.put(rp.teilNo(), buildPartAssessment(rubric, rp, pt, json.get(), partErrors, ref.level()));
        }

        Map<String, PassAssessment.CriterionAssessment> global = new HashMap<>();
        Optional<FluencyMetrics> sessionFluency = fluencyExtractor.extract(allCandidate);
        List<RubricDefinition.RubricCriterion> llmGlobal = new ArrayList<>();
        for (RubricDefinition.RubricCriterion c : rubric.global()) {
            if (PRONUNCIATION_CRITERIA.contains(c.code())) {
                global.put(c.code(), pronunciation(rubric, sessionFluency));
            } else {
                llmGlobal.add(c);
            }
        }
        if (!llmGlobal.isEmpty() && !allCandidate.isEmpty()) {
            Optional<JsonNode> json = callJson(userId, promptBuilder.globalPrompt(ref.provider(), ref.level(), rubric, llmGlobal, bundle),
                    temperature);
            int wordCount = lexicalProfiler.profile(allCandidate, ref.level()).tokenCount();
            for (RubricDefinition.RubricCriterion c : llmGlobal) {
                PassAssessment.CriterionAssessment ca = json.map(j -> criterionFromJson(rubric, j, c.code()))
                        .orElse(PassAssessment.CriterionAssessment.unscored(Msg.of("llmInvalid")));
                if (ACCURACY_CRITERIA.contains(c.code()) && wordCount > 0) {
                    ca = accuracyFromDensity(rubric, ref.level(), errors, wordCount, ca);
                }
                global.put(c.code(), ca);
            }
        }
        return new PassAssessment(parts, global, errors, notes, noteMsgs);
    }

    private PassAssessment.PartAssessment buildPartAssessment(RubricDefinition rubric, RubricDefinition.RubricPart rp,
                                                              ParticipantBundle.PartTranscript pt, JsonNode json,
                                                              List<Ergebnisbogen.ErrorItem> partErrors, String level) {
        Map<String, PassAssessment.CriterionAssessment> items = new HashMap<>();
        Map<String, PassAssessment.CriterionAssessment> criteria = new HashMap<>();
        // N1c-2: nhận xét 2 câu của "giám khảo" cho Teil — trước đây prompt yêu cầu nhưng bị vứt.
        String comment = json.path("summary_vi").asText(null);
        if (comment != null && comment.isBlank()) {
            comment = null;
        }
        if (rubric.scale() == RubricDefinition.BandScale.VHN) {
            Map<String, JsonNode> byCode = new HashMap<>();
            for (JsonNode it : json.path("items")) {
                byCode.put(it.path("code").asText(), it);
            }
            for (RubricDefinition.RubricItem item : rp.items()) {
                JsonNode it = byCode.get(item.code());
                if (it == null) {
                    items.put(item.code(), new PassAssessment.CriterionAssessment("NULL", true, "medium",
                            List.of(), List.of(Msg.of("itemNotMentioned"))));
                } else {
                    String status = BandScales.normalize(rubric.scale(), it.path("status").asText());
                    items.put(item.code(), new PassAssessment.CriterionAssessment(status == null ? "NULL" : status, true,
                            "high", quotes(it.path("quote"))));
                }
            }
            return new PassAssessment.PartAssessment(rp.teilNo(), items, Map.of(), false, comment);
        }

        LexicalProfile lex = lexicalProfiler.profile(pt.candidate(), level);
        Optional<FluencyMetrics> fluency = fluencyExtractor.extract(pt.candidate());
        for (RubricDefinition.RubricCriterion c : rp.criteria()) {
            PassAssessment.CriterionAssessment ca = criterionFromJson(rubric, json, c.code());
            if (PRONUNCIATION_CRITERIA.contains(c.code())) {
                ca = pronunciation(rubric, fluency);
            } else if (ACCURACY_CRITERIA.contains(c.code()) && lex.tokenCount() > 0) {
                ca = accuracyFromDensity(rubric, level, partErrors, lex.tokenCount(), ca);
            } else if (FLUENCY_BLEND_CRITERIA.contains(c.code()) && fluency.isPresent() && ca.scored()) {
                ca = blendWithFluency(rubric, level, fluency.get(), ca);
            } else if ("WORTSCHATZ".equals(c.code()) || "AUSDRUCKSFAEHIGKEIT".equals(c.code())) {
                ca = withMsg(ca, Msg.of("lexMetrics", "words", lex.tokenCount(),
                        "ttr", String.format("%.2f", lex.typeTokenRatio()),
                        "inList", Math.round(lex.inListShare() * 100),
                        "above", lex.aboveTargetLevelTypes()));
            } else if ("KOHAERENZ".equals(c.code()) || "INTERAKTION".equals(c.code())) {
                ca = withMsg(ca, Msg.of("cohesionMetrics", "connectors", lex.connectorCount(),
                        "subordinators", lex.subordinatorCount()));
            }
            criteria.put(c.code(), ca);
        }
        return new PassAssessment.PartAssessment(rp.teilNo(), Map.of(), criteria, false, comment);
    }

    private PassAssessment.CriterionAssessment criterionFromJson(RubricDefinition rubric, JsonNode json, String code) {
        for (JsonNode c : json.path("criteria")) {
            if (code.equalsIgnoreCase(c.path("code").asText())) {
                String band = BandScales.normalize(rubric.scale(), c.path("band").asText());
                if (band == null) {
                    return PassAssessment.CriterionAssessment.unscored(
                            Msg.of("llmInvalidBand", "band", c.path("band").asText()));
                }
                List<String> ev = new ArrayList<>();
                for (JsonNode e : c.path("evidence")) {
                    ev.add(e.asText());
                }
                return new PassAssessment.CriterionAssessment(band, true, "medium", ev);
            }
        }
        return PassAssessment.CriterionAssessment.unscored(Msg.of("criterionNotGraded", "criterion", code));
    }

    private static PassAssessment.CriterionAssessment withMsg(PassAssessment.CriterionAssessment ca, Msg msg) {
        List<Msg> msgs = new ArrayList<>(ca.evidenceMsgs());
        msgs.add(msg);
        return new PassAssessment.CriterionAssessment(ca.band(), ca.scored(), ca.confidence(), ca.evidence(), msgs);
    }

    private PassAssessment.CriterionAssessment accuracyFromDensity(RubricDefinition rubric, String level,
                                                                   List<Ergebnisbogen.ErrorItem> errors, int wordCount,
                                                                   PassAssessment.CriterionAssessment llm) {
        double density = errorDensityBandMapper.densityPer100(errors, wordCount);
        String band = errorDensityBandMapper.band(rubric.scale(), level, density);
        List<Msg> msgs = new ArrayList<>();
        msgs.add(Msg.of("errorDensity", "density", String.format("%.1f", density),
                "errors", errors.size(), "words", wordCount, "band", band));
        if (llm.scored() && llm.band() != null) {
            msgs.add(Msg.of("llmProposedBand", "band", llm.band()));
        }
        return new PassAssessment.CriterionAssessment(band, true, "medium", List.of(), msgs);
    }

    private PassAssessment.CriterionAssessment blendWithFluency(RubricDefinition rubric, String level,
                                                                FluencyMetrics m, PassAssessment.CriterionAssessment llm) {
        String fluencyBand = fluencyBandMapper.band(rubric.scale(), level, m);
        int li = BandScales.index(rubric.scale(), llm.band());
        int fi = BandScales.index(rubric.scale(), fluencyBand);
        int idx = (int) Math.ceil((li + fi) / 2.0); // hoà → band thấp hơn (nghiêm)
        String band = BandScales.bands(rubric.scale()).get(idx);
        List<Msg> msgs = new ArrayList<>(llm.evidenceMsgs());
        msgs.add(Msg.of("fluencyBlend", "wpm", Math.round(m.wordsPerMinute()), "pauses", m.longPauseCount(),
                "mlr", String.format("%.1f", m.meanLengthOfRun()), "fluencyBand", fluencyBand,
                "llmBand", llm.band(), "band", band));
        return new PassAssessment.CriterionAssessment(band, true, "high", llm.evidence(), msgs);
    }

    private PassAssessment.CriterionAssessment pronunciation(RubricDefinition rubric, Optional<FluencyMetrics> fluency) {
        if (fluency.isEmpty() || fluency.get().avgLogprob() == null) {
            return PassAssessment.CriterionAssessment.unscored(Msg.of("noAudioTextOnly"));
        }
        double lp = fluency.get().avgLogprob();
        String band = intelligibilityBandMapper.band(rubric.scale(), lp);
        return new PassAssessment.CriterionAssessment(band, true, "low", List.of(),
                List.of(Msg.of("sttConfidence", "logprob", String.format("%.2f", lp))));
    }

    private List<Ergebnisbogen.ErrorItem> parseErrors(JsonNode json, int teilNo) {
        List<Ergebnisbogen.ErrorItem> out = new ArrayList<>();
        for (JsonNode e : json.path("errors")) {
            String code = e.path("code").asText("");
            String original = e.path("original").asText("");
            if (original.isBlank()) {
                continue;
            }
            String severity = e.path("severity").asText("MAJOR").toUpperCase();
            String normalized = com.deutschflow.speaking.ai.ErrorCatalog.normalize(code);
            out.add(new Ergebnisbogen.ErrorItem(normalized != null ? normalized : "OTHER",
                    original, e.path("correction").asText(""), "MINOR".equals(severity) ? "MINOR" : "MAJOR", teilNo));
        }
        return out;
    }

    private static List<String> quotes(JsonNode q) {
        if (q == null || q.isMissingNode() || q.isNull()) {
            return List.of();
        }
        return q.isArray() ? stream(q) : List.of(q.asText());
    }

    private static List<String> stream(JsonNode arr) {
        List<String> out = new ArrayList<>();
        arr.forEach(n -> out.add(n.asText()));
        return out;
    }

    private Optional<JsonNode> callJson(long userId, List<ChatMessage> messages, double temperature) {
        try {
            AiChatCompletionResult res = chatClient.chatCompletionForTier(messages,
                    tierResolver.spec(LlmTier.GRADING_EXAM), temperature, props.gradingTokens(), true);
            if (res == null) {
                return Optional.empty();
            }
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE, null, null);
            return LlmJson.parse(objectMapper, res.content());
        } catch (RuntimeException e) {
            log.warn("[ExamGrading] LLM call failed: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
