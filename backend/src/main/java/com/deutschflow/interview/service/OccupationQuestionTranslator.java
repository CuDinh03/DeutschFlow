package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Dịch bù câu lớp nghề sinh trước V339 (K4 A + B + E): mỗi nghề một lần gọi AI cho cả nhóm câu.
 *
 * <p>Chỉ điền ô còn trống — bản dịch người duyệt đã sửa không bao giờ bị ghi đè. Admin gọi theo lô
 * nhỏ ({@link #MAX_OCCUPATIONS_PER_RUN}) để một request không vượt giới hạn thời gian của tunnel;
 * gọi lại tới khi {@code remaining = 0}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OccupationQuestionTranslator {

    static final int MAX_OCCUPATIONS_PER_RUN = 10;

    private final OpenAiChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OccupationQuestionRepository questionRepository;

    /**
     * @param occupations số nghề đã gọi AI trong lượt này
     * @param translated  số câu được điền thêm ít nhất một bản dịch
     * @param remaining   số câu còn thiếu bản dịch sau lượt này
     */
    public record BackfillResult(int occupations, int translated, int remaining) {}

    public BackfillResult backfill(int maxOccupations) {
        int limit = Math.max(1, Math.min(maxOccupations, MAX_OCCUPATIONS_PER_RUN));
        Map<String, List<OccupationQuestion>> byOccupation = questionRepository
                .findUntranslated(OccupationContentStatus.REJECTED).stream()
                .collect(Collectors.groupingBy(OccupationQuestion::getOccupationCode,
                        LinkedHashMap::new, Collectors.toList()));
        int occupations = 0;
        int translated = 0;
        for (List<OccupationQuestion> questions : byOccupation.values()) {
            if (occupations == limit) break;
            translated += translate(questions);
            occupations++;
        }
        int remaining = questionRepository.findUntranslated(OccupationContentStatus.REJECTED).size();
        log.info("[OccupationTranslate] {} occupations, {} questions translated, {} remaining",
                occupations, translated, remaining);
        return new BackfillResult(occupations, translated, remaining);
    }

    /** Dịch một nhóm câu cùng nghề. Lỗi AI → 0, không ném (lượt sau thử lại). */
    int translate(List<OccupationQuestion> questions) {
        try {
            ArrayNode input = objectMapper.createArrayNode();
            for (OccupationQuestion q : questions) {
                input.addObject().put("id", q.getId()).put("questionDe", q.getQuestionDe());
            }
            AiChatCompletionResult result = chatClient.chatCompletion(
                    List.of(new ChatMessage("system", SYSTEM_PROMPT),
                            new ChatMessage("user", objectMapper.writeValueAsString(input))),
                    null, 0.2, 2000);
            return apply(result.content(), questions);
        } catch (Exception e) {
            log.warn("[OccupationTranslate] Failed for {}: {}",
                    questions.isEmpty() ? "?" : questions.get(0).getOccupationCode(), e.getMessage());
            return 0;
        }
    }

    static final String SYSTEM_PROMPT = """
            You translate German job-interview questions for a language-learning app. Input: a JSON array of
            {"id","questionDe"}. Return ONLY valid JSON, no markdown:
            {"translations":[{"id":"...","questionVi":"...","questionEn":"..."}]}
            questionVi: natural Vietnamese (polite "bạn"); questionEn: natural English. Keep the meaning and the
            question form exactly; keep German job titles and technical terms that have no common translation.
            One entry per input id, same ids.
            """;

    /** Ghi bản dịch vào ô còn trống; trả số câu thay đổi. */
    int apply(String content, List<OccupationQuestion> questions) throws Exception {
        Map<String, OccupationQuestion> byId = questions.stream()
                .collect(Collectors.toMap(OccupationQuestion::getId, Function.identity()));
        List<OccupationQuestion> changed = new ArrayList<>();
        for (JsonNode t : objectMapper.readTree(content).path("translations")) {
            OccupationQuestion q = byId.remove(t.path("id").asText(""));
            if (q == null) continue;
            String vi = OccupationContentGenerator.translation(t.path("questionVi").asText(""));
            String en = OccupationContentGenerator.translation(t.path("questionEn").asText(""));
            boolean touched = false;
            if (q.getQuestionVi() == null && vi != null) { q.setQuestionVi(vi); touched = true; }
            if (q.getQuestionEn() == null && en != null) { q.setQuestionEn(en); touched = true; }
            if (touched) changed.add(q);
        }
        questionRepository.saveAll(changed);
        return changed.size();
    }
}
