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

    public AiReply reply(long userId, ExamBlueprint bp, BlueprintPart part, SessionPlan.Step step,
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
            case "FOLLOWUP_QUESTION" -> "Stelle GENAU EINE passende Nachfrage zum Gesagten. Maximal 2 Sätze.";
            case "CONCLUDE" -> "Fasse kurz zusammen, worauf ihr euch geeinigt habt (oder dass ihr unterschiedlicher Meinung seid), maximal 2 Sätze, und beende das Gespräch freundlich.";
            case "FEEDBACK_AND_QUESTION" -> "Der Kandidat hat gerade präsentiert. Gib eine kurze Rückmeldung (1 Satz: was war interessant oder neu) und stelle GENAU EINE Frage zum Vortrag. Maximal 2 Sätze.";
            case "ANSWER_QUESTION" -> "Der Kandidat hat dir eine Rückmeldung gegeben und eine Frage zu DEINEM Vortrag gestellt. Bedanke dich kurz und beantworte die Frage in 1–2 Sätzen. Keine Gegenfrage.";
            case "REPORT_OWN" -> "Reagiere kurz auf den Bericht des Kandidaten (1 Satz). Berichte dann, was auf DEINER Vorlage steht (Thema und die wichtigsten Zahlen, 2–3 Sätze), und frage den Kandidaten nach seiner Erfahrung oder Meinung.";
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
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_TURN, null, null);
            String text = LlmJson.parse(objectMapper, res.content()).map(j -> j.path("reply_de").asText("")).orElse("");
            if (text.isBlank()) {
                text = fallback(step.aiAction(), candidateCard, nextCard);
            }
            return new AiReply(role, text);
        } catch (RuntimeException e) {
            log.warn("[ExamSpeaking] AI reply failed, using template fallback: {}", e.getMessage());
            return new AiReply(role, fallback(step.aiAction(), candidateCard, nextCard));
        }
    }

    /** Chấm nhanh một lượt drill: 0–10 + tối đa 3 lỗi (mã ErrorCatalog) + Redemittel. Không in điểm chính thức. */
    public Map<String, Object> quickEval(long userId, ExamBlueprint bp, BlueprintPart part, SessionPlan.Step step,
                                         Map<String, Object> card, String lastAiText, String candidateText) {
        String prompt = """
                Du bist Prüfer/in (%s %s, %s). Bewerte NUR diese eine Äußerung des Kandidaten.
                Erwartete Handlung: %s. Material: %s. Vorherige Frage/Aussage des Gegenübers: "%s"
                Äußerung des Kandidaten: "%s"

                Bewerte streng aber ermutigend. Bei Unsicherheit die niedrigere Note.
                Fehlercodes (nur diese): %s
                Antworte NUR mit JSON:
                {"score":0-10,"feedback_vi":"2 câu tiếng Việt","corrections":[{"code":"...","original":"...","correction":"..."}],"redemittel":["...","..."]}
                Maximal 3 corrections, maximal 2 Redemittel (deutsch, passend zum Aufgabentyp).
                """.formatted(bp.provider(), bp.level(), part.title(), step.candidateAction(),
                card == null ? "-" : card.toString(), lastAiText == null ? "-" : lastAiText, candidateText,
                String.join(", ", ErrorCatalog.ORDERED_CODES));
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            AiChatCompletionResult res = chatClient.chatCompletionForTier(List.of(new ChatMessage("user", prompt)),
                    tierResolver.spec(LlmTier.GRADING_DAILY), 0.2, props.drillEvalTokens(), true);
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_DRILL_EVAL, null, null);
            JsonNode j = LlmJson.parse(objectMapper, res.content()).orElse(null);
            if (j == null) {
                out.put("error", "AI trả kết quả không hợp lệ");
                return out;
            }
            out.put("score", Math.max(0, Math.min(10, j.path("score").asInt(0))));
            out.put("feedbackVi", j.path("feedback_vi").asText(""));
            List<Map<String, String>> corrections = new ArrayList<>();
            for (JsonNode c : j.path("corrections")) {
                String norm = ErrorCatalog.normalize(c.path("code").asText(""));
                corrections.add(Map.of("code", norm == null ? "OTHER" : norm,
                        "original", c.path("original").asText(""), "correction", c.path("correction").asText("")));
                if (corrections.size() == 3) {
                    break;
                }
            }
            out.put("corrections", corrections);
            List<String> redemittel = new ArrayList<>();
            j.path("redemittel").forEach(n -> redemittel.add(n.asText()));
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
        return sb.toString();
    }

    private static String val(Map<String, Object> card, String key) {
        if (card == null) {
            return "…";
        }
        Object v = card.get(key);
        return v == null ? "…" : String.valueOf(v);
    }

    private static String fallback(String action, Map<String, Object> card, Map<String, Object> next) {
        return switch (action) {
            case "SPELL_REQUEST" -> "Danke. Können Sie bitte das Wort \"" + val(card, "spell") + "\" buchstabieren?";
            case "NUMBER_REQUEST" -> "Danke. Und sagen Sie bitte diese Nummer: " + val(card, "number") + ".";
            case "THANK", "CONCLUDE" -> "Vielen Dank.";
            case "ANSWER_AND_ASK" -> next == null ? "Ja, gut. Und Sie?"
                    : next.containsKey("keyword") ? "Ja, gut. Und Sie — " + val(next, "keyword")
                    : next.containsKey("questionWord") ? "Ja, gut. Und Sie — " + val(next, "questionWord").replace("…", val(next, "thema"))
                    : "Ja, gern. Und Sie — " + val(next, "thema") + ": " + val(next, "wort") + "?";
            case "FOLLOWUP_QUESTION", "REACT_AND_ASK" -> "Interessant. Können Sie das genauer erklären?";
            default -> "Ach so, verstehe.";
        };
    }
}
