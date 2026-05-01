package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
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
              "errors": [
                {
                  "error_code": "WORD_ORDER.V2_MAIN_CLAUSE",
                  "severity": "BLOCKING",
                  "confidence": 0.85,
                  "wrong_span": "...",
                  "corrected_span": "...",
                  "rule_vi_short": "...",
                  "example_correct_de": "..."
                }
              ],
              "learning_status": {
                "new_word": "...",
                "user_interest_detected": "..."
              }
            }
            REGELN ZU errors[]:
            - Maximal 3 Einträge: die wichtigsten Fehler in der letzten Nutzeräußerung.
            - severity ist genau einer von: BLOCKING, MAJOR, MINOR.
            - confidence ist eine Zahl zwischen 0 und 1.
            - error_code MUSS GENAU einer der folgenden Codes sein (sonst weglassen):
            %s
            Wenn die Nutzeräußerung korrekt ist oder keine strukturierten Fehler erkannt werden: errors = [].
            Wenn keine klassische Korrektur nötig ist: correction, explanation_vi und grammar_point auf null.
            Wenn errors nicht leer ist, dürfen correction/explanation_vi/grammar_point zusätzlich gesetzt werden oder null sein.
            Wenn kein neues Wort oder Interesse erkannt wurde, setze new_word und user_interest_detected auf null.
            """.formatted(ErrorCatalog.codesCompactForPrompt());

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
                ? SpeakingCefrSupport.clampBand(sessionCefrLevel)
                : SpeakingCefrSupport.floorPracticeBand(profile);
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
     * Same as {@link #buildSystemPrompt(UserLearningProfile, List, String, List, String)} but injects
     * adaptive Schwerpunkt / cooldown hints when {@code policy} is non-null and enabled.
     */
    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy) {
        if (policy == null || !policy.enabled()) {
            return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel);
        }

        String level = policy.cefrEffective();
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

        String schwerpunktSection = "";
        if (policy.targetStructures() != null && !policy.targetStructures().isEmpty()) {
            schwerpunktSection = """
                    Heutiger Schwerpunkt (adaptive Personalisierung):
                    %s
                    Stelle Folgefragen und kurze Satzbau-Aufgaben, die genau diese Strukturen testen.
                    """.formatted(String.join("; ", policy.targetStructures()));
        }

        String topicNudge = "";
        if (policy.topicSuggestion() != null && !policy.topicSuggestion().isBlank()
                && (topic == null || topic.isBlank()
                || !policy.topicSuggestion().trim().equalsIgnoreCase(topic.trim()))) {
            topicNudge = "- Optionaler Themenvorschlag (wenn es zum Gespräch passt): " + policy.topicSuggestion();
        }

        String bannedSection = "";
        if (policy.bannedCodes() != null && !policy.bannedCodes().isEmpty()) {
            bannedSection = """
                    Cooldown: Vermeide es, gezielt diese Fehlercodes zu üben (Lerner hat sie kürzlich erfolgreich repariert):
                    %s
                    """.formatted(String.join(", ", policy.bannedCodes()));
        }

        int knob = policy.difficultyKnob();
        String lengthHint = knob > 0
                ? "Erlaubt etwas längere, nuanciertere Sätze."
                : knob < 0
                ? "Halte Sätze kürzer und einfacher; maximal ein Nebensatz pro Antwort."
                : "Moderate Satzlänge.";

        return """
                Du bist "DeutschFlow AI", ein virtueller muttersprachlicher Deutschlehrer,
                spezialisiert auf Sprechreflextraining für Vietnamesen.
                Du hast eine geduldige, ermutigende Persönlichkeit und bist sehr feinfühlig beim Erkennen von Fehlern.

                Benutzerprofil:
                - Zielsprachniveau (adaptiv): %s
                - Beruf: %s
                %s
                %s

                %s

                %s

                %s

                %s

                Gesprächsregeln:
                1. Kommuniziere zu 100%% auf Deutsch. Nur Fehlererklärungen auf Vietnamesisch.
                2. Verwende %s-Niveau: klarer Wortschatz, moderate Satzstruktur. %s
                3. Fehlerkorrektur: Antworte zuerst auf den Inhalt des Benutzers, dann korrigiere.
                   Konzentriere dich auf klassische Fehler von Vietnamesen: Verbstellung, Genus (der/die/das), Akkusativ/Dativ.
                4. Beende immer mit einer offenen Frage zum aktuellen Thema, um das Gespräch fortzuführen.
                5. Wenn du persönliche Informationen über den Benutzer entdeckst (Hobbys, Beruf, Interessen),
                   speichere sie im Feld user_interest_detected.

                %s
                """.formatted(level, industry, interestSection, topicSection,
                weakPointsSection, schwerpunktSection, topicNudge, bannedSection,
                level, lengthHint, JSON_SCHEMA_INSTRUCTION);
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
