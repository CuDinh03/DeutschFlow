package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.stereotype.Component;

import java.util.List;
import com.deutschflow.speaking.interview.InterviewSessionState;

/**
 * Builds the dynamic system prompt for the "DeutschFlow AI Tutor".
 */
@Component
@lombok.RequiredArgsConstructor
public class SystemPromptBuilder {

    private final com.deutschflow.system.service.SystemConfigService systemConfigService;
    private final com.deutschflow.speaking.interview.PersonaInterviewRegistry personaInterviewRegistry;
    private final com.deutschflow.interview.prompt.InterviewPromptBuilder interviewPromptBuilder;


    /**
     * Compact V1 JSON contract — keys must stay aligned with {@link com.deutschflow.speaking.ai.AiResponseDto}
     * and the frontend AiChatResponse mapping.
     */
    private static final String JSON_SCHEMA_INSTRUCTION = """
            Ausgabe: genau EIN JSON-Objekt, gültiges STRICT JSON (kein Markdown, kein Text drumherum).
            {
              "ai_speech_de": "Deutsch, Tutor-Antwort + kurze Folgefrage zum Target_Topic",
              "status": "OFF_TOPIC | ON_TOPIC_NEEDS_IMPROVEMENT | EXCELLENT",
              "similarity_score": 0.0,
              "feedback": "kurz, ermutigend, Vietnamesisch",
              "correction": null oder korrigierter Satz",
              "explanation_vi": null oder kurz Vietnamesisch",
              "grammar_point": null oder Stichwort",
              "errors": [
                {
                  "error_code": "Pflichtfeld aus Katalog",
                  "severity": "BLOCKING | MAJOR | MINOR",
                  "confidence": 0.0,
                  "wrong_span": "",
                  "corrected_span": "",
                  "rule_vi_short": "",
                  "example_correct_de": ""
                }
              ],
              "suggestions": [
                {
                  "german_text": "",
                  "vietnamese_translation": "",
                  "level": "%s",
                  "why_to_use": "kurz Vietnamesisch",
                  "usage_context": "kurz Vietnamesisch",
                  "lego_structure": "z.B. S+V+O"
                }
              ],
              "learning_status": { "new_word": null, "user_interest_detected": null }
            }
            REGELN KURZ:
            - suggestions: genau 2 Einträge.
              [0] = KURZ + SICHER (3-6 Wörter, leicht auszusprechen, direkte Antwort auf deine LETZTE Frage).
              [1] = LÄNGER + REICHER (8-14 Wörter, ehrlicher/detaillierter, auch direkte Antwort auf dieselbe Frage).
              BEIDE müssen die LETZTE Frage konkret beantworten — keine generischen Satzanfänge.
            - severity (UI-Reparatur-Gate): BLOCKING nur bei schwerem Missverständnis / Kernfehler (Verständnis, falsche Person/Kasus die Bedeutung ändert, Satz unverständlich). MAJOR = klarer Satzfehler. MINOR = Tippfehler, kleine Randkorrekturen. BLOCKING sparsam — Frontend erzwingt Drill.
            - error_code MUSS sein:
            %s
            """;

