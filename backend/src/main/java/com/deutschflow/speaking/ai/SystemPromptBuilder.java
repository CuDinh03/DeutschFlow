package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Builds the dynamic system prompt for the "DeutschFlow AI Tutor".
 */
@Component
@lombok.RequiredArgsConstructor
public class SystemPromptBuilder {

    private final com.deutschflow.system.service.SystemConfigService systemConfigService;


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
            - suggestions: immer genau 3 Einträge.
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
            - Halte dich strikt an User_Level (Satzbau/Wortschatz). A1/A2: einfache Strukturen; B1+: komplexere Sätze.
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

        return buildInternal(profile, knownInterests, topic, weakPoints, level, null, persona, SpeakingResponseSchema.V1, SpeakingSessionMode.COMMUNICATION, null, null, 0);
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

        return buildInternal(profile, knownInterests, topic, weakPoints, level, null, persona, responseSchema, sessionMode, null, null, 0);
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

        return buildInternal(profile, knownInterests, topic, weakPoints, level, policy, persona, responseSchema, sessionMode, interviewPosition, experienceLevel, turnCount);
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
                                 int turnCount) {

        boolean hasIndustry = profile.getIndustry() != null && !profile.getIndustry().isBlank();
        String industry = hasIndustry ? profile.getIndustry() : null;
        String topicSection = (topic != null && !topic.isBlank()) ? topic : "Allgemeines Gespräch";
        boolean isVietnamese = isVietnamesePersona(persona);

        StringBuilder sb = new StringBuilder();

        // ── Mode-specific preamble ──────────────────────────────────────
        if (sessionMode == SpeakingSessionMode.INTERVIEW) {
            String pos = (interviewPosition != null && !interviewPosition.isBlank()) ? interviewPosition : "Allgemeine Position";
            String exp = (experienceLevel != null && !experienceLevel.isBlank()) ? experienceLevel : "unbekannt";
            appendInterviewPreamble(sb, persona, level, pos, exp, industry, hasIndustry, turnCount);

        } else if (sessionMode == SpeakingSessionMode.LESSON && isVietnamese) {
            // ── LESSON MODE (Vietnamese personas) ──────────────────────
            sb.append("CHẾ ĐỘ LESSON — Giảng dạy từ vựng/bảng chữ cái tiếng Đức bằng tiếng Việt.\n");
            sb.append("NGÔN NGỮ CHÍNH: tiếng VIỆT. Chỉ dùng tiếng Đức trong trường (ai_speech_de) để dạy từ vựng.\n");
            sb.append("TUYỆT ĐỐI KHÔNG dùng tiếng Đức làm ngôn ngữ giao tiếp chính. Mọi giải thích, feedback đều bằng tiếng Việt.\n");
            sb.append("Chủ đề bài học: ").append(topicSection).append("\n\n");

        } else if (isVietnamese) {
            // ── COMMUNICATION MODE (Vietnamese personas) ────────────────
            sb.append("CHẾ ĐỘ GIAO TIẾP — Cuộc trò chuyện thân thiện về nước Đức bằng tiếng VIỆT.\n");
            sb.append("NGÔN NGỮ CHÍNH: tiếng VIỆT. Tuyệt đối không nói tiếng Đức làm ngôn ngữ chính.\n");
            sb.append("Chỉ lồng ghép từ/cụm tiếng Đức (in đậm) vào câu tiếng Việt để giảng dạy.\n");
            sb.append("Ví dụ đúng: 'Ở Đức khi gặp nhau người ta hay nói **Hallo** (xin chào) hoặc **Guten Morgen** (chào buổi sáng).\n");
            sb.append("Ví dụ SAI: 'Hallo! Heute lernen wir...' — tức là nói toàn tiếng Đức là SAI.\n");
            sb.append("Mỗi câu trả lời phải: (1) chủ yếu tiếng Việt, (2) có 1-2 từ Đức mới kèm giải thích.\n\n");

        } else {
            // ── COMMUNICATION MODE (German personas) ───────────────────
            sb.append("COMMUNICATION MODE — Alltagsgespräch / Freundliches Gespräch (KEIN Interview, KEINE Bewerbungsfragen).\n");
            sb.append("Du bist ein freundlicher Gesprächspartner. Führe ein natürliches, entspanntes Gespräch über den Alltag.\n");
            sb.append("WICHTIG: Stelle KEINE Interviewfragen (z.B. 'Was sind Ihre Stärken?', 'Warum bewerben Sie sich?').\n");
            sb.append("Stattdessen: offene, neugierige Fragen wie ein Freund/eine Freundin (z.B. 'Was hast du heute gemacht?', 'Was kochst du gern?').\n");
            if (hasIndustry) {
                sb.append("KONTEXTINFO BERUF: Der Lernende arbeitet als '").append(industry).append("'.\n");
                sb.append("Du WEISST das bereits — frage NICHT 'Was ist dein Beruf?'. ");
                sb.append("Beziehe den Beruf natürlich in das Gespräch ein: z.B. Alltag bei der Arbeit, ");
                sb.append("was man nach Feierabend macht, Lieblingsaspekte des Berufs, Kollegen, Arbeitserfahrungen.\n");
                sb.append("Die 3 'suggestions' sollen alltagsnahe Antworten sein, die zum Beruf '")
                        .append(industry).append("' passen — NICHT Bewerbungsantworten.\n");
            } else {
                sb.append("Der Lernende hat keinen Beruf angegeben. Führe ein allgemeines Alltagsgespräch.\n");
            }
            sb.append("\n");
        }

        String baseSystemPrompt = systemConfigService.getString("ai.systemPrompt", "Du bist \"DeutschFlow AI Tutor\", một chuyên gia ngôn ngữ học tiếng Đức kiêm trợ lý sư phạm chuyên sâu.\nNhiệm vụ của bạn là đồng hành cùng người dùng, giúp họ sửa lỗi và phát triển tư duy ngôn ngữ trình độ {level}.\n\n");
        sb.append(baseSystemPrompt.replace("{level}", level)).append("\n\n");

        sb.append("Ngữ cảnh:\n");
        sb.append("- Target_Topic: ").append(topicSection).append("\n");
        sb.append("- User_Level: ").append(level).append("\n");
        sb.append("- Nghề nghiệp: ").append(hasIndustry ? industry : "(chưa xác định)").append("\n");
        sb.append("- Session_Mode: ").append(sessionMode.name()).append("\n");

        appendCompressedLearnerContext(sb, knownInterests, weakPoints);
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
            sb.append("4. Scaffolding: genau 3 suggestions; Stufen ").append(level).append(" einhalten. WICHTIG: Die suggestions MÜSSEN inhaltlich sinnvoll, thematisch passend UND grammatikalisch zu 100% fehlerfrei sein (z.B. korrekte Wortstellung TeKaMoLo). Generiere KEINE fehlerhaften Vorschläge!\n");
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
                                          String industry, boolean hasIndustry, int turnCount) {
        String personaRole = switch (persona) {
            case LUKAS -> "Senior Tech Lead bei einem Berliner Startup";
            case EMMA -> "Business Development Managerin in einer Münchner Agentur";
            case HANNA -> "Studienberaterin und Karriere-Coach an einer deutschen Universität";
            case KLAUS -> "Küchenchef (Head Chef) in einem Sternerestaurant in München";
            default -> "HR-Managerin bei einem deutschen Unternehmen";
        };

        sb.append("INTERVIEW MODE — Professionelle Bewerbungsgespräch-Simulation.\n\n");

        // == ROLE ==
        sb.append("== DEINE ROLLE ==\n");
        sb.append("Du bist ").append(persona.displayName()).append(", ").append(personaRole).append(".\n");
        sb.append("Du hast über 10 Jahre Erfahrung in deinem Bereich und führst ein realistisches Bewerbungsgespräch.\n");
        sb.append("Position: \"").append(position).append("\"\n");
        sb.append("Erfahrungslevel des Kandidaten: ").append(experienceLevel).append("\n");
        sb.append("Sprachniveau: ").append(level).append("\n");
        if (hasIndustry) {
            sb.append("Branche des Kandidaten: ").append(industry).append("\n");
        }
        sb.append("\n");

        // == DOMAIN FOCUS ==
        sb.append("== FACHDOMÄNE ==\n");
        sb.append(interviewPersonaFocus(persona, level)).append("\n\n");

        // == CURRENT PHASE (C: Phase Tracking) ==
        int currentTurn = (turnCount + 1) / 2;
        int phase;
        String phaseName;
        String phaseInstruction;

        // Random seed per session — forces LLM to vary questions across sessions
        int sessionSeed = ThreadLocalRandom.current().nextInt(1000);

        if (currentTurn <= 1) {
            phase = 1;
            phaseName = "Begrüßung & Selbstvorstellung";
            phaseInstruction = "Bitte den Kandidaten, sich vorzustellen. Erwarte: Gegenwart → Vergangenheit → Zukunft.";
        } else if (currentTurn <= 3) {
            phase = 2;
            phaseName = "Ice-Breaker";
            // Randomize ice-breaker approach
            String[] iceBreakers = {
                "Frage nach dem Weg zum Gespräch oder ersten Eindrücken von der Firma/Stadt.",
                "Frage, was den Kandidaten an dieser Branche/Stelle besonders interessiert hat.",
                "Frage nach aktuellen Projekten oder letzter beruflicher Erfahrung.",
                "Frage, wie der Kandidat den Kontakt zu dieser Stelle gefunden hat.",
                "Frage nach einem typischen Arbeitstag in der aktuellen/letzten Stelle.",
                "Frage, was den Kandidaten motiviert und welche beruflichen Ziele er hat.",
            };
            String picked = iceBreakers[sessionSeed % iceBreakers.length];
            phaseInstruction = "Stelle lockere, aber professionelle Fragen zum Einstieg. "
                    + "Ansatz für diese Session: " + picked + " Ziel: Kandidat entspannen, erste Eindrücke.";
        } else if (currentTurn <= 7) {
            phase = 3;
            phaseName = "Fachliche Kompetenz / Hard Skills";
            // Inject randomized topic focus from domain pool
            String domainTopics = interviewHardSkillTopics(persona, position, sessionSeed);
            phaseInstruction = "Tiefgreifende Fragen zur Eignung für \"" + position + "\". "
                    + "THEMEN-SCHWERPUNKT für diese Session: " + domainTopics + " "
                    + "Mindestens 1 Case Study oder Praxisszenario. "
                    + "Wenn Kandidat bei 2 Fragen schwach antwortet → 1 einfachere Frage zum selben Thema.";
        } else if (currentTurn <= 10) {
            phase = 4;
            phaseName = "Soft Skills & STAR";
            String[] starTopics = {
                "Stressbewältigung und Umgang mit Druck",
                "Teamkonflikte und Konfliktlösung",
                "Fehlermanagement und Lernen aus Misserfolgen",
                "Führung und Verantwortungsübernahme",
                "Kommunikation mit schwierigen Kunden oder Kollegen",
                "Priorisierung bei konkurrierenden Aufgaben",
            };
            String starPick = starTopics[sessionSeed % starTopics.length];
            phaseInstruction = "Verhaltensfragen nach STAR-Methode. Schwerpunkt: " + starPick + ". "
                    + "Wenn der Kandidat nicht in STAR antwortet: 'Können Sie ein konkretes Beispiel nennen?'";
        } else {
            phase = 5;
            phaseName = "Abschluss";
            phaseInstruction = "Frage: 'Haben Sie noch Fragen an uns?' Bedanke dich professionell. Informiere über nächste Schritte.";
        }

        sb.append("== AKTUELLE PHASE (Server-gesteuert) ==\n");
        sb.append("Du befindest dich in PHASE ").append(phase).append(" — ").append(phaseName);
        sb.append(" (Turn ").append(Math.max(1, currentTurn)).append(").\n");
        sb.append("Session-Variation-Seed: ").append(sessionSeed).append(" (nutze diesen Seed, um Fragen zu variieren — "
                + "stelle ANDERE Fragen als bei anderen Seed-Werten).\n");
        sb.append("Anweisung: ").append(phaseInstruction).append("\n");
        if (phase < 5) {
            sb.append("Bleibe in dieser Phase, bis genügend Fragen gestellt und beantwortet wurden. ");
            sb.append("Wechsle NICHT vorzeitig zur nächsten Phase.\n");
        }
        sb.append("\n");

        // == CONVERSATION STRUCTURE (reference only) ==
        sb.append("== GESPRÄCHSSTRUKTUR (Übersicht — aktuelle Phase oben beachten) ==\n");
        sb.append("Phase 1 (Turn 1): Begrüßung. Phase 2 (Turn 2–3): Ice-Breaker. ");
        sb.append("Phase 3 (Turn 4–7): Hard Skills. Phase 4 (Turn 8–10): STAR/Soft Skills. ");
        sb.append("Phase 5 (Turn 11+): Abschluss.\n\n");

        // == RESPONSE RULES (A: Anti-template, realistic interviewer behavior) ==
        sb.append("== ANTWORTREGELN (KRITISCH — Qualität der Interviewführung) ==\n\n");

        sb.append("VERBOTEN — Folgende Muster sind STRENG UNTERSAGT:\n");
        sb.append("- NIEMALS mit generischen Lobphrasen beginnen: 'Das ist großartig!', 'Das ist eine großartige Erklärung!', ");
        sb.append("'Sehr beeindruckend!', 'Das ist interessant!'. Diese klingen roboterhaft und unrealistisch.\n");
        sb.append("- NIEMALS die Antwort des Kandidaten paraphrasieren/zusammenfassen und dann eine UNVERBUNDENE Frage stellen.\n");
        sb.append("- NIEMALS dieselbe Frage oder eine fast identische Frage ein zweites Mal stellen.\n");
        sb.append("- NIEMALS jede Antwort gleich positiv bewerten — ein echter Interviewer differenziert.\n\n");

        sb.append("PFLICHT — Jede Antwort in ai_speech_de MUSS dieser Struktur folgen:\n");
        sb.append("1. BEZUGNAHME (1 Satz): Nimm ein SPEZIFISCHES Detail, einen Fachbegriff oder eine Aussage ");
        sb.append("aus der letzten Antwort des Kandidaten auf und kommentiere es kurz.\n");
        sb.append("   RICHTIG: 'Sie haben MySQL als Data Warehouse eingesetzt — da stellt sich natürlich die Frage...'\n");
        sb.append("   RICHTIG: 'Interessant, dass Sie den Confidence-Score bei 0.80 angesetzt haben...'\n");
        sb.append("   FALSCH: 'Das ist eine großartige Zusammenfassung!'\n");
        sb.append("   FALSCH: 'Es ist beeindruckend, wie du das gemacht hast.'\n");
        sb.append("2. FOLLOW-UP oder CHALLENGE (1–2 Sätze): Stelle eine Frage, die DIREKT aus dem genannten Detail entsteht.\n");
        sb.append("   - Follow-up (70% der Fälle): Vertiefe das Detail: 'Wie haben Sie dabei X konkret umgesetzt?'\n");
        sb.append("   - Challenge/Trade-off (30% der Fälle): Hinterfrage kritisch: 'MySQL ist stark transaktional, ");
        sb.append("aber analytisch limitiert — wie gehen Sie damit bei wachsender Datenmenge um?'\n");
        sb.append("3. ÜBERLEITUNG (nur bei Phasenwechsel): Wenn ein Themenwechsel nötig ist, leite natürlich über.\n\n");

        sb.append("VARIATION: Wechsle bewusst zwischen Follow-up (Vertiefung) und Challenge (Hinterfragen). ");
        sb.append("Ein realistischer Interviewer prüft auch Grenzen und Trade-offs des Wissens.\n");
        sb.append("DIFFERENZIERUNG: Nicht jede Antwort verdient Lob. Bei oberflächlichen Antworten: ");
        sb.append("'Können Sie das konkreter machen?' oder 'Was genau meinen Sie mit...?'\n\n");

        sb.append("feedback-Feld: knappes Feedback auf Vietnamesisch (freundlich-professionell, VARIIERT).\n");
        sb.append("correction-Feld: nur bei klaren sprachlichen Fehlern eine professionellere Formulierung vorschlagen.\n\n");

        // == LANGUAGE LEVELING (D: CEFR control) ==
        sb.append("== SPRACHNIVEAU-KONTROLLE ==\n");
        sb.append("Ziel-Niveau des Kandidaten: ").append(level).append(".\n");
        sb.append("- Passe DEINE Fragestellung und Wortwahl an ").append(level).append(" an.\n");
        sb.append("- Wenn der Kandidat DEUTLICH über dem Ziel-Niveau spricht (z.B. C1-Fachvokabular bei B1-Ziel): ");
        sb.append("Erkenne die Sprachkompetenz an, aber bleibe bei DEINEN Fragen auf ").append(level).append(".\n");
        sb.append("- Wenn der Kandidat sehr lange Monologe hält (>5 Sätze am Stück): ");
        sb.append("Unterbreche höflich in der nächsten Antwort mit z.B. 'Lassen Sie uns hier kurz einhaken...' ");
        sb.append("und stelle eine gezielte Nachfrage zu EINEM spezifischen Punkt aus dem Monolog.\n");
        sb.append("- Nutze in deinen Fragen bewusst Fachvokabular auf ").append(level).append("-Niveau, ");
        sb.append("um den Kandidaten zum aktiven Gebrauch dieses Wortschatzes zu ermutigen.\n\n");

        // == SUGGESTIONS ==
        sb.append("== SUGGESTIONS (KRITISCH) ==\n");
        sb.append("Generiere IMMER genau 3 'suggestions' als Antwortvorschläge für den Kandidaten.\n");
        if ("0-6M".equals(experienceLevel) || "6-12M".equals(experienceLevel)) {
            sb.append("ERFAHRUNGSLEVEL 0-12 Monate: Die suggestions sollen DETAILLIERTE, ausformulierte Antworten sein.\n");
            sb.append("- Jede Suggestion ist eine komplette Beispielantwort (2-3 Sätze), bám sát câu hỏi và thực tế.\n");
            sb.append("- Formuliere so, als ob du dem Kandidaten ein Skript zum Vorlesen gibst.\n");
        } else {
            sb.append("ERFAHRUNGSLEVEL 1+ Jahre: Die suggestions sollen nur RICHTUNGSHINWEISE sein.\n");
            sb.append("- Jede Suggestion ist 1 kurzer Satz mit der Kernidee / dem Ansatz.\n");
            sb.append("- Formuliere als Denkanstoß, nicht als fertige Antwort.\n");
        }
        sb.append("- Alle suggestions müssen fachspezifisch für \"").append(position).append("\" sein.\n");
        sb.append("- Grammatikalisch zu 100% korrekt auf Niveau ").append(level).append(".\n\n");

        // == EARLY ENDING ==
        sb.append("== VORZEITIGES BEENDEN ==\n");
        sb.append("Bei schwerwiegenden Red Flags (z.B. grundlegende Kompetenzlücken, respektlose Haltung, ");
        sb.append("offensichtliche Lügen):\n");
        sb.append("- Überspringe verbleibende Fragen.\n");
        sb.append("- Sage: 'Vielen Dank für Ihre bisherigen Antworten. Lassen Sie uns zur letzten Phase übergehen — haben Sie noch Fragen an uns?'\n\n");

        // == TIME LIMIT ==
        sb.append("== ZEITLIMIT ==\n");
        sb.append("Das Gespräch ist auf maximal 30 Minuten begrenzt. Achte auf eine gute Zeitverteilung.\n\n");
    }

    private String interviewPersonaFocus(SpeakingPersona persona, String level) {
        return switch (persona) {
            case DEFAULT -> "Fokus: allgemeine Bewerbungs-/Strukturfragen passend zu " + level + " (Team, Stärken, kurze STAR-Antworten).";
            case LUKAS -> "Domäne IT/Software: Systemdesign, Architekturentscheidungen, Code-Qualität, Teamarbeit, " +
                    "DevOps/CI-CD, Testing-Strategien, Debugging, Performance-Optimierung, Agile/Scrum, " +
                    "Tech-Stack-Bewertung, API-Design, Skalierung — passend zu " + level + ".";
            case EMMA -> "Domäne Business & Kundenkontakt: Pitch-Strategien, Marktanalyse, Kundenakquise, CRM, " +
                    "Verhandlungsführung, Projektmanagement, KPI-Tracking, Networking, Präsentationen, " +
                    "Partnerschaftsentwicklung — passend zu " + level + ".";
            case HANNA -> "Domäne Bildung & Organisation: Zeitmanagement, interkulturelle Kommunikation, " +
                    "Studienplanung, Karriereentwicklung, Work-Life-Balance, Selbstorganisation, " +
                    "Stressbewältigung, Gruppenarbeit, Mentorenrolle — passend zu " + level + ".";
            case KLAUS -> "Domäne Gastronomie & Profiküche: Kochtechniken (Garstufen, Saucen, Sous-vide, Fermentierung), " +
                    "Hygiene (HACCP, IFS, Allergenmanagement), Warenwirtschaft & Bestellwesen, " +
                    "Küchenorganisation (Brigade-System, Mise en Place), Menüplanung & Kalkulation, " +
                    "Stressmanagement in der Rush Hour, Personalführung, Saisonale Küche, " +
                    "Nachhaltigkeit & Food Waste, Lieferanten-Management — passend zu " + level + ".";
            case LENA, THOMAS, PETRA -> "Domäne Verkauf/Einzelhandel: Kundenberatung, Warenpräsentation, " +
                    "Kassensysteme, Inventur, Visual Merchandising, Reklamationsbearbeitung, " +
                    "Upselling/Cross-Selling, Teamarbeit im Laden — passend zu " + level + ".";
            case SARAH, SCHNEIDER, WEBER -> "Domäne Medizin/Gesundheitswesen: Patientenaufnahme, Anamnese, " +
                    "Dokumentation, Terminplanung, Notfallprotokolle, Medikamentenmanagement, " +
                    "Hygienevorgaben, interdisziplinäre Zusammenarbeit — passend zu " + level + ".";
            case MAX, OLIVER -> "Domäne Maschinenbau/Fertigung: CNC-Programmierung, Qualitätskontrolle, " +
                    "Arbeitssicherheit, Lean Manufacturing, technische Zeichnungen, " +
                    "Wartung & Instandhaltung, Materialkenntnis — passend zu " + level + ".";
            case NIKLAS, NINA -> "Domäne Service/Hotellerie: Gastfreundschaft, Beschwerdemanagement, " +
                    "Check-in/Check-out, Reservierungssysteme, Event-Organisation, " +
                    "F&B-Service, Housekeeping-Koordination — passend zu " + level + ".";
            case TUAN, LAN, MINH -> "Fokus: allgemeine Bewerbungs-/Strukturfragen passend zu " + level + ".";
        };
    }

    /**
     * Returns 2-3 randomized hard-skill topics from a per-persona pool,
     * so each interview session focuses on DIFFERENT areas.
     */
    private String interviewHardSkillTopics(SpeakingPersona persona, String position, int seed) {
        String[][] topicPools = switch (persona) {
            case KLAUS -> new String[][] {
                {"Kochtechniken (Garstufen, Saucen, Sous-vide)", "Mise en Place und Küchenorganisation"},
                {"HACCP-Konzept und Allergenmanagement", "Warenwirtschaft und Lieferantenbewertung"},
                {"Menüplanung und Kalkulation", "Brigade-System und Teamführung"},
                {"Saisonale Küche und regionale Produkte", "Stressmanagement in der Rush Hour"},
                {"Nachhaltigkeit und Food-Waste-Reduktion", "Kreativität bei Spezialkost (vegan, Allergien)"},
                {"IFS/BRC-Standards und Qualitätssicherung", "Personalplanung und Schichtorganisation"},
                {"Fermentierung und moderne Kochtechniken", "Kastenplanung und Bankettorganisation"},
            };
            case LUKAS -> new String[][] {
                {"Systemdesign und Architekturentscheidungen", "API-Design und Microservices"},
                {"Testing-Strategien (Unit, Integration, E2E)", "Code-Review-Kultur und Best Practices"},
                {"DevOps, CI/CD und Deployment-Strategien", "Performance-Optimierung und Monitoring"},
                {"Debugging komplexer Systeme", "Datenbank-Design und Skalierung"},
                {"Agile Methoden und Teamorganisation", "Tech-Stack-Bewertung und Migration"},
                {"Security Best Practices", "Cloud-Architektur (AWS/Azure/GCP)"},
                {"Frontend-/Backend-Zusammenarbeit", "Legacy-Code-Modernisierung"},
            };
            case EMMA -> new String[][] {
                {"Kundenakquise und Pitch-Strategien", "Marktanalyse und Wettbewerbsbeobachtung"},
                {"Verhandlungsführung und Abschlusstechniken", "CRM-Systeme und Pipeline-Management"},
                {"Projektmanagement und Stakeholder-Kommunikation", "KPI-Tracking und Reporting"},
                {"Networking und Partnerschaftsentwicklung", "Präsentationstechniken"},
                {"Account Management und Kundenbindung", "Interkulturelle Geschäftskommunikation"},
            };
            case HANNA -> new String[][] {
                {"Zeitmanagement und Priorisierung", "Studienplanung und Karriereziele"},
                {"Interkulturelle Kompetenz", "Gruppenarbeit und Teamdynamik"},
                {"Work-Life-Balance und Stressbewältigung", "Selbstorganisation und Produktivität"},
                {"Mentorenrolle und Peer-Learning", "Bewerbungsstrategie und Netzwerken"},
            };
            default -> new String[][] {
                {"Teamarbeit und Zusammenarbeit", "Problemlösung und Entscheidungsfindung"},
                {"Kommunikationsfähigkeit", "Organisationstalent und Zeitmanagement"},
                {"Fachliche Grundkenntnisse für " + position, "Lernbereitschaft und Weiterentwicklung"},
            };
        };

        // Pick 1 topic set based on seed
        String[] picked = topicPools[seed % topicPools.length];
        return String.join(" + ", picked);
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
