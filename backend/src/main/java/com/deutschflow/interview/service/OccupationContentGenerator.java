package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.Occupation;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.entity.OccupationTerm;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.interview.repository.OccupationRepository;
import com.deutschflow.interview.repository.OccupationTermRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.interview.QuestionDifficulty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sinh lớp nghề bằng AI (đợt 2b A + B + E): 6 câu HARD_SKILLS + 6 từ chuyên môn cho một nghề, lưu
 * với trạng thái {@code AI_GENERATED} để vào hàng duyệt.
 *
 * <p>Chỉ sinh cho nghề dùng bộ chung — 49 nghề có bộ viết tay của nhân vật thì bộ đó là lớp nghề.
 * Một nghề chỉ tự sinh một lần (kể cả khi người duyệt đã từ chối hết); sinh lại là việc của admin.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OccupationContentGenerator {

    static final int QUESTIONS_PER_OCCUPATION = 6;
    static final int TERMS_PER_OCCUPATION = 6;
    /** Ít hơn số này thì coi lần sinh là hỏng — không đủ để mỗi phiên có 3 câu lớp nghề. */
    static final int MIN_QUESTIONS = 3;

    private static final int MAX_QUESTION_CHARS = 400;
    /** Bản dịch dài hơn câu gốc một chút (tiếng Việt thường dài hơn tiếng Đức). */
    static final int MAX_TRANSLATION_CHARS = 600;
    private static final int MAX_TOPIC_CHARS = 80;

    private final OpenAiChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final OccupationRepository occupationRepository;
    private final OccupationQuestionRepository questionRepository;
    private final OccupationTermRepository termRepository;

    /** Chặn hai phiên cùng nghề sinh trùng trên một instance. */
    private final Set<String> inFlight = ConcurrentHashMap.newKeySet();

    public record Generated(List<OccupationQuestion> questions, List<OccupationTerm> terms) {}

    /** Gọi nền lúc tạo phiên: câu lớp nghề được hỏi từ lượt 4, nên lần sinh kịp xong trước đó. */
    @Async("aiExecutor")
    public void generateIfMissingAsync(String occupationCode) {
        generateIfMissing(occupationCode);
    }

    public Optional<Generated> generateIfMissing(String occupationCode) {
        Optional<Occupation> occupation = occupationRepository.findById(occupationCode)
                .filter(Occupation::isActive)
                .filter(o -> o.getLegacyPersonaCode() == null);
        if (occupation.isEmpty() || questionRepository.existsByOccupationCode(occupationCode)) {
            return Optional.empty();
        }
        return generate(occupation.get());
    }

    /** Sinh một lượt mới (admin bấm "Sinh thêm" cũng đi đường này). Lỗi AI → rỗng, không ném. */
    public Optional<Generated> generate(Occupation occupation) {
        if (!inFlight.add(occupation.getCode())) {
            return Optional.empty();
        }
        try {
            AiChatCompletionResult result = chatClient.chatCompletion(
                    List.of(new ChatMessage("system", SYSTEM_PROMPT),
                            new ChatMessage("user", userPrompt(occupation))),
                    null, 0.4, 1600);
            Generated parsed = parse(result.content(), occupation.getCode(), result.model());
            if (parsed.questions().size() < MIN_QUESTIONS) {
                log.warn("[OccupationGen] {} returned only {} usable questions — discarded",
                        occupation.getCode(), parsed.questions().size());
                return Optional.empty();
            }
            List<OccupationTerm> freshTerms = parsed.terms().stream()
                    .filter(t -> !termRepository.existsByOccupationCodeAndTermDeIgnoreCase(
                            occupation.getCode(), t.getTermDe()))
                    .toList();
            List<OccupationQuestion> savedQ = questionRepository.saveAll(parsed.questions());
            List<OccupationTerm> savedT = termRepository.saveAll(freshTerms);
            log.info("[OccupationGen] {}: {} questions, {} terms (model={})",
                    occupation.getCode(), savedQ.size(), savedT.size(), result.model());
            return Optional.of(new Generated(savedQ, savedT));
        } catch (Exception e) {
            log.warn("[OccupationGen] Failed for {}: {}", occupation.getCode(), e.getMessage());
            return Optional.empty();
        } finally {
            inFlight.remove(occupation.getCode());
        }
    }

    // ── prompt ───────────────────────────────────────────────────────────────

    static final String SYSTEM_PROMPT = """
            You write content for a German job-interview practice app. Return ONLY valid JSON, no markdown:
            {"questions":[{"questionDe":"...","questionVi":"...","questionEn":"...","topicKey":"...","difficulty":"BEGINNER|INTERMEDIATE|ADVANCED"}],
             "terms":[{"termDe":"...","meaningEn":"...","meaningVi":"...","exampleDe":"..."}]}
            Questions: exactly 6 professional-skills (Fachkompetenz) questions that a real employer in Germany
            asks a candidate for THIS occupation. Formal "Sie". Each asks about concrete experience or a concrete
            work situation typical of this occupation, under 30 words, never a yes/no question. Never ask about
            salary, religion, health, age, origin, family or pregnancy (AGG). Exactly 2 BEGINNER, 2 INTERMEDIATE,
            2 ADVANCED. topicKey: short lowercase snake_case label of the skill. questionVi: natural Vietnamese
            translation of questionDe (polite "bạn"); questionEn: natural English translation.
            Terms: exactly 6 job-specific German terms a candidate should use in this interview; nouns with
            article ("die Wundversorgung"). meaningEn in English, meaningVi in Vietnamese, exampleDe one short
            sentence a candidate could say in the interview.
            """;

    static String userPrompt(Occupation o) {
        return "Occupation (German): " + o.getNameDe()
                + "\nOccupation (English): " + o.getNameEn()
                + "\nWorkplace group: " + o.getWorkplace();
    }

    // ── kiểm đầu ra ──────────────────────────────────────────────────────────

    /** Lọc đầu ra AI: bỏ câu rỗng/quá dài/trùng, chuẩn hoá topicKey + độ khó, cắt về 6 + 6. */
    Generated parse(String content, String occupationCode, String model) throws Exception {
        JsonNode root = objectMapper.readTree(content);
        List<OccupationQuestion> questions = new ArrayList<>();
        Set<String> seenQ = new HashSet<>();
        for (JsonNode q : root.path("questions")) {
            String text = clean(q.path("questionDe").asText(""));
            if (text.isEmpty() || text.length() > MAX_QUESTION_CHARS
                    || !seenQ.add(text.toLowerCase(Locale.ROOT))) {
                continue;
            }
            questions.add(OccupationQuestion.builder()
                    .id(OccupationQuestion.ID_PREFIX + occupationCode + "_"
                            + UUID.randomUUID().toString().substring(0, 8))
                    .occupationCode(occupationCode)
                    .topicKey(topicKey(q.path("topicKey").asText("")))
                    .questionDe(text)
                    .questionVi(translation(q.path("questionVi").asText("")))
                    .questionEn(translation(q.path("questionEn").asText("")))
                    .difficulty(difficulty(q.path("difficulty").asText("")))
                    .sourceModel(truncate(model, 80))
                    .build());
            if (questions.size() == QUESTIONS_PER_OCCUPATION) break;
        }
        List<OccupationTerm> terms = new ArrayList<>();
        Set<String> seenT = new HashSet<>();
        for (JsonNode t : root.path("terms")) {
            String term = clean(t.path("termDe").asText(""));
            String en = clean(t.path("meaningEn").asText(""));
            String vi = clean(t.path("meaningVi").asText(""));
            String example = clean(t.path("exampleDe").asText(""));
            if (term.isEmpty() || en.isEmpty() || vi.isEmpty()
                    || term.length() > 120 || en.length() > 200 || vi.length() > 200 || example.length() > 300
                    || !seenT.add(term.toLowerCase(Locale.ROOT))) {
                continue;
            }
            terms.add(OccupationTerm.builder()
                    .occupationCode(occupationCode)
                    .termDe(term)
                    .meaningEn(en)
                    .meaningVi(vi)
                    .exampleDe(example.isEmpty() ? null : example)
                    .sourceModel(truncate(model, 80))
                    .build());
            if (terms.size() == TERMS_PER_OCCUPATION) break;
        }
        return new Generated(questions, terms);
    }

    /** Bản dịch thiếu hoặc quá dài → {@code null} (câu vẫn dùng được, trang chỉ hiện tiếng Đức). */
    static String translation(String raw) {
        String t = clean(raw);
        return t.isEmpty() || t.length() > MAX_TRANSLATION_CHARS ? null : t;
    }

    static String clean(String s) {
        return s == null ? "" : s.strip().replaceAll("\\s+", " ");
    }

    static String topicKey(String raw) {
        String k = raw == null ? "" : raw.toLowerCase(Locale.ROOT)
                .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (k.isEmpty()) return "fachkompetenz";
        return k.length() > MAX_TOPIC_CHARS ? k.substring(0, MAX_TOPIC_CHARS) : k;
    }

    static String difficulty(String raw) {
        try {
            return QuestionDifficulty.valueOf(raw.strip().toUpperCase(Locale.ROOT)).name();
        } catch (IllegalArgumentException | NullPointerException e) {
            return QuestionDifficulty.INTERMEDIATE.name();
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
