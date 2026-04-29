package com.deutschflow.speaking.ai;

import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Builds the dynamic system prompt for the DeutschFlow AI speaking practice feature.
 * The prompt instructs GPT-4o to act as a German teacher and always respond in the
 * defined JSON schema.
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
     * Builds a personalized system prompt based on the user's learning profile and known interests.
     *
     * @param profile        the user's learning profile (must not be null)
     * @param knownInterests list of known user interests (may be empty, must not be null)
     * @return a non-empty system prompt string
     */
    public String buildSystemPrompt(UserLearningProfile profile, List<String> knownInterests) {
        String level = profile.getTargetLevel() != null
                ? profile.getTargetLevel().name()
                : "B1";
        String industry = profile.getIndustry() != null && !profile.getIndustry().isBlank()
                ? profile.getIndustry()
                : "nicht angegeben";

        String interestSection = "";
        if (knownInterests != null && !knownInterests.isEmpty()) {
            interestSection = "- Bekannte Interessen: " + String.join(", ", knownInterests);
        }

        return """
                Du bist "DeutschFlow AI", ein virtueller muttersprachlicher Deutschlehrer,
                spezialisiert auf Sprechreflextraining für Vietnamesen.
                Du hast eine geduldige, ermutigende Persönlichkeit und bist sehr feinfühlig beim Erkennen von Fehlern.
                
                Benutzerprofil:
                - Zielsprachniveau: %s
                - Beruf: %s
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
                """.formatted(level, industry, interestSection, level, JSON_SCHEMA_INSTRUCTION);
    }

    /**
     * Builds an optional topic context string to prepend to the first user message.
     *
     * @param topic the conversation topic (may be null or blank)
     * @return a topic context string, or empty string if no topic
     */
    public String buildTopicContext(String topic) {
        if (topic == null || topic.isBlank()) {
            return "";
        }
        return "Das Gesprächsthema ist: \"" + topic + "\". Beginne das Gespräch passend zu diesem Thema.";
    }
}