    private static final String JSON_SCHEMA_V2 = """
            Antworte NUR im folgenden JSON-Format (STRICT JSON, kein Markdown):
            {
              "content": "Antwort auf Deutsch (max. ca. 50 Wörter)",
              "translation": "Vollständige vietnamesische Übersetzung von content",
              "feedback": "Optional: kurzes ermutigendes Feedback ODER 'Hero''s Recovery'-Hinweis bei leichtem Fehler (Vietnamesisch)",
              "action": "Ein konkreter nächster Schritt oder eine Folgefrage auf Deutsch oder Vietnamesisch (kurz)"
            }
            REGELN:
            - Halte dich STRIKT an User_Level (Satzbau/Wortschatz) — pro Stufe deutlich anders:
              A1 = sehr kurze Hauptsätze, Präsens, Grundwortschatz; A2 = einfache Sätze, Perfekt/Modalverben, Alltagswörter;
              B1 = verbundene Sätze mit Konnektoren (weil/dass/wenn), Alltagsthemen; B2 = komplexe Satzgefüge, Nebensätze, abstraktere Themen;
              C1 = idiomatisch, nuanciert, anspruchsvoller/präziser Wortschatz. NICHT über User_Level hinausgehen.
            - Sprache: Inhalt sprachlich primär Deutsch (im Feld "content"); translation immer Vietnamesisch.
            - "action" soll das Gespräch zum Target_Topic voranbringen (eine klare Aufforderung/Frage).
            """;

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, SpeakingPersona.DEFAULT);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPersona persona) {
        String level = (sessionCefrLevel != null && !sessionCefrLevel.isBlank())
                ? SpeakingCefrSupport.clampBand(sessionCefrLevel)
                : SpeakingCefrSupport.floorPracticeBand(profile);

        return buildInternal(profile, knownInterests, topic, weakPoints, level, null, persona, SpeakingResponseSchema.V1, SpeakingSessionMode.COMMUNICATION, null, null, 0, null);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, persona, responseSchema, SpeakingSessionMode.COMMUNICATION);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema,
                                    SpeakingSessionMode sessionMode) {
        String level = (sessionCefrLevel != null && !sessionCefrLevel.isBlank())
                ? SpeakingCefrSupport.clampBand(sessionCefrLevel)
                : SpeakingCefrSupport.floorPracticeBand(profile);

        return buildInternal(profile, knownInterests, topic, weakPoints, level, null, persona, responseSchema, sessionMode, null, null, 0, null);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, policy, SpeakingPersona.DEFAULT);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy,
                                    SpeakingPersona persona) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, policy, persona, SpeakingResponseSchema.V1);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, policy, persona, responseSchema, SpeakingSessionMode.COMMUNICATION);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema,
                                    SpeakingSessionMode sessionMode) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, policy, persona, responseSchema, sessionMode, null, null, 0);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema,
                                    SpeakingSessionMode sessionMode,
                                    String interviewPosition,
                                    String experienceLevel) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, policy, persona, responseSchema, sessionMode, interviewPosition, experienceLevel, 0);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema,
                                    SpeakingSessionMode sessionMode,
                                    String interviewPosition,
                                    String experienceLevel,
                                    int turnCount) {
        String level = (policy != null && policy.enabled()) ? policy.cefrEffective() :
                (sessionCefrLevel != null && !sessionCefrLevel.isBlank())
                ? SpeakingCefrSupport.clampBand(sessionCefrLevel)
                : SpeakingCefrSupport.floorPracticeBand(profile);

        return buildInternal(profile, knownInterests, topic, weakPoints, level, policy, persona, responseSchema, sessionMode, interviewPosition, experienceLevel, turnCount, null);
    }

    public String buildSystemPrompt(UserLearningProfile profile,
                                    List<String> knownInterests,
                                    String topic,
                                    List<WeakPoint> weakPoints,
                                    String sessionCefrLevel,
                                    SpeakingPolicy policy,
                                    SpeakingPersona persona,
                                    SpeakingResponseSchema responseSchema,
                                    SpeakingSessionMode sessionMode,
                                    String interviewPosition,
                                    String experienceLevel,
                                    int turnCount,
                                    InterviewPromptContext interviewContext) {
        String level = (policy != null && policy.enabled()) ? policy.cefrEffective() :
                (sessionCefrLevel != null && !sessionCefrLevel.isBlank())
                ? SpeakingCefrSupport.clampBand(sessionCefrLevel)
                : SpeakingCefrSupport.floorPracticeBand(profile);

        return buildInternal(profile, knownInterests, topic, weakPoints, level, policy, persona, responseSchema, sessionMode, interviewPosition, experienceLevel, turnCount, interviewContext);
    }

    private void appendCompressedLearnerContext(StringBuilder sb,
                                               List<String> knownInterests,
                                               List<WeakPoint> weakPoints) {
        if (knownInterests != null && !knownInterests.isEmpty()) {
            sb.append("Interessen (Stichworte, gekürzt): ");
            int n = 0;
            for (String i : knownInterests) {
                if (i == null || i.isBlank()) {
                    continue;
                }
                String t = i.trim();
                if (t.length() > 48) {
                    t = t.substring(0, 45) + "…";
                }
                if (n > 0) {
                    sb.append("; ");
                }
                sb.append(t);
                n++;
                if (n >= 5) {
                    break;
                }
            }
            sb.append("\n");
        }
        if (weakPoints != null && !weakPoints.isEmpty()) {
            sb.append("Häufige Schwachstellen (Grammatik): ");
            int m = 0;
            for (WeakPoint w : weakPoints) {
                if (w == null || w.grammarPoint() == null || w.grammarPoint().isBlank()) {
                    continue;
                }
                if (m > 0) {
                    sb.append("; ");
                }
                sb.append(w.grammarPoint().trim()).append(" (×").append(w.count()).append(")");
                m++;
                if (m >= 5) {
                    break;
                }
            }
            sb.append("\n");
        }
    }

    private void appendModePreamble(StringBuilder sb,
                                    SpeakingSessionMode sessionMode,
                                    boolean isVietnamese,
                                    boolean hasIndustry,
                                    String industry,
                                    String topicSection,
                                    SpeakingPersona persona,
                                    String level,
                                    String interviewPosition,
                                    String experienceLevel,
                                    int turnCount,
                                    InterviewPromptContext interviewContext) {
        // ── Mode-specific preamble ──────────────────────────────────────
        if (sessionMode == SpeakingSessionMode.INTERVIEW) {
            String pos = (interviewPosition != null && !interviewPosition.isBlank()) ? interviewPosition : "Allgemeine Position";
            String exp = (experienceLevel != null && !experienceLevel.isBlank()) ? experienceLevel : "unbekannt";
            InterviewPromptContext ctx = interviewContext != null
                    ? interviewContext
                    : InterviewPromptContext.fallback(persona, pos, turnCount, personaInterviewRegistry);
            // Delegate to the layered prompt builder (new interview domain layer)
            sb.append(interviewPromptBuilder.build(
                    persona, level, ctx.state(), ctx.plan(), pos, exp,
                    hasIndustry ? industry : "Allgemein", "control"));

        } else if (sessionMode == SpeakingSessionMode.LESSON && isVietnamese) {
            sb.append("CHẾ ĐỘ LESSON — Giảng dạy từ vựng/bảng chữ cái tiếng Đức bằng tiếng Việt.\n");
            sb.append("NGÔN NGỮ CHÍNH: tiếng VIỆT. Chỉ dùng tiếng Đức trong trường (ai_speech_de) để dạy từ vựng.\n");
            sb.append("TUYỆT ĐỐI KHÔNG dùng tiếng Đức làm ngôn ngữ giao tiếp chính. Mọi giải thích, feedback đều bằng tiếng Việt.\n");
            sb.append("Chủ đề bài học: ").append(topicSection).append("\n\n");

        } else if (isVietnamese) {
            sb.append("CHẾ ĐỘ GIAO TIẾP — Cuộc trò chuyện thân thiện về nước Đức bằng tiếng VIỆT.\n");
            sb.append("NGÔN NGỮ CHÍNH: tiếng VIỆT. Tuyệt đối không nói tiếng Đức làm ngôn ngữ chính.\n");
            sb.append("Chỉ lồng ghép từ/cụm tiếng Đức (in đậm) vào câu tiếng Việt để giảng dạy.\n");
            sb.append("Ví dụ đúng: 'Ở Đức khi gặp nhau người ta hay nói **Hallo** (xin chào) hoặc **Guten Morgen** (chào buổi sáng).\n");
            sb.append("Ví dụ SAI: 'Hallo! Heute lernen wir...' — tức là nói toàn tiếng Đức là SAI.\n");
            sb.append("Mỗi câu trả lời phải: (1) chủ yếu tiếng Việt, (2) có 1-2 từ Đức mới kèm giải thích.\n\n");

        } else {
            sb.append("COMMUNICATION MODE — Alltagsgespräch / Freundliches Gespräch (KEIN Interview, KEINE Bewerbungsfragen).\n");
            sb.append("Du bist ein freundlicher Gesprächspartner — wie ein Tandempartner beim Kaffee.\n");
            sb.append("\n");
            sb.append("NATÜRLICHKEIT (kritisch — Pingo-Style):\n");
            sb.append("1. MAX 15 Wörter pro Antwort. Kurze Sätze wie im echten Gespräch.\n");
            sb.append("2. NUR EINE Frage pro Turn. NIE 2 Fragen kombinieren (z.B. 'Wie geht's? Was machst du?' — STOPP).\n");
            sb.append("3. ACKNOWLEDGE-FIRST-PATTERN: Reagiere ZUERST kurz auf die User-Antwort (1-3 Wörter: 'Ach cool!', 'Echt?', 'Mhm', 'Verstehe', 'Stimmt', 'Klingt gut!'), DANN eine Folgefrage.\n");
            sb.append("4. ECHO DAS DETAIL: Greife das LETZTE konkrete Detail aus der User-Antwort auf (Subjekt, Aktivität, Pronomen). Beispiel: User sagt 'Ich war im Kino.' — Du: 'Ach, im Kino! Was hast du gesehen?'\n");
            sb.append("5. LÄNGENVARIATION: meistens 1 kurzer Satz, gelegentlich 2 für mehr Wärme. Nie 3+ Sätze.\n");
            sb.append("6. CASUAL REGISTER: immer 'du', Kontraktionen ('gibt's', 'geht's', 'hab', 'nich', 'mal'), gelegentlich Füllwörter ('echt', 'eigentlich', 'so', 'halt').\n");
            sb.append("7. VERBOTEN: Interviewfragen ('Was sind Ihre Stärken?'), Lehrer-Tonfall ('Sehr gut, dass du das sagst...'), Listen, Aufzählungen.\n");
            sb.append("8. ERSTE TURN: 1 lockerer Gruß + 1 offene Mini-Frage. Beispiel: 'Hey! Was hast du heute so gemacht?' — nicht mehr.\n");
            if (hasIndustry) {
                sb.append("\n");
                sb.append("KONTEXTINFO BERUF: Der Lernende arbeitet als '").append(industry).append("'.\n");
                sb.append("Du WEISST das bereits — frage NICHT 'Was ist dein Beruf?'. ");
                sb.append("Beziehe den Beruf nur EINMAL beiläufig in das Gespräch ein (z.B. Feierabend, Kollegen, Lieblingsmoment), dann zurück zum Alltag.\n");
                sb.append("Die 2 'suggestions' sollen alltagsnahe Antworten zum Beruf '")
                        .append(industry).append("' sein — NICHT Bewerbungsantworten, NICHT generisch.\n");
            } else {
                sb.append("Der Lernende hat keinen Beruf angegeben. Führe ein allgemeines Alltagsgespräch über Hobby, Essen, Wochenende, Familie, Wetter, Filme.\n");
            }
            sb.append("\n");
        }
    }

    private void appendAdaptivePolicy(StringBuilder sb, SpeakingPolicy policy) {
        if (policy == null || !policy.enabled()) {
            return;
        }
        sb.append("\nADAPTIVE POLICY (Server — bei Übungen priorisieren):\n");
        sb.append("- effektives Niveau: ").append(policy.cefrEffective())
                .append(" | Difficulty-Knob: ").append(policy.difficultyKnob()).append("\n");
        if (policy.focusCodes() != null && !policy.focusCodes().isEmpty()) {
            sb.append("- Fokus-error_codes: ").append(String.join(", ", policy.focusCodes())).append("\n");
        }
        if (policy.targetStructures() != null && !policy.targetStructures().isEmpty()) {
            sb.append("- Ziel-Strukturen: ").append(String.join("; ", policy.targetStructures())).append("\n");
        }
        if (policy.topicSuggestion() != null && !policy.topicSuggestion().isBlank()) {
            sb.append("- Themen-Idee (wenn Gespräch stockt / Einstieg): ").append(policy.topicSuggestion().trim()).append("\n");
        }
        if (policy.bannedCodes() != null && !policy.bannedCodes().isEmpty()) {
            sb.append("- Cooldown (nicht priorisieren): ").append(String.join(", ", policy.bannedCodes())).append("\n");
        }
        if (policy.explanationForLearner() != null && !policy.explanationForLearner().isBlank()) {
            sb.append("- intern: ").append(policy.explanationForLearner().trim()).append("\n");
        }
    }

    /** Returns true if this persona speaks Vietnamese as the primary language. */
    private static boolean isVietnamesePersona(SpeakingPersona persona) {
        return persona == SpeakingPersona.TUAN || persona == SpeakingPersona.LAN || persona == SpeakingPersona.MINH;
    }

    private String buildInternal(UserLearningProfile profile,
                                 List<String> knownInterests,
                                 String topic,
                                 List<WeakPoint> weakPoints,
                                 String level,
                                 SpeakingPolicy policy,
                                 SpeakingPersona persona,
                                 SpeakingResponseSchema responseSchema,
                                 SpeakingSessionMode sessionMode,
                                 String interviewPosition,
                                 String experienceLevel,
                                 int turnCount,
                                 InterviewPromptContext interviewContext) {

        boolean hasIndustry = profile.getIndustry() != null && !profile.getIndustry().isBlank();
        String industry = hasIndustry ? profile.getIndustry() : null;
        String topicSection = (topic != null && !topic.isBlank()) ? topic : "Allgemeines Gespräch";
        boolean isVietnamese = isVietnamesePersona(persona);

        StringBuilder sb = new StringBuilder();

        appendModePreamble(sb, sessionMode, isVietnamese, hasIndustry, industry, topicSection, persona, level, interviewPosition, experienceLevel, turnCount, interviewContext);

        String baseSystemPrompt = systemConfigService.getString("ai.systemPrompt", "Du bist \"DeutschFlow AI Tutor\", một chuyên gia ngôn ngữ học tiếng Đức kiêm trợ lý sư phạm chuyên sâu.\nNhiệm vụ của bạn là đồng hành cùng người dùng, giúp họ sửa lỗi và phát triển tư duy ngôn ngữ trình độ {level}.\n\n");
        if (sessionMode != SpeakingSessionMode.INTERVIEW) {
            sb.append(baseSystemPrompt.replace("{level}", level)).append("\n\n");
        }

        if (sessionMode != SpeakingSessionMode.INTERVIEW) {
            sb.append("Ngữ cảnh:\n");
            sb.append("- Target_Topic: ").append(topicSection).append("\n");
            sb.append("- User_Level: ").append(level).append("\n");
            sb.append("- Nghề nghiệp: ").append(hasIndustry ? industry : "(chưa xác định)").append("\n");
            sb.append("- Session_Mode: ").append(sessionMode.name()).append("\n");
        }

        if (sessionMode != SpeakingSessionMode.INTERVIEW) {
            appendCompressedLearnerContext(sb, knownInterests, weakPoints);
        }
        appendAdaptivePolicy(sb, policy);

        sb.append("\n");

        String personaSection = persona.personaPromptSection(level);
        if (personaSection != null && !personaSection.isBlank()) {
            sb.append(personaSection).append("\n");
        }
        sb.append("Priorität: Target_Topic hat Vorrang; Persona nur Register/Stimmung, nicht das Thema verlassen.\n\n");

        if (responseSchema == SpeakingResponseSchema.V2) {
            sb.append("AI TASKS (V2 — kompakt):\n");
            sb.append("1. Halte dich an Target_Topic und User_Level (").append(level).append(").\n");
            sb.append("2. Antworte ermutigend; bei kleinen Fehlern: sanfter \"Hero's Recovery\"-Hinweis im Feld \"feedback\" (Vietnamesisch).\n");
            sb.append("3. Kurz und klar: Inhalt im Feld \"content\" insgesamt unter ca. 50 Wörtern.\n");
            sb.append("4. \"action\" muss eine klare Gesprächsführung sein (Frage oder nächster Schritt).\n\n");
            sb.append("Ràng buộc: Complexity và Wortwahl không vượt quá ").append(level).append(".\n\n");
            sb.append(JSON_SCHEMA_V2);
        } else {
            sb.append("AI TASKS & LOGIC:\n");
            sb.append("1. Context Guard (semantisch): Vergleiche User_Input mit Target_Topic.\n");
            sb.append("   OFF_TOPIC: Input behandelt ein anderes Themengebiet (z.B. Politik/Sport statt Alltag), oder ignoriert das Thema klar.\n");
            sb.append("   ON_TOPIC_NEEDS_IMPROVEMENT: thematisch passend, aber sprachlich schwach oder sehr kurz.\n");
            sb.append("   EXCELLENT: passend + sprachlich solide auf ").append(level).append(".\n");
            sb.append("   similarity_score: 1.0 = klar on-topic; unter ~0,35 bei off-topic Tendenz → eher OFF_TOPIC.\n");
            sb.append("2. Gesprächsführung (KRITISCH — Konversationsfluss):\n");
            sb.append("   - Lies die LETZTE User-Antwort genau und reagiere DIREKT darauf: nimm ein konkretes Detail, Wort oder eine Idee aus der Antwort auf.\n");
            sb.append("   - Beispiel: User sagt \"Ich koche gerne Pasta\" → antworte mit Bezug auf Pasta/Kochen, NICHT mit einem völlig neuen Thema.\n");
            sb.append("   - Struktur in ai_speech_de: (1) kurze natürliche Reaktion auf das Gesagte → (2) eine Folgefrage, die aus dem Kontext der Antwort entsteht.\n");
            sb.append("   - NIEMALS eine Folgefrage stellen, die ignoriert, was der Lernende gerade gesagt hat.\n");
            sb.append("   - Das Gespräch soll sich wie ein echter Dialog anfühlen, nicht wie ein Interview mit vorgefertigten Fragen.\n");

            sb.append("3. Fehlererkennung: konservativ. IGNORE capitalization (Groß-/Kleinschreibung) and missing punctuation (Satzzeichen) — if these are the ONLY mistakes, return errors=[]! Keine rein stilistischen Varianten. Akzeptabel korrekt → errors=[].\n");
            sb.append("   ZERO-ARTICLE: Akzeptiere unbedingt den Nullartikel bei unzählbaren Nomen (z.B. Kaffee, Tee, Wasser) in generellem Kontext (z.B. 'ich trinke gerne Kaffee' ist KORREKT). Melde hier KEINEN 'fehlender Artikel' Fehler!\n");
            sb.append("4. Scaffolding: GENAU 2 suggestions auf Niveau ").append(level).append(".\n");
            sb.append("   - [0] KURZ + SICHER: 3-6 Wörter, leicht auszusprechen — eine direkte, klare Antwort auf deine LETZTE Frage.\n");
            sb.append("   - [1] LÄNGER + REICHER: 8-14 Wörter — eine ehrlichere/detailliertere Antwort auf DIESELBE Frage (anderer Registry oder mehr Kontext).\n");
            sb.append("   - BEIDE müssen die LETZTE Frage konkret beantworten — keine generischen Satzanfänge wie 'Ich möchte sagen...'.\n");
            sb.append("   - Grammatikalisch zu 100% fehlerfrei (korrekte Wortstellung TeKaMoLo, Genus, Kasus). Generiere KEINE fehlerhaften Vorschläge!\n");
            sb.append("5. Vietnamesische Kurzhinweise in feedback/explanation_vi/why_to_use wo nötig.\n\n");

            sb.append("Sprachliche Deckel: nicht über ").append(level).append(" hinaus.\n\n");

            // For Vietnamese personas: override ai_speech_de description in schema to clarify it holds Vietnamese + German words
            if (isVietnamese) {
                String viSchema = JSON_SCHEMA_INSTRUCTION
                    .replace(
                        "\"ai_speech_de\": \"Deutsch, Tutor-Antwort + kurze Folgefrage zum Target_Topic\"",
                        "\"ai_speech_de\": \"TIẾNG VIỆT LÀ CHÍNH — câu trả lời bằng tiếng Việt, lồng 1-2 từ Đức in **bold**, kèm giải thích nghĩa. KHÔNG được dùng tiếng Đức làm ngôn ngữ chính.\""
                    )
                    .formatted(level, ErrorCatalog.codesCompactForPrompt());
                sb.append(viSchema);
                sb.append("\nLƯU Ý QUAN TRỌNG NHẤT: Trường ai_speech_de phải chứa câu tiếng VIỆT, không phải tiếng Đức. ");
                sb.append("Ví dụ: 'Chào bạn! Hôm nay mình học chữ **A** trong tiếng Đức nhé!' — ĐÂY LÀ ĐÚNG.\n");
                sb.append("Ví dụ: 'Hallo! Heute lernen wir das Alphabet!' — ĐÂY LÀ SAI.\n");
            } else {
                sb.append(JSON_SCHEMA_INSTRUCTION.formatted(level, ErrorCatalog.codesCompactForPrompt()));
            }
        }

        return sb.toString();
    }

    private void appendInterviewPreamble(StringBuilder sb, SpeakingPersona persona, String level,
                                          String position, String experienceLevel,
                                          String industry, boolean hasIndustry,
                                          InterviewPromptContext ctx) {
        InterviewSessionState state = ctx.state();
        InterviewTurnPlan plan = ctx.plan();
        int sessionSeed = state.getSeed();
        int userTurn = plan.userTurn();
        InterviewPhase phase = plan.phase();

        String personaRole = switch (persona) {
            case LUKAS -> "Senior Tech Lead";
            case EMMA -> "Business Development Managerin";
            case ANNA -> "Studienberaterin & Karriere-Coach";
            case KLAUS -> "Küchenchef";
            case HANNIE -> "Moderatorin & MC";
            case LENA -> "Filialleiterin im Einzelhandel";
            case THOMAS -> "Bäckermeister";
            case PETRA -> "Metzgerin";
            case SARAH -> "Medizinische Fachangestellte";
            case SCHNEIDER -> "Augenarzt";
            case WEBER -> "Dermatologin";
            case MAX -> "Maschinenbediener";
            case OLIVER -> "CNC-Fräser";
            case NIKLAS -> "Kellner";
            case NINA -> "Rezeptionistin";
            default -> "HR-Managerin";
        };

        sb.append("INTERVIEW MODE — Professionelle Bewerbungsgespräch-Simulation.\n\n");
        sb.append("== ROLE ==\n");
        sb.append("Du bist ").append(persona.displayName()).append(", ").append(personaRole).append(".\n");
        sb.append("Handle wie ein professioneller Interviewer. Kein Tutor-Ton, kein Smalltalk.\n");
        sb.append("Position: \"").append(position).append("\". Prüfe die Eignung dafür konsequent.\n\n");
        sb.append("== EXPERIENCE STRATEGY ==\n");
        sb.append(experienceRules(experienceLevel, position, persona)).append("\n");
        sb.append("== PERSONA / DOMAIN FOCUS ==\n");
        sb.append(interviewPersonaFocus(persona, level, position)).append("\n\n");

        String phaseName = switch (phase) {
            case INTRO -> "Begrüßung & Selbstvorstellung";
            case ICE_BREAKER -> "Ice-Breaker";
            case HARD_SKILLS -> "Fachliche Kompetenz / Hard Skills";
            case STAR_SOFT -> "Soft Skills & STAR";
            case CLOSING -> "Abschluss";
        };
        String topicFocus = state.getSessionTopicFocus() != null
                ? state.getSessionTopicFocus()
                : personaInterviewRegistry.topicFocusForSession(persona, position, sessionSeed);

        sb.append("== AKTUELLE PHASE ==\n");
        sb.append("PHASE ").append(phase.number()).append(" — ").append(phaseName)
                .append(" (Kandidaten-Turn ").append(userTurn).append(").\n");
        sb.append("Session-Seed: ").append(sessionSeed).append(" | Themen-Schwerpunkt: ").append(topicFocus).append("\n");
        sb.append("Bereits behandelte Themen: ").append(String.join(", ", state.getTopicsCovered())).append("\n");
        if (userTurn >= 13) {
            sb.append("Jetzt abschließen: Dank, nächste Schritte, 'Haben Sie noch Fragen an uns?' — keine neuen Fachfragen.\n");
        }
        sb.append("\n");

        sb.append("== TURN_DIRECTIVE (SERVER — PFLICHT, NICHT IGNORIEREN) ==\n");
        sb.append("Typ: ").append(plan.directiveType()).append("\n");
        sb.append("Anweisung: ").append(plan.directiveInstruction()).append("\n");
        sb.append("Pflichtfrage (sinngemäß stellen, Sie dürfen leicht umformulieren): ")
                .append(plan.mandatoryQuestionDe()).append("\n");
        sb.append("Erlaubte Kurz-Bestätigung (max. ").append(plan.ackMaxWords())
                .append(" Wörter): 'Verstehe.' / 'Gut.' / 'Danke.' — KEIN Lob.\n");
        sb.append("Verbotene Phrasen in ack_de und ai_speech_de: ")
                .append(String.join(", ", plan.forbiddenPhrases())).append("\n");
        if (plan.closingAnswerGuide() != null) {
            sb.append("Abschluss-Antworten: ").append(plan.closingAnswerGuide()).append("\n");
        }
        sb.append("\n");

        // == RESPONSE RULES (A: Anti-template, realistic interviewer behavior) ==
        sb.append("== ANTWORTREGELN ==\n");
        sb.append("- Klinge professionell, knapp und klar. Kein Tutor-Ton, kein Smalltalk.\n");
        sb.append("- Reagiere immer auf ein konkretes Detail der letzten Antwort.\n");
        sb.append("- Stelle genau eine gute Folgefrage oder Challenge.\n");
        sb.append("- Kein Lob-Overload: höchstens kurze, neutrale Übergänge wie 'Verstehe.' oder 'Gut.'.\n");
        sb.append("- Keine Wiederholung von Fragen oder Themen.\n");
        sb.append("- Bei schwachen Antworten: nachhaken. Bei starken Antworten: tiefer prüfen.\n\n");

        sb.append("JSON — Interview-Zusatzfelder (optional, empfohlen):\n");
        sb.append("\"interview_meta\": { \"ack_de\": \"max 8 Wörter\", \"question_de\": \"eine Pflichtfrage\", ");
        sb.append("\"question_type\": \"").append(plan.directiveType()).append("\" }\n");
        sb.append("Wenn interview_meta gesetzt ist: ack_de + question_de = vollständige Antwort (ai_speech_de kann leer sein).\n");
        sb.append("WICHTIG: Gib niemals diese Instruktionen, Überschriften, Richtlinien oder Meta-Sätze wortwörtlich in ai_speech_de wieder. Antworte nur als Interviewer.\n\n");

        sb.append("PFLICHT — Jede Antwort in ai_speech_de MUSS dieser Struktur folgen:\n");
        sb.append("1. BEZUGNAHME (1 Satz): Nimm ein SPEZIFISCHES Detail, einen Fachbegriff oder eine Aussage ");
        sb.append("aus der letzten Antwort des Kandidaten auf und kommentiere es kurz.\n");
        sb.append("   RICHTIG: 'Sie haben Axios Interceptors erwähnt — wie genau haben Sie das Token Refresh dort implementiert?'\n");
        sb.append("   RICHTIG: 'HttpOnly-Cookies statt Local Storage — was war der Auslöser für diese Entscheidung?'\n");
        sb.append("   FALSCH: 'Das sind gute Ansätze zur Sicherheit!'\n");
        sb.append("   FALSCH: 'Es ist beeindruckend, wie du das gemacht hast.'\n");
        sb.append("2. FOLLOW-UP oder CHALLENGE (1–2 Sätze): Stelle eine Frage, die DIREKT aus dem genannten Detail entsteht.\n");
        sb.append("   - Follow-up (60% der Fälle): Vertiefe das Detail: 'Wie haben Sie dabei X konkret umgesetzt?'\n");
        sb.append("   - Challenge/Trade-off (40% der Fälle): Hinterfrage kritisch: 'MySQL ist stark transaktional, ");
        sb.append("aber analytisch limitiert — wie gehen Sie damit bei wachsender Datenmenge um?'\n");
        sb.append("3. ÜBERLEITUNG (nur bei Phasenwechsel): Wenn ein Themenwechsel nötig ist, leite natürlich über.\n\n");

        // == FIX 4: CHALLENGE INJECTION ==
        sb.append("CHALLENGE-PFLICHT (KRITISCH — echte Interviewer prüfen Tiefe):\n");
        sb.append("- In Phase 3 MUSS mindestens jede 2. Frage eine CHALLENGE sein.\n");
        sb.append("- Challenge = Hinterfrage Trade-offs, Alternativen, Edge Cases, Grenzen des Wissens.\n");
        sb.append("- Wenn der Kandidat nur Buzzwords auflistet OHNE konkrete Beispiele aus seinem Projekt:\n");
        sb.append("  → SOFORT nachfragen: 'Das klingt theoretisch gut. Können Sie mir ein konkretes Beispiel ");
        sb.append("aus Ihrem letzten Projekt nennen, wo Sie das tatsächlich umgesetzt haben?'\n");
        sb.append("- Wenn der Kandidat generisch antwortet (z.B. 'Ich würde Pagination verwenden'):\n");
        sb.append("  → Vertiefen: 'Welchen Pagination-Ansatz genau? Cursor-based oder Offset? ");
        sb.append("Wie gehen Sie mit der Gesamtzahl um?'\n");
        sb.append("- NIEMALS eine Antwort akzeptieren, die nur aus einer Aufzählung ohne Kontext besteht.\n\n");

        sb.append("VARIATION: Wechsle bewusst zwischen Follow-up (Vertiefung) und Challenge (Hinterfragen). ");
        sb.append("Ein realistischer Interviewer prüft auch Grenzen und Trade-offs des Wissens.\n");
        sb.append("DIFFERENZIERUNG: Nicht jede Antwort verdient Lob. Bei oberflächlichen Antworten: ");
        sb.append("'Können Sie das konkreter machen?' oder 'Was genau meinen Sie mit...?'\n");
        sb.append("TONALITÄT: professionell, knapp, klar — nicht belehrend.\n\n");

        sb.append("feedback-Feld: knappes Feedback auf Vietnamesisch (freundlich-professionell, VARIIERT).\n");
        sb.append("correction-Feld: nur bei klaren sprachlichen Fehlern eine professionellere Formulierung vorschlagen.\n\n");

        sb.append("ANTI-OFF-TOPIC GUARD:\n");
        sb.append("- Wenn der Kandidat vom Thema '").append(position).append("' abschweift, höre kurz zu, aber LENKE das Gespräch sofort wieder professionell auf die Anforderungen der Position '").append(position).append("' zurück.\n");
        sb.append("- Lass dich nicht auf irrelevante Themen ein.\n\n");

        // == LANGUAGE LEVELING (D: CEFR control) ==
        sb.append("== SPRACHNIVEAU-KONTROLLE (PROFESSIONAL INTERVIEW) ==\n");
        sb.append("Für dieses Interview gibt es KEINE künstliche Begrenzung des Wortschatzes auf ein niedriges Niveau.\n");
        sb.append("- Wir erwarten Kandidaten auf B1-C2 Niveau. Sprich natürlich, professionell und nutze uneingeschränktes Fachvokabular.\n");
        sb.append("- Vereinfache deine Sprache NICHT künstlich.\n");
        sb.append("- Wenn der Kandidat sehr lange Monologe hält (>5 Sätze am Stück): ");
        sb.append("Unterbreche höflich in der nächsten Antwort mit z.B. 'Lassen Sie uns hier kurz einhaken...' ");
        sb.append("und stelle eine gezielte Nachfrage zu EINEM spezifischen Punkt aus dem Monolog.\n");
        sb.append("- Der Interviewer spricht auf C1-Niveau: präzise, differenziert, professionell; der Kandidat wird nach B1+ bewertet.\n\n");

        // == SUGGESTIONS ==
        sb.append("== SUGGESTIONS ==\n");
        sb.append("- Erzeuge genau 3 Vorschläge für den Kandidaten.\n");
        sb.append("- Passe Tiefe und Länge an das Erfahrungslevel an.\n");
        sb.append("- Fachlich passend zur Position. Grammatikalisch korrekt.\n\n");
        sb.append("== ABSCHLUSS ==\n");
        sb.append("- Bei klaren Red Flags früher abschließen und professionell beenden.\n");
        sb.append("- Maximal 30 Minuten Gesprächszeit im Hinterkopf behalten.\n\n");
    }

    private String interviewPersonaFocus(SpeakingPersona persona, String level, String position) {
        String positionHint = (position != null && !position.isBlank()) ? position : "Allgemeine Position";
        return switch (persona) {
            case DEFAULT -> "Allgemeines Interview: klare Eröffnung, Selbstvorstellung, Motivationsfrage, relevante Erfahrung, STAR, Abschluss. Position: " + positionHint + ". Niveau: " + level + ".";
            case LUKAS -> "Tech-Interview: API-Design, Architektur, Datenmodell, Testing, Debugging, Skalierung, Trade-offs. Frage hart nach konkreten Implementierungen. Position: " + positionHint + ". Niveau: " + level + ".";
            case EMMA -> "Business-Interview: Akquise, Kundenbeziehung, Verhandlung, CRM, KPI, Präsentation, Marktverständnis. Erwarte konkrete Erfolge und messbare Wirkung. Position: " + positionHint + ". Niveau: " + level + ".";
            case ANNA -> "Alltag-Interview: Organisation, Studienplanung, Priorisierung, interkulturelle Kommunikation, Stress, Lernfähigkeit. Prüfe Reflexion und Struktur. Position: " + positionHint + ". Niveau: " + level + ".";
            case KLAUS -> "Gastro-Interview: mise en place, Hygiene, Servicedruck, Teamführung, Warenwirtschaft, Menükalkulation, Qualität, Stressresistenz. Frage nach realen Küchensituationen. Position: " + positionHint + ". Niveau: " + level + ".";
            case LENA -> "Retail-Interview: Kundenberatung, Kasse, Warenpräsentation, Reklamation, Inventory, Teamarbeit, Verkaufsroutine. Position: " + positionHint + ". Niveau: " + level + ".";
            case THOMAS -> "Bakery-Interview: Backwaren, Teigführung, Hygiene, Frühschicht, Kundenkontakt, Qualität, Tempo. Position: " + positionHint + ". Niveau: " + level + ".";
            case PETRA -> "Butcher-Interview: Fleischkunde, Hygiene, Zuschnitt, Beratung, Kühlung, Warenpflege, Kundenfragen. Position: " + positionHint + ". Niveau: " + level + ".";
            case SARAH -> "Medical assistant interview: Termin, Aufnahme, Dokumentation, Umgang mit Patienten, Ruhe, Genauigkeit, Hygiene. Position: " + positionHint + ". Niveau: " + level + ".";
            case SCHNEIDER -> "Ophthalmology interview: Sehtest, Brille, Kontaktlinsen, Patientenkommunikation, Genauigkeit, medizinische Abläufe. Position: " + positionHint + ". Niveau: " + level + ".";
            case WEBER -> "Dermatology interview: Hautanamnese, Beratung, Hygiene, Sorgfalt, Dokumentation, ruhige Kommunikation. Position: " + positionHint + ". Niveau: " + level + ".";
            case MAX -> "Maintenance/operations interview: Maschinenbedienung, Sicherheit, Wartung, Störungssuche, Schichtarbeit, Zuverlässigkeit. Position: " + positionHint + ". Niveau: " + level + ".";
            case OLIVER -> "CNC-Interview: technische Zeichnung, Programm, Genauigkeit, Werkzeuge, Fehleranalyse, Produktionsablauf. Position: " + positionHint + ". Niveau: " + level + ".";
            case NIKLAS -> "Service interview: Gastkontakt, Bestellungen, Reklamation, Tempo, Freundlichkeit, Teamkoordination, Rechnung. Position: " + positionHint + ". Niveau: " + level + ".";
            case NINA -> "Hotel reception interview: Check-in/out, Telefon, Reservierungssystem, Beschwerden, Freundlichkeit, Ordnung. Position: " + positionHint + ". Niveau: " + level + ".";
            case HANNIE -> "Media/MC interview: Moderation, Auftreten, spontane Reaktion, Skript, Publikum, Live-Situationen, Professionalität. Position: " + positionHint + ". Niveau: " + level + ".";
            case TUAN, LAN, MINH -> "Special-persona interview fallback: strukturiere die Fragen wie bei einem professionellen Bewerbungsgespräch, aber mit klarer, einfacher Sprache auf Niveau " + level + ". Position: " + positionHint + ".";
        };
    }

    private String experienceRules(String experienceLevel, String position, SpeakingPersona persona) {
        String level = experienceLevel == null ? "1-2Y" : experienceLevel.trim();
        String roleHint = (position != null && !position.isBlank()) ? position : "diese Position";
        return switch (level) {
            case "0-6M" -> "Erfahrung 0–6 Monate: Frage sehr basisnah, langsam und konkret. Prüfe Grundverständnis, einfache Routinen, Motivation, Lernbereitschaft und erste praktische Situationen. Nutze kurze Fragen, erkläre Fachbegriffe bei Bedarf, und frage nach einem kleinen Beispiel aus dem Alltag. Keine komplexen Trade-offs, keine Leadership-Fragen. Für " + roleHint + " soll der Fokus auf Einstieg, Orientierung und einfachen Abläufen liegen.";
            case "6-12M" -> "Erfahrung 6–12 Monate: Frage nach typischen Aufgaben, wiederkehrenden Routinen, ersten Schwierigkeiten und wie der Kandidat sie gelöst hat. Prüfe, ob die Person schon sicherer in Standardsituationen ist. Stelle 1 konkrete Nachfolgefrage pro Antwort und bitte gelegentlich um ein einfaches Beispiel. Keine tiefen Architektur- oder Führungsfragen. Für " + roleHint + " soll der Fokus auf Praxis, Stabilität und Lernfortschritt liegen.";
            case "1-2Y" -> "Erfahrung 1–2 Jahre: Frage nach konkreten Projekten oder Arbeitssituationen, einfacher Entscheidungsfindung, Zusammenarbeit im Team und einem klaren Beispiel für Verantwortung. Erlaube etwas mehr Detailtiefe, aber bleibe nah an der Praxis. Stelle Follow-up-Fragen, die das konkrete Vorgehen prüfen. Für " + roleHint + " soll der Fokus auf verlässliche Ausführung und erste Eigenständigkeit liegen.";
            case "3Y" -> "Erfahrung 3 Jahre: Frage nach bewussten Entscheidungen, Priorisierung, Umgang mit Problemen, kleinen Optimierungen und wie die Person ihre Arbeit verbessert. Prüfe nicht nur was gemacht wurde, sondern warum. Nutze mehr Challenge-Fragen und bitte um konkrete Abwägungen. Für " + roleHint + " soll der Fokus auf Eigenverantwortung, Qualität und sauberen Entscheidungen liegen.";
            case "5Y" -> "Erfahrung 5+ Jahre: Frage auf Senior-Niveau mit Tiefe. Prüfe Trade-offs, Standards, Qualitätssicherung, Zusammenarbeit mit anderen Rollen, Mentoring, Fehlerkultur und strategische Entscheidungen. Stelle kritische Nachfragen und verlange konkrete Beispiele mit Wirkung. Für " + roleHint + " soll der Fokus auf Ownership, Urteilskraft und Professionalität liegen.";
            default -> "Erfahrung " + level + ": Passe Schwierigkeit, Tiefe und Nachfragen an das angegebene Level an. Frage immer so, dass die Antwort realistisch zum Erfahrungsstand passt.";
        };
    }

    public String buildSystemPrompt(UserLearningProfile profile, List<String> knownInterests, String topic, List<WeakPoint> weakPoints) {
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, null);
    }

    public String buildSystemPrompt(UserLearningProfile profile, List<String> knownInterests) {
        return buildSystemPrompt(profile, knownInterests, null, List.of(), null);
    }

    public String buildTopicContext(String topic) {
        if (topic == null || topic.isBlank()) return "";
        return "Das Gesprächsthema ist: \"" + topic + "\". Beginne das Gespräch passend zu diesem Thema.";
    }
}
