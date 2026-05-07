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

/**
 * Builds the dynamic system prompt for the "DeutschFlow AI Tutor".
 */
@Component
public class SystemPromptBuilder {

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

        return buildInternal(profile, knownInterests, topic, weakPoints, level, null, persona, SpeakingResponseSchema.V1, SpeakingSessionMode.COMMUNICATION, null, null);
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

        return buildInternal(profile, knownInterests, topic, weakPoints, level, null, persona, responseSchema, sessionMode, null, null);
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
        return buildSystemPrompt(profile, knownInterests, topic, weakPoints, sessionCefrLevel, policy, persona, responseSchema, sessionMode, null, null);
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
        String level = (policy != null && policy.enabled()) ? policy.cefrEffective() :
                (sessionCefrLevel != null && !sessionCefrLevel.isBlank())
                ? SpeakingCefrSupport.clampBand(sessionCefrLevel)
                : SpeakingCefrSupport.floorPracticeBand(profile);

        return buildInternal(profile, knownInterests, topic, weakPoints, level, policy, persona, responseSchema, sessionMode, interviewPosition, experienceLevel);
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
                                 String experienceLevel) {

        boolean hasIndustry = profile.getIndustry() != null && !profile.getIndustry().isBlank();
        String industry = hasIndustry ? profile.getIndustry() : null;
        String topicSection = (topic != null && !topic.isBlank()) ? topic : "Allgemeines Gespräch";
        boolean isVietnamese = isVietnamesePersona(persona);

        StringBuilder sb = new StringBuilder();

        // ── Mode-specific preamble ──────────────────────────────────────
        if (sessionMode == SpeakingSessionMode.INTERVIEW) {
            String pos = (interviewPosition != null && !interviewPosition.isBlank()) ? interviewPosition : "Allgemeine Position";
            String exp = (experienceLevel != null && !experienceLevel.isBlank()) ? experienceLevel : "unbekannt";
            appendInterviewPreamble(sb, persona, level, pos, exp, industry, hasIndustry);

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

        sb.append("Du bist \"DeutschFlow AI Tutor\", một chuyên gia ngôn ngữ học tiếng Đức kiêm trợ lý sư phạm chuyên sâu.\n");
        sb.append("Nhiệm vụ của bạn là đồng hành cùng người dùng, giúp họ sửa lỗi và phát triển tư duy ngôn ngữ trình độ ").append(level).append(".\n\n");

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
                                          String industry, boolean hasIndustry) {
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

        // == CONVERSATION STRUCTURE ==
        sb.append("== GESPRÄCHSSTRUKTUR (halte dich STRIKT daran) ==\n\n");

        sb.append("PHASE 1 — BEGRÜSSUNG & SELBSTVORSTELLUNG (Turn 1):\n");
        sb.append("- Stelle dich kurz vor: Name, Rolle, Unternehmen.\n");
        sb.append("- Bitte den Kandidaten, sich vorzustellen.\n");
        sb.append("- Erwarte: Gegenwart (aktuelle Rolle) → Vergangenheit (Erfahrung) → Zukunft (warum diese Stelle).\n\n");

        sb.append("PHASE 2 — ICE-BREAKER (Turn 2–3):\n");
        sb.append("- 2 lockere, aber professionelle Fragen zum Einstieg.\n");
        sb.append("- Ziel: Kandidat entspannen, erste Eindrücke sammeln.\n\n");

        sb.append("PHASE 3 — FACHLICHE KOMPETENZ / HARD SKILLS (Turn 4–7):\n");
        sb.append("- 4 tiefgreifende Fragen zur Eignung für \"").append(position).append("\".\n");
        sb.append("- Mindestens 1 Case Study / Praxisszenario.\n");
        sb.append("- ADAPTIVE REGEL: Wenn der Kandidat bei 2 von 4 Fragen nicht ausreichend antwortet, ");
        sb.append("stelle EINE zusätzliche Frage auf NIEDRIGEREM Niveau (einfachere Formulierung, grundlegenderes Konzept).\n\n");

        sb.append("PHASE 4 — SOFT SKILLS & STAR (Turn 8–10):\n");
        sb.append("- 3 Verhaltensfragen nach der STAR-Methode (Situation-Task-Action-Result).\n");
        sb.append("- Themen: Stressbewältigung, Teamkonflikte, Fehlermanagement.\n");
        sb.append("- Wenn der Kandidat nicht in STAR antwortet, hilf sanft: 'Können Sie ein konkretes Beispiel nennen? Was war die Situation, Ihre Aufgabe, Ihr Handeln und das Ergebnis?'\n\n");

        sb.append("PHASE 5 — ABSCHLUSS (nach allen Fragen oder bei Red Flags):\n");
        sb.append("- 'Haben Sie noch Fragen an uns?' oder 'Gibt es etwas, das Sie noch hinzufügen möchten?'\n");
        sb.append("- Bedanke dich professionell. Informiere über 'nächste Schritte'.\n\n");

        // == RESPONSE RULES ==
        sb.append("== ANTWORTREGELN ==\n");
        sb.append("1. KONVERSATIONSFLUSS: Reagiere in ai_speech_de IMMER ZUERST auf das, was der Kandidat gerade gesagt hat ");
        sb.append("(z.B. 'Das ist ein interessanter Punkt zu...' / 'Danke für diese Einblicke...'). ");
        sb.append("DANN stelle die nächste Frage.\n");
        sb.append("2. feedback-Feld: knappes Feedback auf Vietnamesisch (freundlich-professionell).\n");
        sb.append("3. correction-Feld: nur bei klaren sprachlichen Fehlern eine professionellere Formulierung vorschlagen.\n");
        sb.append("4. NIEMALS vorgefertigte Fragen stellen, die die Antwort des Kandidaten ignorieren.\n\n");

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
            case LUKAS -> "Domäne IT/Software: Systemdesign auf " + level + ", Teamarbeit, Debugging, Code-Review-Kultur, Agile/Jira, Bewerbung in Startup-Kontext.";
            case EMMA -> "Domäne Business & Kundenkontakt: Pitch, Situationsfragen, Höflichkeit, klare Nutzenargumente — nicht nur Smalltalk.";
            case HANNA -> "Domäne Studentenleben & Organisation: Zeitmanagement, WG/Uni, nachhaltiger Alltag, Studium vs. Job, Stressbewältigung.";
            case KLAUS -> "Domäne Gastronomie & Profiküche (Deutschland): Kochtechniken (z. B. Garstufen, Saucengrund), Hygiene & HACCP/IFS-Themen angepasst an "
                    + level + ", Teamarbeit in der Brigade, Schichtwechsel, Stress in der Rush — realistische Küchen-Interviewfragen.";
            case LENA, THOMAS, PETRA -> "Domäne Verkauf/Einzelhandel: Kundenberatung, Kassensystem, Warenkunde, Reklamation, Teamarbeit im Laden — passend zu " + level + ".";
            case SARAH, SCHNEIDER, WEBER -> "Domäne Medizin/Gesundheitswesen: Patientenaufnahme, Terminvergabe, Untersuchungsabläufe, Fachbegriffe — passend zu " + level + ".";
            case MAX, OLIVER -> "Domäne Maschinenbau/Fertigung: Maschinenkenntnis, Sicherheitsvorschriften, CNC-Programmierung, Qualitätskontrolle — passend zu " + level + ".";
            case NIKLAS, NINA -> "Domäne Service/Gastronomie/Hotellerie: Gastfreundschaft, Bestellungsaufnahme, Check-in/Check-out, Beschwerdemanagement — passend zu " + level + ".";
            case TUAN, LAN, MINH -> "Fokus: allgemeine Bewerbungs-/Strukturfragen passend zu " + level + ".";
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
