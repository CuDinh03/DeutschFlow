package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Builds the dynamic system prompt for the DeutschFlow AI speaking practice feature.
 * The prompt instructs the model to act as a German teacher and always respond in the
 * defined JSON schema. It injects the user's profile, known interests, current session
 * topic, and top grammar weak points so the AI can ask targeted follow-up questions.
 */
@Component
public class SystemPromptBuilder {

    private static final String JSON_SCHEMA_INSTRUCTION = """
            Antworte IMMER im folgenden JSON-Format (kein Markdown, nur reines JSON):
            {
              "ai_speech_de": "...",
              "correction": "...",
              "explanation_vi": "...",
              "grammar_point": "...",
              "learning_status": {
                "new_word": "...",
                "user_interest_detected": "..."
              }
            }
            Wenn keine Fehler vorhanden sind, setze correction, explanation_vi und grammar_point auf null.
            Wenn kein neues Wort oder Interesse erkannt wurde, setze new_word und user_interest_detected auf null.
            """;

    /**
     * Builds a personalized system prompt based on the user's learning profile,
     * known interests, session topic, and historical grammar weak points.
     *
     * @param profile        the user's learning profile (must not be null)
     * @param knownInterests list of known user interests (may be empty)
     * @param topic          the session topic (may be null)
     * @param weakPoints     top recurring grammar error types (may be empty)
     * @return a non-empty system prompt string
     */
    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel) {
        String level = (sessionCefrLevel != null && !sessionCefrLevel.isBlank())
                ? sessionCefrLevel.toUpperCase()
                : (profile.getTargetLevel() != null ? profile.getTargetLevel().name() : "B1");
        String industry = profile.getIndustry() != null && !profile.getIndustry().isBlank()
                ? profile.getIndustry()
                : "nicht angegeben";

        String interestSection = (knownInterests != null && !knownInterests.isEmpty())
                ? "- Bekannte Interessen: " + String.join(", ", knownInterests)
                : "";

        String topicSection = (topic != null && !topic.isBlank())
                ? "- Aktuelles Gesprächsthema: " + topic
                : "";

        String weakPointsSection = "";
        if (weakPoints != null && !weakPoints.isEmpty()) {
            String list = weakPoints.stream()
                    .map(wp -> wp.grammarPoint() + " (" + wp.count() + "x)")
                    .collect(Collectors.joining(", "));
            weakPointsSection = """
                    Schwächen des Lerners (häufigste Fehlerquellen, die du gezielt trainieren sollst):
                    %s
                    WICHTIG: Stelle gezielt Folgefragen und Satzaufgaben, die genau diese Schwachstellen
                    testen, um den Lerner zu verbessern. Korrigiere diese Fehler besonders sorgfältig.
                    """.formatted(list);
        }

        return """
                Du bist "DeutschFlow AI", ein virtueller muttersprachlicher Deutschlehrer,
                spezialisiert auf Sprechreflextraining für Vietnamesen.
                Du hast eine geduldige, ermutigende Persönlichkeit und bist sehr feinfühlig beim Erkennen von Fehlern.

                Benutzerprofil:
                - Zielsprachniveau: %s
                - Beruf: %s
                %s
                %s

                %s

                Gesprächsregeln:
                1. Kommuniziere zu 100%% auf Deutsch. Nur Fehlererklärungen auf Vietnamesisch.
                2. Verwende %s-Niveau: klarer Wortschatz, moderate Satzstruktur.
                3. Fehlerkorrektur: Antworte zuerst auf den Inhalt des Benutzers, dann korrigiere.
                   Konzentriere dich auf klassische Fehler von Vietnamesen: Verbstellung, Genus (der/die/das), Akkusativ/Dativ.
                4. Beende immer mit einer offenen Frage zum aktuellen Thema, um das Gespräch fortzuführen.
                5. Wenn du persönliche Informationen über den Benutzer entdeckst (Hobbys, Beruf, Interessen),
                   speichere sie im Feld user_interest_detected.

                %s
                """.formatted(level, industry, interestSection, topicSection,
                weakPointsSection, level, JSON_SCHEMA_INSTRUCTION);
    }

    /**
     * Overload for backward-compatibility: no topic, no weak points.
     */
    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, null);
    }

    public String buildSystemPrompt(UserLearningProfile profile, List<String> knownInterests) {
        return buildSystemPrompt(profile, knownInterests, null, List.of(), null);
    }

    /**
     * Builds an optional topic context string to prepend to the first user message.
     */
    public String buildTopicContext(String topic) {
        if (topic == null || topic.isBlank()) {
            return "";
        }
        return "Das Gesprächsthema ist: \"" + topic + "\". Beginne das Gespräch passend zu diesem Thema.";
    }
}
