package com.deutschflow.speaking.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.ChatMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class SprechenTeil2Service {

    private final OpenAiChatClient chatClient;
    private final LlmTierResolver llmTierResolver;
    private final ObjectMapper objectMapper;
    /** Ngân hàng đề Luyện thi Nói (V277 seed 50 thẻ A1 Teil 2) — nguồn chính; danh sách cứng chỉ là dự phòng. */
    private final com.deutschflow.examspeaking.repository.SpeakingExamTaskRepository examTaskRepository;
    private final Random random = new Random();

    public record SprechenCard(String thema, String wort) {}

    // Hardcoded Goethe A1 Sprechen Teil 2 Cards
    private static final List<SprechenCard> CARDS = List.of(
            // Thema: Essen und Trinken
            new SprechenCard("Essen und Trinken", "Brot"),
            new SprechenCard("Essen und Trinken", "Fleisch"),
            new SprechenCard("Essen und Trinken", "Wasser"),
            new SprechenCard("Essen und Trinken", "Kaffee"),
            new SprechenCard("Essen und Trinken", "Obst"),
            new SprechenCard("Essen und Trinken", "Gemüse"),
            new SprechenCard("Essen und Trinken", "Bier"),
            new SprechenCard("Essen und Trinken", "Restaurant"),

            // Thema: Einkaufen
            new SprechenCard("Einkaufen", "Kasse"),
            new SprechenCard("Einkaufen", "Schuhe"),
            new SprechenCard("Einkaufen", "Kleidung"),
            new SprechenCard("Einkaufen", "Geld"),
            new SprechenCard("Einkaufen", "Zeitung"),
            new SprechenCard("Einkaufen", "Supermarkt"),

            // Thema: Wohnen
            new SprechenCard("Wohnen", "Küche"),
            new SprechenCard("Wohnen", "Miete"),
            new SprechenCard("Wohnen", "Schlafzimmer"),
            new SprechenCard("Wohnen", "Balkon"),
            new SprechenCard("Wohnen", "Garten"),
            new SprechenCard("Wohnen", "Fernseher"),

            // Thema: Familie und Freunde
            new SprechenCard("Familie", "Kinder"),
            new SprechenCard("Familie", "Eltern"),
            new SprechenCard("Familie", "Geschwister"),
            new SprechenCard("Familie", "Wochenende"),
            new SprechenCard("Familie", "Ausflug"),

            // Thema: Arbeit und Beruf
            new SprechenCard("Arbeit", "Kollegen"),
            new SprechenCard("Arbeit", "Pause"),
            new SprechenCard("Arbeit", "Computer"),
            new SprechenCard("Arbeit", "Urlaub"),
            new SprechenCard("Arbeit", "Spaß"),

            // Thema: Freizeit und Hobby
            new SprechenCard("Freizeit", "Sport"),
            new SprechenCard("Freizeit", "Musik"),
            new SprechenCard("Freizeit", "Fahrrad"),
            new SprechenCard("Freizeit", "Kino"),
            new SprechenCard("Freizeit", "Lesen")
    );

    /**
     * Rút thẻ từ ngân hàng đề dùng chung với phòng luyện thi (một nguồn đề, admin quản qua
     * /v2/admin/exam-bank). Ngân hàng rỗng/lỗi → rơi về danh sách cứng để placement không bao giờ kẹt.
     */
    public SprechenCard getRandomCard() {
        List<SprechenCard> pool = bankCards();
        List<SprechenCard> source = pool.isEmpty() ? CARDS : pool;
        return source.get(random.nextInt(source.size()));
    }

    List<SprechenCard> bankCards() {
        if (examTaskRepository == null) {
            return List.of();
        }
        try {
            return examTaskRepository.findApproved("GOETHE", "A1", 2, "CARD_QA").stream()
                    .map(t -> t.getStimulusJson())
                    .filter(j -> j != null && j.get("thema") != null && j.get("wort") != null)
                    .map(j -> new SprechenCard(String.valueOf(j.get("thema")), String.valueOf(j.get("wort"))))
                    .toList();
        } catch (RuntimeException e) {
            log.warn("[SprechenTeil2] không đọc được ngân hàng đề, dùng danh sách cứng: {}", e.getMessage());
            return List.of();
        }
    }

    public Map<String, Object> evaluateTurn(String stage, String thema, String wort, String transcript, String aiQuestionAsked) {
        String prompt;

        if ("USER_ASKING".equals(stage)) {
            prompt = """
                Du spielst die Rolle eines Partners in der Goethe A1 Prüfung (Sprechen Teil 2).
                Der Benutzer hat eine Karte gezogen: Thema "%s", Wort "%s".
                Der Benutzer muss eine W-Frage oder Ja/Nein-Frage bilden, die zum Thema und Wort passt.
                
                Transkript der Frage des Benutzers: "%s"
                
                Aufgaben für dich:
                1. Antworte realistisch und kurz (1-2 Sätze) auf die Frage des Benutzers auf Deutsch A1-Niveau.
                2. Bewerte die Frage des Benutzers (Skala 0-10). Kriterien:
                   - Erfüllung (Passt es zum Thema und Wort? Ist es verständlich?)
                   - Sprache (Grammatik, Wortschatz).
                3. Korrigiere Fehler und gib kurzes Feedback auf Vietnamesisch.
                
                Antworte NUR mit diesem JSON-Format:
                {
                  "score": 0-10,
                  "feedback_vi": "Nhận xét và sửa lỗi chi tiết...",
                  "ai_response_de": "Deine Antwort auf die Frage"
                }
                """.formatted(thema, wort, transcript);
        } else if ("USER_ANSWERING".equals(stage)) {
            prompt = """
                Du spielst die Rolle eines Prüfers in der Goethe A1 Prüfung (Sprechen Teil 2).
                Du hast dem Benutzer zuvor folgende Frage gestellt (Thema: %s, Wort: %s): "%s"
                
                Transkript der Antwort des Benutzers: "%s"
                
                Aufgaben für dich:
                1. Reagiere kurz und natürlich (z.B. "Ach, interessant!" oder "Verstehe.") auf Deutsch A1-Niveau.
                2. Bewerte die Antwort des Benutzers (Skala 0-10). Kriterien:
                   - Erfüllung (Hat er/sie auf die Frage geantwortet?)
                   - Sprache (Grammatik, Vokabeln).
                3. Korrigiere Fehler und gib kurzes Feedback auf Vietnamesisch.
                
                Antworte NUR mit diesem JSON-Format:
                {
                  "score": 0-10,
                  "feedback_vi": "Nhận xét và sửa lỗi chi tiết...",
                  "ai_response_de": "Deine kurze Reaktion"
                }
                """.formatted(thema, wort, aiQuestionAsked, transcript);
        } else {
            throw new IllegalArgumentException("Invalid stage: " + stage);
        }

        try {
            var messages = List.of(new ChatMessage("user", prompt));
            // Tier GRADING_EXAM (khung plans/2026-08-07, B1.2): call CHẤM lượt thi — trước đây
            // model=null rơi về model nói (mis-route). Call sinh đề bên dưới GIỮ model nói.
            var response = chatClient.chatCompletionForTier(
                    messages, llmTierResolver.spec(LlmTier.GRADING_EXAM), 0.3, 1000);
            return objectMapper.readValue(response.content(), Map.class);
        } catch (Exception e) {
            log.error("Failed to evaluate Sprechen Teil 2 Turn", e);
            throw new RuntimeException("AI Evaluation failed", e);
        }
    }

    public String generateAiQuestion(String thema, String wort) {
        String prompt = """
            Du bist ein Prüfling in der Goethe A1 Prüfung (Sprechen Teil 2).
            Du hast eine Karte gezogen: Thema "%s", Wort "%s".
            
            Bilde EINE einfache Frage (W-Frage oder Ja/Nein-Frage) an deinen Partner auf Deutsch A1-Niveau.
            Die Frage MUSS das Wort enthalten und zum Thema passen.
            
            Antworte NUR mit diesem JSON-Format:
            {
              "question": "..."
            }
            """.formatted(thema, wort);

        try {
            var messages = List.of(new ChatMessage("user", prompt));
            // model = null → default speaking model (app.ai.groq.model). See note in evaluateTurn.
            var response = chatClient.chatCompletion(messages, null, 0.5, 500);
            Map<String, String> res = objectMapper.readValue(response.content(), Map.class);
            return res.get("question");
        } catch (Exception e) {
            log.error("Failed to generate AI question", e);
            return "Kaufen Sie gern " + wort + "?"; // Fallback
        }
    }
}
