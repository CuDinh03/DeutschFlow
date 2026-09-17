package com.deutschflow.examspeaking.session;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.config.ExamSpeakingProperties;
import com.deutschflow.examspeaking.scoring.LlmJson;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.ErrorCatalog;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Vai AI trong phiên cá nhân: Prüfer (điều phối, hỏi thêm) và Partner ảo (chỉ chế độ cá nhân).
 * Lượt nói dùng tier CHAT_PAID; chấm nhanh drill dùng GRADING_DAILY. Mọi call ghi ledger.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiInterlocutorService {

    static final String FEATURE_TURN = "EXAM_SPEAKING_TURN";
    static final String FEATURE_DRILL_EVAL = "EXAM_SPEAKING_DRILL_EVAL";

    private final OpenAiChatClient chatClient;
    private final LlmTierResolver tierResolver;
    private final ObjectMapper objectMapper;
    private final AiUsageLedgerService ledger;
    private final ExamSpeakingProperties props;

    public record AiReply(String role, String textDe) {}

    /** Tương thích test: không gắn sessionId vào ledger. */
    public AiReply reply(long userId, ExamBlueprint bp, BlueprintPart part, SessionPlan.Step step,
                         Map<String, Object> candidateCard, Map<String, Object> nextCard,
                         List<ChatMessage> history, String candidateText) {
        return reply(userId, null, bp, part, step, candidateCard, nextCard, history, candidateText);
    }

    /** {@code sessionId} đi vào ledger để đo chi phí token theo phiên (N0.6, admin AI usage). */
    public AiReply reply(long userId, Long sessionId, ExamBlueprint bp, BlueprintPart part, SessionPlan.Step step,
                         Map<String, Object> candidateCard, Map<String, Object> nextCard,
                         List<ChatMessage> history, String candidateText) {
        String role = step.aiRole();
        if (role == null || "NONE".equals(role)) {
            return null;
        }
        String instruction = switch (step.aiAction()) {
            case "SPELL_REQUEST" -> "Reagiere kurz und freundlich auf die Vorstellung (1 Satz). Bitte dann den Kandidaten, das Wort \""
                    + val(candidateCard, "spell") + "\" zu buchstabieren.";
            case "NUMBER_REQUEST" -> "Sag kurz \"Danke\" und bitte den Kandidaten, diese Nummer zu sagen: \"" + val(candidateCard, "number") + "\".";
            case "THANK" -> "Bedanke dich kurz (1 Satz) und beende den Teil freundlich.";
            case "ANSWER_AND_ASK" -> "Beantworte die Frage/Bitte des Kandidaten realistisch in 1–2 Sätzen. Stelle danach GENAU EINE eigene Frage"
                    + askWithCard(nextCard);
            case "REACT_AND_ASK" -> "Reagiere auf den Beitrag des Kandidaten (zustimmen oder höflich widersprechen, mit kurzer Begründung) und bringe einen eigenen Vorschlag oder eine Rückfrage ein. Maximal 2 Sätze.";
            case "REACT" -> "Reagiere kurz und natürlich (z. B. \"Ach, interessant!\", \"Gut, danke.\"). Maximal 1 Satz. Keine neue Frage.";
            // telc B1 T1 (2020): Prüferblatt in sẵn Zusatzthemen — giám khảo hỏi thêm MỘT câu từ đó,
            // thí sinh không biết trước (khoá partner* nên client không nhận).
            case "FOLLOWUP_QUESTION" -> "PRUEFER".equals(role) && candidateCard != null && candidateCard.get("partnerExtraQuestions") != null
                    ? "Stelle GENAU EINE dieser Zusatzfragen (wähle eine, die im Gespräch noch nicht vorkam): "
                      + candidateCard.get("partnerExtraQuestions") + ". Maximal 2 Sätze."
                    : "Stelle GENAU EINE passende Nachfrage zum Gesagten. Maximal 2 Sätze.";
            case "CONCLUDE" -> "Fasse kurz zusammen, worauf ihr euch geeinigt habt (oder dass ihr unterschiedlicher Meinung seid), maximal 2 Sätze, und beende das Gespräch freundlich.";
            case "FEEDBACK_AND_QUESTION" -> "Der Kandidat hat gerade präsentiert. Gib eine kurze Rückmeldung (1 Satz: was war interessant oder neu) und stelle GENAU EINE Frage zum Vortrag. Maximal 2 Sätze.";
            case "ANSWER_QUESTION" -> "Der Kandidat hat dir eine Rückmeldung gegeben und eine Frage zu DEINEM Vortrag gestellt. Bedanke dich kurz und beantworte die Frage in 1–2 Sätzen. Keine Gegenfrage.";
            case "REPORT_OWN" -> "Reagiere kurz auf den Bericht des Kandidaten (1 Satz). Berichte dann, was auf DEINER Vorlage steht (Thema und die wichtigsten Zahlen, 2–3 Sätze), und frage den Kandidaten nach seiner Erfahrung oder Meinung.";
            // telc B1 T2 (2020): thẻ ý kiến trái chiều — bạn thi thuật lại ý kiến TRÊN THẺ CỦA MÌNH
            // (tên, nghề, người đó nghĩ gì), không phải số liệu.
            case "REPORT_OPINION" -> "Reagiere kurz auf den Bericht des Kandidaten (1 Satz). Berichte dann, was auf DEINER Karte steht: wer die Person ist (Name, Alter, Beruf) und was sie zum Thema meint (2–3 Sätze, mit eigenen Worten). Frage den Kandidaten dann nach seiner eigenen Erfahrung oder Meinung.";
            // Mẹo của người đã thi: bạn thi đồng tình + bổ sung, không ép phản biện mỗi lượt — Teil 2
            // là trao đổi trải nghiệm, không phải Diskussion.
            case "AGREE_AND_ADD" -> "Gehe auf das ein, was der Kandidat gerade gesagt hat: Stimme zu, wo du kannst, und ergänze eine eigene Erfahrung oder einen neuen Aspekt (1–2 Sätze). Widersprich nur, wenn deine Karte klar etwas anderes sagt — dann höflich und mit Grund. Stelle am Ende EINE kurze Rückfrage. Maximal 3 Sätze.";
            default -> "Reagiere kurz und passend. Maximal 2 Sätze.";
        };
        String persona = "PRUEFER".equals(role)
                ? "Du bist Prüfer/in in der mündlichen Prüfung. Sei freundlich, neutral, knapp. Du korrigierst NICHT und erklärst NICHT."
                : "Du bist der/die Prüfungspartner/in — ein/e Lerner/in auf Niveau " + bp.level()
                + ". Sprich einfach, kurz, natürlich; kein perfektes Deutsch nötig; führe das Gespräch NICHT alleine; lass dem Kandidaten Raum.";
        String system = persona + " Niveau: " + bp.level() + ". Aufgabe: " + part.title() + "."
                + privateContext(candidateCard)
                + " Antworte NUR mit JSON: {\"reply_de\":\"...\"}";
        List<ChatMessage> messages = new ArrayList<>();
        messages.add(new ChatMessage("system", system));
        messages.addAll(history);
        messages.add(new ChatMessage("user", "Kandidat sagt: \"" + candidateText + "\"\n\nDeine Aufgabe jetzt: " + instruction));
        try {
            AiChatCompletionResult res = chatClient.chatCompletionForTier(messages, tierResolver.spec(LlmTier.CHAT_PAID),
                    0.6, props.turnTokens(), true);
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_TURN, null, sessionId);
            String text = LlmJson.parse(objectMapper, res.content()).map(j -> LlmJson.speechText(j, "reply_de")).orElse("");
            if (text.isBlank()) {
                text = fallback(step.aiAction(), candidateCard, nextCard, candidateText);
            }
            return new AiReply(role, text);
        } catch (RuntimeException e) {
            log.warn("[ExamSpeaking] AI reply failed, using template fallback: {}", e.getMessage());
            return new AiReply(role, fallback(step.aiAction(), candidateCard, nextCard, candidateText));
        }
    }

    /**
     * Chấm nhanh một lượt drill: 0–10 + tối đa 3 lỗi (mã ErrorCatalog) + Redemittel. Không in điểm chính thức.
     * {@code lang} = locale UI của học viên (vi/en/de) — quyết định NGÔN NGỮ lời giải thích (QS-3 N0.7);
     * key JSON vẫn là {@code feedback_vi} vì lý do tương thích (FE + turnEvalJson đã lưu).
     */
    /** Tương thích test: không gắn sessionId vào ledger. */
    public Map<String, Object> quickEval(long userId, ExamBlueprint bp, BlueprintPart part, SessionPlan.Step step,
                                         Map<String, Object> card, String lastAiText, String candidateText, String lang) {
        return quickEval(userId, null, bp, part, step, card, lastAiText, candidateText, lang);
    }

    public Map<String, Object> quickEval(long userId, Long sessionId, ExamBlueprint bp, BlueprintPart part,
                                         SessionPlan.Step step, Map<String, Object> card, String lastAiText,
                                         String candidateText, String lang) {
        String feedbackSpec = switch (lang == null ? "vi" : lang) {
            case "de" -> "2 kurze deutsche Sätze (einfaches Deutsch)";
            case "en" -> "2 short English sentences";
            default -> "2 câu tiếng Việt";
        };
        String prompt = """
                Du bist Prüfer/in (%s %s, %s). Bewerte NUR diese eine Äußerung des Kandidaten.
                Erwartete Handlung: %s. Material: %s. Vorherige Frage/Aussage des Gegenübers: "%s"
                Äußerung des Kandidaten: "%s"

                Bewerte streng aber ermutigend. Bei Unsicherheit die niedrigere Note.
                Fehlercodes (nur diese): %s
                Antworte NUR mit JSON:
                {"score":0-10,"feedback_vi":"%s","corrections":[{"code":"...","original":"...","correction":"...","severity":"MINOR|MAJOR|BLOCKING"}],"redemittel":["...","..."]}
                Maximal 3 corrections, maximal 2 Redemittel (deutsch, passend zum Aufgabentyp).
                """.formatted(bp.provider(), bp.level(), part.title(), step.candidateAction(),
                card == null ? "-" : card.toString(), lastAiText == null ? "-" : lastAiText, candidateText,
                String.join(", ", ErrorCatalog.ORDERED_CODES), feedbackSpec);
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            AiChatCompletionResult res = chatClient.chatCompletionForTier(List.of(new ChatMessage("user", prompt)),
                    tierResolver.spec(LlmTier.GRADING_DAILY), 0.2, props.drillEvalTokens(), true);
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_DRILL_EVAL, null, sessionId);
            JsonNode j = LlmJson.parse(objectMapper, res.content()).orElse(null);
            if (j == null) {
                out.put("error", "AI trả kết quả không hợp lệ");
                return out;
            }
            int score = j.path("score").asInt(-1);
            if (score < 0) {
                // N1c-5: LLM không trả điểm hợp lệ → báo lỗi thay vì hiển thị 0/10 oan.
                out.put("error", "AI không trả điểm hợp lệ");
                return out;
            }
            out.put("score", Math.min(10, score));
            out.put("feedbackVi", LlmJson.speechText(j, "feedback_vi"));
            List<Map<String, String>> corrections = new ArrayList<>();
            for (JsonNode c : j.path("corrections")) {
                String norm = ErrorCatalog.normalize(c.path("code").asText(""));
                corrections.add(Map.of("code", norm == null ? "OTHER" : norm,
                        "original", LlmJson.speechText(c, "original"), "correction", LlmJson.speechText(c, "correction"),
                        "severity", GrammarErrorSeverity.normalizeToStored(c.path("severity").asText("MINOR"))));
                if (corrections.size() == 3) {
                    break;
                }
            }
            out.put("corrections", corrections);
            List<String> redemittel = new ArrayList<>();
            j.path("redemittel").forEach(n -> redemittel.add(LlmJson.normalizeSpeech(n.asText())));
            out.put("redemittel", redemittel);
        } catch (RuntimeException e) {
            log.warn("[ExamSpeaking] drill eval failed: {}", e.getMessage());
            out.put("error", "Chấm nhanh thất bại, lượt vẫn được lưu");
        }
        return out;
    }

    /** Lời nhắc đặt câu hỏi theo loại thẻ kế tiếp (A1 Themen-/Bildkarte, A2 Stichwort-/Fragewortkarte). */
    private static String askWithCard(Map<String, Object> next) {
        if (next == null) {
            return ".";
        }
        if (next.containsKey("keyword")) {
            return " zum Stichwort \"" + val(next, "keyword") + "\" (Fragen zur Person).";
        }
        if (next.containsKey("questionWord")) {
            return " zum Thema \"" + val(next, "thema") + "\", die mit \"" + val(next, "questionWord") + "\" beginnt.";
        }
        if (next.containsKey("object")) {
            return " — formuliere eine Bitte mit der Bildkarte \"" + val(next, "article") + " " + val(next, "object") + "\".";
        }
        return " zu Thema \"" + val(next, "thema") + "\" mit dem Wort \"" + val(next, "wort") + "\".";
    }

    /**
     * Đề riêng của partner (lịch tuần, Vorlage B, bài trình bày, lập trường tranh luận…): chỉ AI biết;
     * không bao giờ lộ sang client (xem ExamSessionService.clientStimulus).
     *
     * <p>⚠️ Hai tầng ĐỘC LẬP nhau, dễ tưởng nhầm là một: {@code clientStimulus} ẩn khoá khỏi client
     * theo tiền tố "partner" một cách tự động, còn hàm này chỉ hiểu những khoá nó biết TÊN. Thêm
     * khoá {@code partner*} mới trong migration mà quên khai báo ở đây thì đề riêng bị ẩn khỏi
     * client nhưng AI cũng không thấy — partner hành xử như không có đề, âm thầm và khó phát hiện.
     * Package-private để PrivateContextTest chốt lại từng khoá.
     */
    /**
     * Toàn bộ khoá {@code partner*} mà {@link #privateContext} biết diễn giải. Admin ngân hàng đề
     * (Đ5b) từ chối đề có khoá partner* NGOÀI danh sách này — vì khoá lạ bị clientStimulus ẩn khỏi
     * client nhưng AI cũng không đọc → hỏng âm thầm (xem cảnh báo ở trên). Thêm nhánh mới ở
     * privateContext thì PHẢI thêm khoá vào đây (PrivateContextTest chốt đồng bộ).
     */
    public static final java.util.Set<String> KNOWN_PARTNER_KEYS = java.util.Set.of(
            "partnerCalendar", "partnerText", "partnerChart", "partnerPresentation", "partnerStance",
            "partnerOpinion", "partnerExtraQuestions");

    static String privateContext(Map<String, Object> card) {
        if (card == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        if (card.get("partnerCalendar") != null) {
            sb.append(" DEIN TERMINKALENDER (nur du kennst ihn; der Kandidat hat einen anderen): ").append(card.get("partnerCalendar"))
                    .append(". Ziel: ").append(val(card, "goal"))
                    .append(" Schlage NUR Zeiten vor, an denen du frei bist; lehne belegte Zeiten mit kurzer Begründung ab")
                    .append(" und mache einen Gegenvorschlag. Einigt euch am Ende auf einen konkreten Termin.");
        }
        if (card.get("partnerText") != null || card.get("partnerChart") != null) {
            sb.append(" DEINE VORLAGE (nur du kennst sie; der Kandidat hat eine andere Vorlage zum Thema \"").append(val(card, "thema"))
                    .append("\"): ").append(val(card, "partnerText"));
            if (card.get("partnerChart") != null) {
                sb.append(" Zahlen: ").append(card.get("partnerChart"));
            }
            sb.append(" Berichte nur davon, wenn du dran bist; erfinde keine anderen Zahlen.");
        }
        if (card.get("partnerPresentation") != null) {
            sb.append(" DEIN VORTRAG (du hast ihn gerade gehalten; beantworte Fragen dazu konsistent): ")
                    .append(val(card, "partnerPresentation"));
        }
        if (card.get("partnerStance") != null) {
            // B2 Diskussion: partner phải giữ vững phía ĐỐI LẬP, nếu không cuộc tranh luận xẹp
            // sau một lượt và thí sinh không có gì để phản biện — mất trắng tiêu chí Interaktion.
            sb.append(" DEINE ROLLE IN DER DISKUSSION: Du bist ").append(val(card, "partnerStance"))
                    .append(" bei der Frage \"").append(val(card, "question"))
                    .append("\". Vertritt diese Position durchgehend mit konkreten Argumenten und Beispielen,")
                    .append(" gib höchstens Teilpunkte zu und wechsle die Seite NICHT, auch wenn der Kandidat gut argumentiert.");
        }
        if (card.get("partnerOpinion") != null) {
            // telc B1 T2 (2020): hai ý kiến TRÁI CHIỀU — thẻ của bạn thi là một người khác với tên,
            // tuổi, nghề. Bạn thi thuật lại ý kiến đó rồi nói như ý của mình, nhưng KHÔNG biến Teil 2
            // thành tranh luận: đồng tình + bổ sung được, phản đối chỉ khi thẻ nói khác hẳn.
            sb.append(" DEINE MEINUNGSKARTE (nur du kennst sie; der Kandidat hat eine andere Person mit einer anderen Meinung zum Thema \"")
                    .append(val(card, "thema")).append("\"): ").append(opinionText(card.get("partnerOpinion")))
                    .append(" Berichte davon, wenn du dran bist, und vertritt danach diese Sicht als deine eigene Erfahrung.")
                    .append(" Du musst dem Kandidaten NICHT bei jedem Beitrag widersprechen — zustimmen und ergänzen ist erlaubt.");
        }
        if (card.get("partnerExtraQuestions") != null) {
            sb.append(" ZUSATZFRAGEN DER PRÜFERIN / DES PRÜFERS (stehen nur auf dem Prüferblatt): ")
                    .append(card.get("partnerExtraQuestions"))
                    .append(". Nur der/die Prüfer/in stellt am Ende von Teil 1 GENAU EINE davon; der/die Partner/in nennt sie nicht.");
        }
        return sb.toString();
    }

    /** {@code {name, age, job, quote}} → „Name, 33, Beruf: „Zitat"" — hoặc chuỗi thô nếu thẻ lưu chuỗi. */
    private static String opinionText(Object opinion) {
        if (!(opinion instanceof Map<?, ?> m)) {
            return String.valueOf(opinion);
        }
        StringBuilder sb = new StringBuilder();
        if (m.get("name") != null) sb.append(m.get("name"));
        if (m.get("age") != null) sb.append(sb.isEmpty() ? "" : ", ").append(m.get("age"));
        if (m.get("job") != null) sb.append(sb.isEmpty() ? "" : ", ").append(m.get("job"));
        if (m.get("quote") != null) sb.append(sb.isEmpty() ? "" : ": ").append('„').append(m.get("quote")).append('“');
        return sb.toString();
    }

    private static String val(Map<String, Object> card, String key) {
        if (card == null) {
            return "…";
        }
        Object v = card.get(key);
        return v == null ? "…" : String.valueOf(v);
    }

    /**
     * Câu của bạn thi ảo khi đường AI không trả lời được.
     *
     * <p>Đây KHÔNG chỉ là chuyện của test: mỗi lần đường AI hỏng, người học thật nhận đúng câu này
     * giữa phòng thi. Câu đệm chung chung („Ach so, verstehe.") làm hỏng luôn nhiệm vụ — ở bước
     * {@code FEEDBACK_AND_QUESTION} bạn thi phải ĐẶT một câu hỏi, không hỏi thì thí sinh không có
     * gì để trả lời ở lượt sau; còn ở {@code ANSWER_QUESTION} thì thí sinh vừa hỏi một câu cụ thể
     * và nhận lại một câu không dính gì tới câu hỏi đó.
     *
     * <p>Nên hai bước đó nay bám vào chính lời thí sinh vừa nói. Đặt từ khoá trong ngoặc kép để
     * khỏi phải chia giống/cách — câu vẫn đúng ngữ pháp với bất kỳ danh từ nào.
     */
    private static String fallback(String action, Map<String, Object> card, Map<String, Object> next,
                                   String candidateText) {
        return switch (action) {
            case "SPELL_REQUEST" -> "Danke. Können Sie bitte das Wort \"" + val(card, "spell") + "\" buchstabieren?";
            case "NUMBER_REQUEST" -> "Danke. Und sagen Sie bitte diese Nummer: " + val(card, "number") + ".";
            case "THANK", "CONCLUDE" -> "Vielen Dank.";
            case "ANSWER_AND_ASK" -> next == null ? "Ja, gut. Und Sie?"
                    : next.containsKey("keyword") ? "Ja, gut. Und Sie — " + val(next, "keyword")
                    : next.containsKey("questionWord") ? "Ja, gut. Und Sie — " + val(next, "questionWord").replace("…", val(next, "thema"))
                    : "Ja, gern. Und Sie — " + val(next, "thema") + ": " + val(next, "wort") + "?";
            case "FOLLOWUP_QUESTION" -> card != null && card.get("partnerExtraQuestions") instanceof List<?> extra && !extra.isEmpty()
                    // Giám khảo hỏi thêm cuối Teil 1: câu dự phòng lấy đúng Zusatzfrage trên thẻ, không hỏi chung chung.
                    ? String.valueOf(extra.get(0))
                    : "Interessant. Können Sie das genauer erklären?";
            case "REACT_AND_ASK", "AGREE_AND_ADD" -> "Interessant. Können Sie das genauer erklären?";
            case "REPORT_OPINION" -> card != null && card.get("partnerOpinion") instanceof Map<?, ?> op
                    // Câu dự phòng vẫn phải làm đúng việc của pha 1: thuật lại ý kiến trên thẻ rồi hỏi lại.
                    ? "Auf meiner Karte steht die Meinung von " + op.get("name")
                      + (op.get("job") != null ? ", " + op.get("job") : "") + ": „" + op.get("quote") + "“ Und was denken Sie?"
                    : "Auf meiner Karte steht eine andere Meinung zum Thema. Und was denken Sie?";
            case "ANSWER_QUESTION" -> {
                String keyword = questionKeyword(candidateText);
                yield keyword.isEmpty()
                        ? "Danke für die Rückmeldung! Ja, das sehe ich genauso."
                        : "Danke für die Rückmeldung! Du hast nach „" + keyword
                          + "“ gefragt — ja, das kommt bei mir auch vor.";
            }
            case "FEEDBACK_AND_QUESTION" -> {
                String keyword = questionKeyword(candidateText);
                // Bước này BẮT BUỘC phải có một câu hỏi, bằng không lượt sau của thí sinh treo.
                yield keyword.isEmpty()
                        ? "Danke für deinen Vortrag! Was war für dich am schwierigsten?"
                        : "Danke für deinen Vortrag! Du hast „" + keyword
                          + "“ erwähnt — kannst du das noch genauer erklären?";
            }
            default -> "Ach so, verstehe.";
        };
    }

    /**
     * Danh từ mà thí sinh vừa hỏi tới, để câu dự phòng bám vào đề thay vì nói chung chung.
     *
     * <p>Heuristic: trong tiếng Đức danh từ viết hoa, nên lấy từ viết hoa ĐẦU TIÊN không đứng đầu
     * câu (từ đầu câu luôn viết hoa nên không phân biệt được). Ưu tiên câu có dấu hỏi — đó mới là
     * câu thí sinh đang hỏi. Không tìm được thì trả chuỗi rỗng và nơi gọi dùng câu chung.
     */
    static String questionKeyword(String candidateText) {
        if (candidateText == null || candidateText.isBlank()) {
            return "";
        }
        String target = candidateText.trim();
        String[] sentences = target.split("(?<=[.!?])\\s+");
        for (String sentence : sentences) {
            if (sentence.indexOf('?') >= 0) {
                target = sentence;
                break;
            }
        }
        String[] words = target.trim().split("\\s+");
        for (int i = 1; i < words.length; i++) {
            String word = words[i].replaceAll("[^\\p{L}\\p{M}\u00df-]", "");
            if (word.length() >= 3 && Character.isUpperCase(word.charAt(0))) {
                return word;
            }
        }
        return "";
    }
}
