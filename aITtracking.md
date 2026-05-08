# Interview AI Quality Upgrade (A+C+D)

## Overview
Nâng cấp chất lượng cuộc phỏng vấn AI bằng cách cải tiến 3 mảng đồng thời: **System Prompt (A)**, **Phase Tracking (C)**, và **Language Leveling (D)**.

## Changes Made

### A: Anti-Template Prompt Rules
```diff:SystemPromptBuilder.java
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
===
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
        if (currentTurn <= 1) {
            phase = 1;
            phaseName = "Begrüßung & Selbstvorstellung";
            phaseInstruction = "Bitte den Kandidaten, sich vorzustellen. Erwarte: Gegenwart → Vergangenheit → Zukunft.";
        } else if (currentTurn <= 3) {
            phase = 2;
            phaseName = "Ice-Breaker";
            phaseInstruction = "Stelle lockere, aber professionelle Fragen zum Einstieg. Ziel: Kandidat entspannen, erste Eindrücke.";
        } else if (currentTurn <= 7) {
            phase = 3;
            phaseName = "Fachliche Kompetenz / Hard Skills";
            phaseInstruction = "Tiefgreifende Fragen zur Eignung für \"" + position + "\". Mindestens 1 Case Study. "
                    + "Wenn Kandidat bei 2 Fragen schwach antwortet → 1 einfachere Frage zum selben Thema.";
        } else if (currentTurn <= 10) {
            phase = 4;
            phaseName = "Soft Skills & STAR";
            phaseInstruction = "Verhaltensfragen nach STAR-Methode: Stressbewältigung, Teamkonflikte, Fehlermanagement. "
                    + "Wenn der Kandidat nicht in STAR antwortet: 'Können Sie ein konkretes Beispiel nennen?'";
        } else {
            phase = 5;
            phaseName = "Abschluss";
            phaseInstruction = "Frage: 'Haben Sie noch Fragen an uns?' Bedanke dich professionell. Informiere über nächste Schritte.";
        }

        sb.append("== AKTUELLE PHASE (Server-gesteuert) ==\n");
        sb.append("Du befindest dich in PHASE ").append(phase).append(" — ").append(phaseName);
        sb.append(" (Turn ").append(Math.max(1, currentTurn)).append(").\n");
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
```

**Thay đổi cốt lõi trong `ANTWORTREGELN`:**

| Trước (Cũ) | Sau (Mới) |
|---|---|
| Chỉ có 4 rule chung chung | **VERBOTEN** section cấm cụ thể: "Das ist großartig!", paraphrase + unverbundene Frage, câu hỏi trùng lặp |
| "Reagiere ZUERST auf das Gesagte" (mơ hồ) | **PFLICHT** 3-bước cụ thể: BEZUGNAHME → FOLLOW-UP/CHALLENGE → ÜBERLEITUNG |
| Không có ví dụ đúng/sai | Có 4 ví dụ cụ thể RICHTIG/FALSCH |
| Không có cơ chế phản biện | **30% Challenge/Trade-off** rule — AI phải hỏi về giới hạn và trade-offs |
| AI khen đều tất cả | **DIFFERENZIERUNG** — AI phải phân biệt: câu trả lời yếu → "Können Sie das konkreter machen?" |

---

### C: Server-Driven Phase Tracking

```diff:AiSpeakingServiceImpl.java
package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiErrorSanitizer;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.SystemPromptBuilder;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.dto.AdaptiveMetaDto;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import com.deutschflow.speaking.dto.ErrorItemDto;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.deutschflow.speaking.domain.SpeakingPriority;
import com.deutschflow.speaking.entity.UserErrorObservation;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.entity.UserLearningProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.training.service.TrainingDatasetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

    /** Lower-variance JSON / tutor replies for structured V1/V2. */
    private static final double SPEAKING_CHAT_TEMPERATURE = 0.35;
    /** Cap completion tokens per turn (quota snapshot may be lower). */
    private static final int SPEAKING_MAX_COMPLETION_TOKENS = 512;
    /** Initial greeting: warmer than chat but still structured JSON. */
    private static final double GREETING_TEMPERATURE = 0.5;

    private final TransactionTemplate transactionTemplate;
    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final OpenAiChatClient openAiChatClient;
    private final SystemPromptBuilder promptBuilder;
    private final AiResponseParser responseParser;
    private final ObjectMapper objectMapper;
    private final UserErrorObservationRepository userErrorObservationRepository;
    private final UserErrorSkillRepository userErrorSkillRepository;
    private final UserLearningProgressRepository progressRepository;
    private final UserRepository userRepository;
    private final ReviewSchedulerService reviewSchedulerService;
    private final SpeakingMetrics speakingMetrics;
    private final AdaptivePolicyService adaptivePolicyService;
    private final TurnEvaluatorService turnEvaluatorService;
    private final QuotaService quotaService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final TrainingDatasetService trainingDatasetService;
    private final XpService xpService;
    private final InterviewEvaluationService interviewEvaluationService;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel, String personaRaw,
                                              String responseSchemaRaw, String sessionModeRaw,
                                              String interviewPosition, String experienceLevel) {
        UserLearningProfile p = profileRepository.findByUserId(userId).orElse(null);
        String resolved =
                (cefrLevel == null || cefrLevel.isBlank())
                        ? SpeakingCefrSupport.floorPracticeBand(p)
                        : SpeakingCefrSupport.clampToProfileRange(cefrLevel, p);
        SpeakingPersona persona = SpeakingPersona.fromApi(personaRaw);
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(responseSchemaRaw);
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(sessionModeRaw);
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .cefrLevel(resolved)
                .persona(persona.name())
                .responseSchema(responseSchema.name())
                .sessionMode(sessionMode.name())
                .interviewPosition(sessionMode == SpeakingSessionMode.INTERVIEW ? interviewPosition : null)
                .experienceLevel(sessionMode == SpeakingSessionMode.INTERVIEW ? experienceLevel : null)
                .status(SessionStatus.ACTIVE)
                .messageCount(0)
                .build();
        session = sessionRepository.save(session);

        // Tự động sinh lời chào cá nhân hóa
        AiSpeakingChatResponse greeting =
                generateInitialGreeting(userId, session.getId(), topic, resolved, persona, responseSchema, sessionMode);

        return toSessionDto(session, greeting);
    }

    private AiSpeakingChatResponse generateInitialGreeting(
            Long userId,
            Long sessionId,
            String topic,
            String cefrLevel,
            SpeakingPersona persona,
            SpeakingResponseSchema responseSchema,
            SpeakingSessionMode sessionMode) {
        AiSpeakingSession sessionRow = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found"));
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(defaultProfile());
        List<String> knownInterests = extractInterests(profile);
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(userId, PageRequest.of(0, 5));

        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, sessionRow, profile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, policy, persona, responseSchema, sessionMode)
                : promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, persona, responseSchema, sessionMode);

        // Specialized instruction for greeting — pass null if no industry so persona can differentiate
        String industry = profile.getIndustry() != null && !profile.getIndustry().isBlank() ? profile.getIndustry() : null;
        String weakPointsStr = weakPoints.stream().map(WeakPoint::grammarPoint).collect(Collectors.joining(", "));
        String greetingInstruction = persona.buildGreetingInstruction(topic, industry, weakPointsStr, sessionMode,
                sessionRow.getInterviewPosition());

        List<ChatMessage> messages = List.of(
                new ChatMessage("system", systemPrompt),
                new ChatMessage("user", greetingInstruction)
        );

        var greetSnapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        int greetMaxTokens = (int) Math.max(1L,
                Math.min(maxTokensConfig, greetSnapshot.remainingThisMonth()));

        Double tempConfig = systemConfigService.getDouble("ai.temperature", GREETING_TEMPERATURE);
        AiChatCompletionResult result = openAiChatClient.chatCompletion(
                messages, null, tempConfig, greetMaxTokens);
        AiResponseDto parsed = responseParser.parseWithOutcome(result.content(), responseSchema).dto();

        // Save AI message
        AiSpeakingMessage msg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .explanationVi(parsed.explanationVi())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .createdAt(LocalDateTime.now())
                .build();
        messageRepository.save(msg);

        // Return parsed response with correct IDs
        return new AiSpeakingChatResponse(
                msg.getId(),
                sessionId,
                parsed.aiSpeechDe(),
                null,
                parsed.explanationVi(),
                null,
                new AiSpeakingChatResponse.LearningStatus(parsed.newWord(), parsed.userInterestDetected()),
                List.of(),
                null,
                parsed.status(),
                parsed.similarityScore(),
                parsed.feedback(),
                List.of(),
                responseSchema.name(),
                parsed.action()
        );
    }

    @Override
    public AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage) {
        Instant chatStart = Instant.now();
        boolean failed = false;
        try {
            return chatInner(userId, sessionId, userMessage);
        } catch (RuntimeException e) {
            failed = true;
            throw e;
        } finally {
            speakingMetrics.recordChatRequest("blocking", failed ? "error" : "ok");
            speakingMetrics.recordChatLatency("blocking", Duration.between(chatStart, Instant.now()));
        }
    }

    /**
     * Read DB + quota in a short transaction, call LLM outside any transaction (no JDBC held during latency),
     * persist in a single write transaction — avoids starving {@code DeutschFlowPool} when vocab schedulers run.
     */
    private AiSpeakingChatResponse chatInner(Long userId, Long sessionId, String userMessage) {
        SpeakingChatPrep prep =
                Objects.requireNonNull(transactionTemplate.execute(status -> prepareSpeakingChatTurn(userId, sessionId, userMessage)));

        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        AiChatCompletionResult ai = openAiChatClient.chatCompletion(
                prep.openAiMessages(), null, tempConfig, prep.maxTokens());

        AiParseOutcome parseOutcome = responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
        speakingMetrics.recordAiParseOutcome(parseOutcome.status());
        AiResponseDto parsedRaw = parseOutcome.dto();
        AiResponseDto parsed = new AiResponseDto(
                parsedRaw.aiSpeechDe(),
                parsedRaw.correction(),
                parsedRaw.explanationVi(),
                parsedRaw.grammarPoint(),
                parsedRaw.newWord(),
                parsedRaw.userInterestDetected(),
                AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors()),
                parsedRaw.status(),
                parsedRaw.similarityScore(),
                parsedRaw.feedback(),
                parsedRaw.suggestions(),
                parsedRaw.action()
        );

        return Objects.requireNonNull(transactionTemplate.execute(
                status -> finalizeSpeakingChatPersistence(prep, userMessage, ai, parsed, "SPEAKING_CHAT")));
    }

    private SpeakingChatPrep prepareSpeakingChatTurn(long userId, long sessionId, String userMessage) {
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }

        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<String> knownInterests = extractInterests(profile);
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                userId, PageRequest.of(0, 5));

        List<AiSpeakingMessage> recentMessages =
                messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);
        // Interview mode needs more context for phase tracking
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(session.getSessionMode());
        int maxHistory = sessionMode == SpeakingSessionMode.INTERVIEW ? 10 : 6;
        if (recentMessages.size() > maxHistory) {
            recentMessages = new ArrayList<>(recentMessages.subList(recentMessages.size() - maxHistory, recentMessages.size()));
        }

        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
        SpeakingPersona persona = SpeakingPersona.fromApi(session.getPersona());
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(session.getResponseSchema());
        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, session, effectiveProfile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy, persona, responseSchema, sessionMode,
                session.getInterviewPosition(), session.getExperienceLevel())
                : promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), persona, responseSchema, sessionMode);

        List<ChatMessage> openAiMessages = new ArrayList<>();
        openAiMessages.add(new ChatMessage("system", systemPrompt));
        for (AiSpeakingMessage msg : recentMessages) {
            if (msg.getRole() == MessageRole.USER) {
                openAiMessages.add(new ChatMessage("user", msg.getUserText()));
            } else {
                openAiMessages.add(new ChatMessage("assistant", msg.getAiSpeechDe()));
            }
        }
        openAiMessages.add(new ChatMessage("user", userMessage));

        var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        int maxTokens = (int) Math.max(1L,
                Math.min(maxTokensConfig, snapshot.remainingThisMonth()));

        return new SpeakingChatPrep(
                userId,
                sessionId,
                policy,
                systemPrompt,
                session.getCefrLevel(),
                session.getTopic(),
                List.copyOf(openAiMessages),
                maxTokens,
                session.getMessageCount(),
                responseSchema);
    }

    private AiSpeakingChatResponse finalizeSpeakingChatPersistence(
            SpeakingChatPrep prep,
            String userMessage,
            AiChatCompletionResult ai,
            AiResponseDto parsed,
            String ledgerPurpose) {

        AiSpeakingSession session = loadSessionForUser(prep.userId(), prep.sessionId());
        UserLearningProfile profile = profileRepository.findByUserId(prep.userId()).orElse(null);
        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();

        AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                .sessionId(prep.sessionId())
                .role(MessageRole.USER)
                .userText(userMessage)
                .build();
        messageRepository.save(userMsg);

        AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                .sessionId(prep.sessionId())
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .correction(parsed.correction())
                .explanationVi(parsed.explanationVi())
                .grammarPoint(parsed.grammarPoint())
                .newWord(parsed.newWord())
                .userInterestDetected(parsed.userInterestDetected())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        persistGrammarFeedback(prep.userId(), prep.sessionId(), assistantMsg.getId(), userMessage, parsed, effectiveProfile);
        updateUserLearningProgress(prep.userId(), parsed);
        recordAssistantTurnMetrics(parsed);

        try {
            if (ai.usage() != null) {
                aiUsageLedgerService.record(
                        prep.userId(),
                        ai.provider(),
                        ai.model(),
                        ai.usage().promptTokens(),
                        ai.usage().completionTokens(),
                        ai.usage().totalTokens(),
                        ledgerPurpose,
                        RequestContext.requestIdOrNull(),
                        prep.sessionId()
                );
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }

        if (parsed.userInterestDetected() != null && !parsed.userInterestDetected().isBlank() && profile != null) {
            mergeInterest(profile, parsed.userInterestDetected());
        }

        turnEvaluatorService.recordTurn(prep.userId(), prep.sessionId(), assistantMsg.getId(), parsed, prep.policy());

        trainingDatasetService.recordConversationTurn(
                prep.userId(), prep.sessionId(), prep.cefrLevel(), prep.topic(),
                userMessage, parsed, prep.systemPrompt(), assistantMsg.getId(), ai.provider()
        );

        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(prep.messageCountBaseline() + 2);
        sessionRepository.save(session);

        // Award XP for speaking turn (non-blocking: catch any failure)
        try { xpService.awardSpeakingTurn(prep.userId(), prep.sessionId(), assistantMsg.getId()); }
        catch (Exception xpEx) { log.debug("[XP] awardSpeakingTurn skipped: {}", xpEx.getMessage()); }

        AdaptiveMetaDto adaptive = AdaptiveMetaDto.fromPolicyAndResponse(prep.policy(), parsed);
        if (adaptive != null && adaptive.forceRepairBeforeContinue()) {
            speakingMetrics.recordForceRepair();
        }

        return new AiSpeakingChatResponse(
                assistantMsg.getId(),
                prep.sessionId(),
                parsed.aiSpeechDe(),
                parsed.correction(),
                parsed.explanationVi(),
                parsed.grammarPoint(),
                new AiSpeakingChatResponse.LearningStatus(
                        parsed.newWord(),
                        parsed.userInterestDetected()
                ),
                toErrorItemDtos(parsed.errors()),
                adaptive,
                parsed.status(),
                parsed.similarityScore(),
                parsed.feedback(),
                parsed.suggestions().stream()
                        .map(s -> new AiSpeakingChatResponse.SuggestionDto(
                                s.germanText(),
                                s.vietnameseTranslation(),
                                s.level(),
                                s.whyToUse(),
                                s.usageContext(),
                                s.legoStructure()
                        )).toList(),
                prep.responseSchema().name(),
                parsed.action()
        );
    }

    /** Immutable snapshot — session row may change across transactions; IDs + topic/CEFR copied out. */
    private record SpeakingChatPrep(
            long userId,
            long sessionId,
            SpeakingPolicy policy,
            String systemPrompt,
            String cefrLevel,
            String topic,
            List<ChatMessage> openAiMessages,
            int maxTokens,
            int messageCountBaseline,
            SpeakingResponseSchema responseSchema
    ) {}

    @Override
    public void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                           AtomicBoolean streamCancelled) {
        try {
            SpeakingChatPrep prep = transactionTemplate.execute(
                    status -> prepareSpeakingChatTurn(userId, sessionId, userMessage));
            if (prep == null) {
                emitter.completeWithError(new IllegalStateException("prepareSpeakingChatTurn returned null"));
                return;
            }

            Instant streamStart = Instant.now();

            Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
            boolean finished = openAiChatClient.chatCompletionStream(prep.openAiMessages(), null, tempConfig, prep.maxTokens(),
                    token -> {
                        try {
                            emitter.send(SseEmitter.event().name("token").data(token));
                        } catch (Exception e) {
                            log.warn("[SSE] Failed to send token: {}", e.getMessage());
                        }
                    },
                    (ai) -> {
                        // Parse + metrics outside JDBC; persist in one transaction (reuse blocking-chat path).
                        try {
                            AiParseOutcome parseOutcomeStream =
                                    responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
                            speakingMetrics.recordAiParseOutcome(parseOutcomeStream.status());
                            AiResponseDto parsedRaw = parseOutcomeStream.dto();
                            AiResponseDto parsed = new AiResponseDto(
                                    parsedRaw.aiSpeechDe(),
                                    parsedRaw.correction(),
                                    parsedRaw.explanationVi(),
                                    parsedRaw.grammarPoint(),
                                    parsedRaw.newWord(),
                                    parsedRaw.userInterestDetected(),
                                    AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors()),
                                    parsedRaw.status(),
                                    parsedRaw.similarityScore(),
                                    parsedRaw.feedback(),
                                    parsedRaw.suggestions(),
                                    parsedRaw.action()
                            );

                            AiSpeakingChatResponse donePayload = Objects.requireNonNull(
                                    transactionTemplate.execute(status ->
                                            finalizeSpeakingChatPersistence(
                                                    prep, userMessage, ai, parsed, "SPEAKING_STREAM")));
                            speakingMetrics.recordChatRequest("stream", "ok");

                            emitter.send(SseEmitter.event().name("done")
                                    .data(objectMapper.writeValueAsString(donePayload)));
                            emitter.complete();
                        } catch (Exception ex) {
                            log.error("[SSE] Error in onComplete handler", ex);
                            speakingMetrics.recordChatRequest("stream", "error");
                            emitter.completeWithError(ex);
                        }
                    },
                    streamCancelled);
            speakingMetrics.recordChatLatency("stream", Duration.between(streamStart, Instant.now()));
            if (!finished) {
                log.debug("[SSE] AI chat stream aborted (timeout/cancel); skipping persist");
                speakingMetrics.recordChatRequest("stream", "cancelled");
                try {
                    emitter.send(SseEmitter.event().name("error").data("Stream cancelled."));
                } catch (Exception sendEx) {
                    log.trace("[SSE] Could not send cancel error event: {}", sendEx.getMessage());
                }
                try {
                    emitter.complete();
                } catch (Exception completeEx) {
                    log.trace("[SSE] Emitter already completed: {}", completeEx.getMessage());
                }
            }
        } catch (Exception ex) {
            log.error("[SSE] Stream setup error", ex);
            emitter.completeWithError(ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId) {
        loadSessionForUser(userId, sessionId); // validates ownership
        List<AiSpeakingMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Long> assistantIds = messages.stream()
                .filter(m -> m.getRole() == MessageRole.ASSISTANT)
                .map(AiSpeakingMessage::getId)
                .toList();
        Map<Long, List<UserGrammarError>> byMsgId = assistantIds.isEmpty()
                ? Map.of()
                : grammarErrorRepository.findByMessageIdIn(assistantIds).stream()
                .collect(Collectors.groupingBy(UserGrammarError::getMessageId));
        return messages.stream()
                .map(m -> {
                    List<UserGrammarError> ge = m.getRole() == MessageRole.ASSISTANT
                            ? byMsgId.getOrDefault(m.getId(), List.of())
                            : List.of();
                    return toMessageDto(m, ge);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable) {
        return sessionRepository.findByUserId(userId, pageable)
                .map(this::toSessionDto);
    }

    @Override
    public AiSpeakingSessionDto endSession(Long userId, Long sessionId) {
        // ── PHA 1: Đóng session (transaction ngắn ~30ms) ──
        // Giữ DB connection chỉ để đọc + update status → commit → trả connection về pool
        AiSpeakingSession closedSession = Objects.requireNonNull(
                transactionTemplate.execute(status -> {
                    AiSpeakingSession s = loadSessionForUser(userId, sessionId);
                    if (s.getStatus() == SessionStatus.ENDED) {
                        throw new ConflictException("This session has already ended.");
                    }
                    s.setStatus(SessionStatus.ENDED);
                    s.setEndedAt(LocalDateTime.now());
                    return sessionRepository.save(s);
                }));
        // → Connection TRẢ VỀ pool ✅

        // ── PHA 2: Gọi Groq nếu INTERVIEW (5-15s, KHÔNG giữ DB connection) ──
        String report = null;
        if ("INTERVIEW".equals(closedSession.getSessionMode())) {
            try {
                report = interviewEvaluationService.generateReport(closedSession, userId);
            } catch (Exception e) {
                log.warn("Failed to generate interview report for session {}: {}", sessionId, e.getMessage());
            }
        }

        // ── PHA 3: Lưu report + award XP (transaction ngắn ~30ms) ──
        final String finalReport = report;
        AiSpeakingSession finalSession = Objects.requireNonNull(
                transactionTemplate.execute(status -> {
                    AiSpeakingSession s = sessionRepository.findById(sessionId)
                            .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
                    if (finalReport != null) {
                        s.setInterviewReportJson(finalReport);
                        s = sessionRepository.save(s);
                    }
                    // Award XP for session completion (non-blocking)
                    try { xpService.awardSessionComplete(userId, sessionId); }
                    catch (Exception xpEx) { log.debug("[XP] awardSessionComplete skipped: {}", xpEx.getMessage()); }
                    return s;
                }));
        // → Connection TRẢ VỀ pool ✅

        return toSessionDto(finalSession);
    }

    // --- Private helpers ---

    private AiSpeakingSession loadSessionForUser(Long userId, Long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        if (!session.getUserId().equals(userId)) {
            throw new NotFoundException("Session not found: " + sessionId);
        }
        return session;
    }

    private List<String> extractInterests(UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(profile.getInterestsJson(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse interestsJson for user profile: {}", e.getMessage());
            return List.of();
        }
    }

    private void mergeInterest(UserLearningProfile profile, String newInterest) {
        try {
            Set<String> updated = new LinkedHashSet<>(extractInterests(profile));
            updated.add(newInterest.trim());
            profile.setInterestsJson(objectMapper.writeValueAsString(updated));
            profileRepository.save(profile);
        } catch (Exception e) {
            log.warn("Failed to merge interest '{}': {}", newInterest, e.getMessage());
        }
    }

    private void persistGrammarFeedback(Long userId, Long sessionId, Long assistantMessageId,
                                        String userMessage, AiResponseDto parsed,
                                        UserLearningProfile profile) {
        if (!parsed.errors().isEmpty()) {
            for (ErrorItem err : parsed.errors()) {
                saveStructuredGrammarError(userId, sessionId, assistantMessageId, userMessage, err, profile);
            }
        } else if (parsed.correction() != null && parsed.grammarPoint() != null) {
            saveLegacyGrammarError(userId, sessionId, assistantMessageId,
                    parsed.grammarPoint(), userMessage, parsed.correction(), profile);
        }
    }

    private void saveStructuredGrammarError(Long userId, Long sessionId, Long messageId,
                                            String userMessage, ErrorItem err,
                                            UserLearningProfile profile) {
        try {
            if (grammarErrorRepository.existsByMessageIdAndErrorCode(messageId, err.errorCode())) {
                return;
            }
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            String correctionText = err.correctedSpan() != null ? err.correctedSpan()
                    : err.exampleCorrectDe();
            String sev = GrammarErrorSeverity.normalizeToStored(
                    err.severity() != null ? err.severity() : GrammarErrorSeverity.MINOR.name());
            LocalDateTime now = LocalDateTime.now();
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(err.errorCode())
                    .errorCode(err.errorCode())
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .repairStatus("OPEN")
                    .originalText(userMessage)
                    .correctionText(correctionText)
                    .severity(sev)
                    .cefrLevel(cefrLevel)
                    .createdAt(now)
                    .build());

            userErrorObservationRepository.save(UserErrorObservation.builder()
                    .userId(userId)
                    .messageId(messageId)
                    .sessionId(sessionId)
                    .errorCode(err.errorCode())
                    .severity(sev)
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .createdAt(now)
                    .build());

            upsertUserErrorSkill(userId, err.errorCode(), sev, now);
            reviewSchedulerService.onMajorObservation(userId, err.errorCode(), sev);
        } catch (Exception e) {
            log.warn("Failed to save structured grammar error: {}", e.getMessage());
        }
    }

    private void upsertUserErrorSkill(Long userId, String errorCode, String severity, LocalDateTime now) {
        if (errorCode == null || errorCode.isBlank()) {
            return;
        }
        String code = errorCode.trim();
        Optional<UserErrorSkill> opt = userErrorSkillRepository.findByUserIdAndErrorCode(userId, code);
        if (opt.isEmpty()) {
            userErrorSkillRepository.save(UserErrorSkill.builder()
                    .userId(userId)
                    .errorCode(code)
                    .totalCount(1)
                    .lastSeenAt(now)
                    .lastSeverity(severity)
                    .openCount(1)
                    .resolvedCount(0)
                    .priorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(1, now, severity)))
                    .build());
        } else {
            UserErrorSkill s = opt.get();
            int total = s.getTotalCount() + 1;
            s.setTotalCount(total);
            s.setLastSeenAt(now);
            s.setLastSeverity(severity);
            s.setOpenCount(s.getOpenCount() + 1);
            s.setPriorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(total, now, severity)));
            userErrorSkillRepository.save(s);
        }
    }

    private void recordAssistantTurnMetrics(AiResponseDto parsed) {
        boolean noMajor = parsed.errors() == null || parsed.errors().stream().noneMatch(e -> {
            String s = e.severity() == null ? "" : e.severity().toUpperCase(Locale.ROOT);
            return s.contains("MAJOR") || s.contains("BLOCKING");
        });
        speakingMetrics.recordTurnAccuracy(noMajor);
        speakingMetrics.recordErrorsEmitted(parsed.errors());
    }

    private void saveLegacyGrammarError(Long userId, Long sessionId, Long messageId,
                                        String grammarPoint, String originalText,
                                        String correctionText, UserLearningProfile profile) {
        try {
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(grammarPoint)
                    .originalText(originalText)
                    .correctionText(correctionText)
                    .severity(detectSeverity(correctionText))
                    .cefrLevel(cefrLevel)
                    .repairStatus("OPEN")
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to save grammar error: {}", e.getMessage());
        }
    }

    private List<ErrorItemDto> toErrorItemDtos(List<ErrorItem> items) {
        if (items == null || items.isEmpty()) return List.of();
        return items.stream().map(e -> new ErrorItemDto(
                e.errorCode(),
                e.severity(),
                e.confidence(),
                e.wrongSpan(),
                e.correctedSpan(),
                e.ruleViShort(),
                e.exampleCorrectDe()
        )).toList();
    }

    private ErrorItemDto toErrorItemDto(UserGrammarError e) {
        String code = e.getErrorCode() != null ? e.getErrorCode() : e.getGrammarPoint();
        return new ErrorItemDto(
                code,
                e.getSeverity(),
                e.getConfidence() == null ? null : e.getConfidence().doubleValue(),
                e.getWrongSpan(),
                e.getCorrectedSpan(),
                e.getRuleViShort(),
                e.getExampleCorrectDe()
        );
    }

    private static BigDecimal toStoredConfidence(Double c) {
        if (c == null) return null;
        return BigDecimal.valueOf(c).setScale(3, RoundingMode.HALF_UP);
    }

    private String detectSeverity(String correction) {
        if (correction == null || correction.isBlank()) {
            return GrammarErrorSeverity.MINOR.name();
        }
        String lower = correction.toLowerCase();
        if (lower.contains("falsch") || lower.contains("incorrect") || lower.contains("never")) {
            return GrammarErrorSeverity.BLOCKING.name();
        }
        return GrammarErrorSeverity.MAJOR.name();
    }

    private UserLearningProfile defaultProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.A1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A0)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build();
    }

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s) {
        return toSessionDto(s, null);
    }

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s, AiSpeakingChatResponse initialAiMessage) {
        return new AiSpeakingSessionDto(
                s.getId(),
                s.getTopic(),
                s.getCefrLevel(),
                s.getPersona(),
                s.getResponseSchema(),
                s.getSessionMode(),
                s.getStatus().name(),
                s.getStartedAt(),
                s.getLastActivityAt(),
                s.getEndedAt(),
                s.getMessageCount(),
                initialAiMessage,
                s.getInterviewPosition(),
                s.getExperienceLevel(),
                s.getInterviewReportJson());
    }

    private AiSpeakingMessageDto toMessageDto(AiSpeakingMessage m, List<UserGrammarError> grammarRows) {
        List<ErrorItemDto> errors = grammarRows.stream()
                .map(this::toErrorItemDto)
                .toList();
        return new AiSpeakingMessageDto(
                m.getId(), m.getRole().name(), m.getUserText(),
                m.getAiSpeechDe(), m.getCorrection(), m.getExplanationVi(),
                m.getGrammarPoint(), m.getNewWord(), m.getUserInterestDetected(),
                m.getAssistantAction(), m.getAssistantFeedback(),
                m.getCreatedAt(),
                errors);
    }
    private void updateUserLearningProgress(Long userId, AiResponseDto parsed) {
        try {
            String lastError = null;
            if ("OFF_TOPIC".equals(parsed.status())) {
                lastError = "OFF_TOPIC";
            } else if (parsed.errors() != null && !parsed.errors().isEmpty()) {
                lastError = parsed.errors().get(0).errorCode();
            } else if (parsed.correction() != null && !parsed.correction().isBlank()) {
                lastError = "GENERAL_GRAMMAR";
            }

            if (lastError != null) {
                final String finalError = lastError;
                UserLearningProgress progress = progressRepository.findByUserId(userId)
                        .orElseGet(() -> UserLearningProgress.builder()
                                .user(userRepository.getReferenceById(userId))
                                .build());
                progress.setLastErrorType(finalError);
                progressRepository.save(progress);
            }
        } catch (Exception e) {
            log.warn("Failed to update user learning progress: {}", e.getMessage());
        }
    }
}
===
package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiErrorSanitizer;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.SystemPromptBuilder;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.dto.AdaptiveMetaDto;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import com.deutschflow.speaking.dto.ErrorItemDto;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.deutschflow.speaking.domain.SpeakingPriority;
import com.deutschflow.speaking.entity.UserErrorObservation;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.entity.UserLearningProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.training.service.TrainingDatasetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

    /** Lower-variance JSON / tutor replies for structured V1/V2. */
    private static final double SPEAKING_CHAT_TEMPERATURE = 0.35;
    /** Cap completion tokens per turn (quota snapshot may be lower). */
    private static final int SPEAKING_MAX_COMPLETION_TOKENS = 512;
    /** Initial greeting: warmer than chat but still structured JSON. */
    private static final double GREETING_TEMPERATURE = 0.5;

    private final TransactionTemplate transactionTemplate;
    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final OpenAiChatClient openAiChatClient;
    private final SystemPromptBuilder promptBuilder;
    private final AiResponseParser responseParser;
    private final ObjectMapper objectMapper;
    private final UserErrorObservationRepository userErrorObservationRepository;
    private final UserErrorSkillRepository userErrorSkillRepository;
    private final UserLearningProgressRepository progressRepository;
    private final UserRepository userRepository;
    private final ReviewSchedulerService reviewSchedulerService;
    private final SpeakingMetrics speakingMetrics;
    private final AdaptivePolicyService adaptivePolicyService;
    private final TurnEvaluatorService turnEvaluatorService;
    private final QuotaService quotaService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final TrainingDatasetService trainingDatasetService;
    private final XpService xpService;
    private final InterviewEvaluationService interviewEvaluationService;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel, String personaRaw,
                                              String responseSchemaRaw, String sessionModeRaw,
                                              String interviewPosition, String experienceLevel) {
        UserLearningProfile p = profileRepository.findByUserId(userId).orElse(null);
        String resolved =
                (cefrLevel == null || cefrLevel.isBlank())
                        ? SpeakingCefrSupport.floorPracticeBand(p)
                        : SpeakingCefrSupport.clampToProfileRange(cefrLevel, p);
        SpeakingPersona persona = SpeakingPersona.fromApi(personaRaw);
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(responseSchemaRaw);
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(sessionModeRaw);
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .cefrLevel(resolved)
                .persona(persona.name())
                .responseSchema(responseSchema.name())
                .sessionMode(sessionMode.name())
                .interviewPosition(sessionMode == SpeakingSessionMode.INTERVIEW ? interviewPosition : null)
                .experienceLevel(sessionMode == SpeakingSessionMode.INTERVIEW ? experienceLevel : null)
                .status(SessionStatus.ACTIVE)
                .messageCount(0)
                .build();
        session = sessionRepository.save(session);

        // Tự động sinh lời chào cá nhân hóa
        AiSpeakingChatResponse greeting =
                generateInitialGreeting(userId, session.getId(), topic, resolved, persona, responseSchema, sessionMode);

        return toSessionDto(session, greeting);
    }

    private AiSpeakingChatResponse generateInitialGreeting(
            Long userId,
            Long sessionId,
            String topic,
            String cefrLevel,
            SpeakingPersona persona,
            SpeakingResponseSchema responseSchema,
            SpeakingSessionMode sessionMode) {
        AiSpeakingSession sessionRow = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found"));
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(defaultProfile());
        List<String> knownInterests = extractInterests(profile);
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(userId, PageRequest.of(0, 5));

        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, sessionRow, profile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, policy, persona, responseSchema, sessionMode)
                : promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, persona, responseSchema, sessionMode);

        // Specialized instruction for greeting — pass null if no industry so persona can differentiate
        String industry = profile.getIndustry() != null && !profile.getIndustry().isBlank() ? profile.getIndustry() : null;
        String weakPointsStr = weakPoints.stream().map(WeakPoint::grammarPoint).collect(Collectors.joining(", "));
        String greetingInstruction = persona.buildGreetingInstruction(topic, industry, weakPointsStr, sessionMode,
                sessionRow.getInterviewPosition());

        List<ChatMessage> messages = List.of(
                new ChatMessage("system", systemPrompt),
                new ChatMessage("user", greetingInstruction)
        );

        var greetSnapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        int greetMaxTokens = (int) Math.max(1L,
                Math.min(maxTokensConfig, greetSnapshot.remainingThisMonth()));

        Double tempConfig = systemConfigService.getDouble("ai.temperature", GREETING_TEMPERATURE);
        AiChatCompletionResult result = openAiChatClient.chatCompletion(
                messages, null, tempConfig, greetMaxTokens);
        AiResponseDto parsed = responseParser.parseWithOutcome(result.content(), responseSchema).dto();

        // Save AI message
        AiSpeakingMessage msg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .explanationVi(parsed.explanationVi())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .createdAt(LocalDateTime.now())
                .build();
        messageRepository.save(msg);

        // Return parsed response with correct IDs
        return new AiSpeakingChatResponse(
                msg.getId(),
                sessionId,
                parsed.aiSpeechDe(),
                null,
                parsed.explanationVi(),
                null,
                new AiSpeakingChatResponse.LearningStatus(parsed.newWord(), parsed.userInterestDetected()),
                List.of(),
                null,
                parsed.status(),
                parsed.similarityScore(),
                parsed.feedback(),
                List.of(),
                responseSchema.name(),
                parsed.action()
        );
    }

    @Override
    public AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage) {
        Instant chatStart = Instant.now();
        boolean failed = false;
        try {
            return chatInner(userId, sessionId, userMessage);
        } catch (RuntimeException e) {
            failed = true;
            throw e;
        } finally {
            speakingMetrics.recordChatRequest("blocking", failed ? "error" : "ok");
            speakingMetrics.recordChatLatency("blocking", Duration.between(chatStart, Instant.now()));
        }
    }

    /**
     * Read DB + quota in a short transaction, call LLM outside any transaction (no JDBC held during latency),
     * persist in a single write transaction — avoids starving {@code DeutschFlowPool} when vocab schedulers run.
     */
    private AiSpeakingChatResponse chatInner(Long userId, Long sessionId, String userMessage) {
        SpeakingChatPrep prep =
                Objects.requireNonNull(transactionTemplate.execute(status -> prepareSpeakingChatTurn(userId, sessionId, userMessage)));

        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        AiChatCompletionResult ai = openAiChatClient.chatCompletion(
                prep.openAiMessages(), null, tempConfig, prep.maxTokens());

        AiParseOutcome parseOutcome = responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
        speakingMetrics.recordAiParseOutcome(parseOutcome.status());
        AiResponseDto parsedRaw = parseOutcome.dto();
        AiResponseDto parsed = new AiResponseDto(
                parsedRaw.aiSpeechDe(),
                parsedRaw.correction(),
                parsedRaw.explanationVi(),
                parsedRaw.grammarPoint(),
                parsedRaw.newWord(),
                parsedRaw.userInterestDetected(),
                AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors()),
                parsedRaw.status(),
                parsedRaw.similarityScore(),
                parsedRaw.feedback(),
                parsedRaw.suggestions(),
                parsedRaw.action()
        );

        return Objects.requireNonNull(transactionTemplate.execute(
                status -> finalizeSpeakingChatPersistence(prep, userMessage, ai, parsed, "SPEAKING_CHAT")));
    }

    private SpeakingChatPrep prepareSpeakingChatTurn(long userId, long sessionId, String userMessage) {
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }

        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<String> knownInterests = extractInterests(profile);
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                userId, PageRequest.of(0, 5));

        List<AiSpeakingMessage> recentMessages =
                messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);
        // Interview mode needs more context for phase tracking
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(session.getSessionMode());
        int maxHistory = sessionMode == SpeakingSessionMode.INTERVIEW ? 10 : 6;
        if (recentMessages.size() > maxHistory) {
            recentMessages = new ArrayList<>(recentMessages.subList(recentMessages.size() - maxHistory, recentMessages.size()));
        }

        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
        SpeakingPersona persona = SpeakingPersona.fromApi(session.getPersona());
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(session.getResponseSchema());
        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, session, effectiveProfile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy, persona, responseSchema, sessionMode,
                session.getInterviewPosition(), session.getExperienceLevel(), session.getMessageCount())
                : promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), persona, responseSchema, sessionMode);

        List<ChatMessage> openAiMessages = new ArrayList<>();
        openAiMessages.add(new ChatMessage("system", systemPrompt));
        for (AiSpeakingMessage msg : recentMessages) {
            if (msg.getRole() == MessageRole.USER) {
                openAiMessages.add(new ChatMessage("user", msg.getUserText()));
            } else {
                openAiMessages.add(new ChatMessage("assistant", msg.getAiSpeechDe()));
            }
        }
        openAiMessages.add(new ChatMessage("user", userMessage));

        var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        int maxTokens = (int) Math.max(1L,
                Math.min(maxTokensConfig, snapshot.remainingThisMonth()));

        return new SpeakingChatPrep(
                userId,
                sessionId,
                policy,
                systemPrompt,
                session.getCefrLevel(),
                session.getTopic(),
                List.copyOf(openAiMessages),
                maxTokens,
                session.getMessageCount(),
                responseSchema);
    }

    private AiSpeakingChatResponse finalizeSpeakingChatPersistence(
            SpeakingChatPrep prep,
            String userMessage,
            AiChatCompletionResult ai,
            AiResponseDto parsed,
            String ledgerPurpose) {

        AiSpeakingSession session = loadSessionForUser(prep.userId(), prep.sessionId());
        UserLearningProfile profile = profileRepository.findByUserId(prep.userId()).orElse(null);
        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();

        AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                .sessionId(prep.sessionId())
                .role(MessageRole.USER)
                .userText(userMessage)
                .build();
        messageRepository.save(userMsg);

        AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                .sessionId(prep.sessionId())
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .correction(parsed.correction())
                .explanationVi(parsed.explanationVi())
                .grammarPoint(parsed.grammarPoint())
                .newWord(parsed.newWord())
                .userInterestDetected(parsed.userInterestDetected())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        persistGrammarFeedback(prep.userId(), prep.sessionId(), assistantMsg.getId(), userMessage, parsed, effectiveProfile);
        updateUserLearningProgress(prep.userId(), parsed);
        recordAssistantTurnMetrics(parsed);

        try {
            if (ai.usage() != null) {
                aiUsageLedgerService.record(
                        prep.userId(),
                        ai.provider(),
                        ai.model(),
                        ai.usage().promptTokens(),
                        ai.usage().completionTokens(),
                        ai.usage().totalTokens(),
                        ledgerPurpose,
                        RequestContext.requestIdOrNull(),
                        prep.sessionId()
                );
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }

        if (parsed.userInterestDetected() != null && !parsed.userInterestDetected().isBlank() && profile != null) {
            mergeInterest(profile, parsed.userInterestDetected());
        }

        turnEvaluatorService.recordTurn(prep.userId(), prep.sessionId(), assistantMsg.getId(), parsed, prep.policy());

        trainingDatasetService.recordConversationTurn(
                prep.userId(), prep.sessionId(), prep.cefrLevel(), prep.topic(),
                userMessage, parsed, prep.systemPrompt(), assistantMsg.getId(), ai.provider()
        );

        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(prep.messageCountBaseline() + 2);
        sessionRepository.save(session);

        // Award XP for speaking turn (non-blocking: catch any failure)
        try { xpService.awardSpeakingTurn(prep.userId(), prep.sessionId(), assistantMsg.getId()); }
        catch (Exception xpEx) { log.debug("[XP] awardSpeakingTurn skipped: {}", xpEx.getMessage()); }

        AdaptiveMetaDto adaptive = AdaptiveMetaDto.fromPolicyAndResponse(prep.policy(), parsed);
        if (adaptive != null && adaptive.forceRepairBeforeContinue()) {
            speakingMetrics.recordForceRepair();
        }

        return new AiSpeakingChatResponse(
                assistantMsg.getId(),
                prep.sessionId(),
                parsed.aiSpeechDe(),
                parsed.correction(),
                parsed.explanationVi(),
                parsed.grammarPoint(),
                new AiSpeakingChatResponse.LearningStatus(
                        parsed.newWord(),
                        parsed.userInterestDetected()
                ),
                toErrorItemDtos(parsed.errors()),
                adaptive,
                parsed.status(),
                parsed.similarityScore(),
                parsed.feedback(),
                parsed.suggestions().stream()
                        .map(s -> new AiSpeakingChatResponse.SuggestionDto(
                                s.germanText(),
                                s.vietnameseTranslation(),
                                s.level(),
                                s.whyToUse(),
                                s.usageContext(),
                                s.legoStructure()
                        )).toList(),
                prep.responseSchema().name(),
                parsed.action()
        );
    }

    /** Immutable snapshot — session row may change across transactions; IDs + topic/CEFR copied out. */
    private record SpeakingChatPrep(
            long userId,
            long sessionId,
            SpeakingPolicy policy,
            String systemPrompt,
            String cefrLevel,
            String topic,
            List<ChatMessage> openAiMessages,
            int maxTokens,
            int messageCountBaseline,
            SpeakingResponseSchema responseSchema
    ) {}

    @Override
    public void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                           AtomicBoolean streamCancelled) {
        try {
            SpeakingChatPrep prep = transactionTemplate.execute(
                    status -> prepareSpeakingChatTurn(userId, sessionId, userMessage));
            if (prep == null) {
                emitter.completeWithError(new IllegalStateException("prepareSpeakingChatTurn returned null"));
                return;
            }

            Instant streamStart = Instant.now();

            Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
            boolean finished = openAiChatClient.chatCompletionStream(prep.openAiMessages(), null, tempConfig, prep.maxTokens(),
                    token -> {
                        try {
                            emitter.send(SseEmitter.event().name("token").data(token));
                        } catch (Exception e) {
                            log.warn("[SSE] Failed to send token: {}", e.getMessage());
                        }
                    },
                    (ai) -> {
                        // Parse + metrics outside JDBC; persist in one transaction (reuse blocking-chat path).
                        try {
                            AiParseOutcome parseOutcomeStream =
                                    responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
                            speakingMetrics.recordAiParseOutcome(parseOutcomeStream.status());
                            AiResponseDto parsedRaw = parseOutcomeStream.dto();
                            AiResponseDto parsed = new AiResponseDto(
                                    parsedRaw.aiSpeechDe(),
                                    parsedRaw.correction(),
                                    parsedRaw.explanationVi(),
                                    parsedRaw.grammarPoint(),
                                    parsedRaw.newWord(),
                                    parsedRaw.userInterestDetected(),
                                    AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors()),
                                    parsedRaw.status(),
                                    parsedRaw.similarityScore(),
                                    parsedRaw.feedback(),
                                    parsedRaw.suggestions(),
                                    parsedRaw.action()
                            );

                            AiSpeakingChatResponse donePayload = Objects.requireNonNull(
                                    transactionTemplate.execute(status ->
                                            finalizeSpeakingChatPersistence(
                                                    prep, userMessage, ai, parsed, "SPEAKING_STREAM")));
                            speakingMetrics.recordChatRequest("stream", "ok");

                            emitter.send(SseEmitter.event().name("done")
                                    .data(objectMapper.writeValueAsString(donePayload)));
                            emitter.complete();
                        } catch (Exception ex) {
                            log.error("[SSE] Error in onComplete handler", ex);
                            speakingMetrics.recordChatRequest("stream", "error");
                            emitter.completeWithError(ex);
                        }
                    },
                    streamCancelled);
            speakingMetrics.recordChatLatency("stream", Duration.between(streamStart, Instant.now()));
            if (!finished) {
                log.debug("[SSE] AI chat stream aborted (timeout/cancel); skipping persist");
                speakingMetrics.recordChatRequest("stream", "cancelled");
                try {
                    emitter.send(SseEmitter.event().name("error").data("Stream cancelled."));
                } catch (Exception sendEx) {
                    log.trace("[SSE] Could not send cancel error event: {}", sendEx.getMessage());
                }
                try {
                    emitter.complete();
                } catch (Exception completeEx) {
                    log.trace("[SSE] Emitter already completed: {}", completeEx.getMessage());
                }
            }
        } catch (Exception ex) {
            log.error("[SSE] Stream setup error", ex);
            emitter.completeWithError(ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId) {
        loadSessionForUser(userId, sessionId); // validates ownership
        List<AiSpeakingMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Long> assistantIds = messages.stream()
                .filter(m -> m.getRole() == MessageRole.ASSISTANT)
                .map(AiSpeakingMessage::getId)
                .toList();
        Map<Long, List<UserGrammarError>> byMsgId = assistantIds.isEmpty()
                ? Map.of()
                : grammarErrorRepository.findByMessageIdIn(assistantIds).stream()
                .collect(Collectors.groupingBy(UserGrammarError::getMessageId));
        return messages.stream()
                .map(m -> {
                    List<UserGrammarError> ge = m.getRole() == MessageRole.ASSISTANT
                            ? byMsgId.getOrDefault(m.getId(), List.of())
                            : List.of();
                    return toMessageDto(m, ge);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable) {
        return sessionRepository.findByUserId(userId, pageable)
                .map(this::toSessionDto);
    }

    @Override
    public AiSpeakingSessionDto endSession(Long userId, Long sessionId) {
        // ── PHA 1: Đóng session (transaction ngắn ~30ms) ──
        // Giữ DB connection chỉ để đọc + update status → commit → trả connection về pool
        AiSpeakingSession closedSession = Objects.requireNonNull(
                transactionTemplate.execute(status -> {
                    AiSpeakingSession s = loadSessionForUser(userId, sessionId);
                    if (s.getStatus() == SessionStatus.ENDED) {
                        throw new ConflictException("This session has already ended.");
                    }
                    s.setStatus(SessionStatus.ENDED);
                    s.setEndedAt(LocalDateTime.now());
                    return sessionRepository.save(s);
                }));
        // → Connection TRẢ VỀ pool ✅

        // ── PHA 2: Gọi Groq nếu INTERVIEW (5-15s, KHÔNG giữ DB connection) ──
        String report = null;
        if ("INTERVIEW".equals(closedSession.getSessionMode())) {
            try {
                report = interviewEvaluationService.generateReport(closedSession, userId);
            } catch (Exception e) {
                log.warn("Failed to generate interview report for session {}: {}", sessionId, e.getMessage());
            }
        }

        // ── PHA 3: Lưu report + award XP (transaction ngắn ~30ms) ──
        final String finalReport = report;
        AiSpeakingSession finalSession = Objects.requireNonNull(
                transactionTemplate.execute(status -> {
                    AiSpeakingSession s = sessionRepository.findById(sessionId)
                            .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
                    if (finalReport != null) {
                        s.setInterviewReportJson(finalReport);
                        s = sessionRepository.save(s);
                    }
                    // Award XP for session completion (non-blocking)
                    try { xpService.awardSessionComplete(userId, sessionId); }
                    catch (Exception xpEx) { log.debug("[XP] awardSessionComplete skipped: {}", xpEx.getMessage()); }
                    return s;
                }));
        // → Connection TRẢ VỀ pool ✅

        return toSessionDto(finalSession);
    }

    // --- Private helpers ---

    private AiSpeakingSession loadSessionForUser(Long userId, Long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        if (!session.getUserId().equals(userId)) {
            throw new NotFoundException("Session not found: " + sessionId);
        }
        return session;
    }

    private List<String> extractInterests(UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(profile.getInterestsJson(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse interestsJson for user profile: {}", e.getMessage());
            return List.of();
        }
    }

    private void mergeInterest(UserLearningProfile profile, String newInterest) {
        try {
            Set<String> updated = new LinkedHashSet<>(extractInterests(profile));
            updated.add(newInterest.trim());
            profile.setInterestsJson(objectMapper.writeValueAsString(updated));
            profileRepository.save(profile);
        } catch (Exception e) {
            log.warn("Failed to merge interest '{}': {}", newInterest, e.getMessage());
        }
    }

    private void persistGrammarFeedback(Long userId, Long sessionId, Long assistantMessageId,
                                        String userMessage, AiResponseDto parsed,
                                        UserLearningProfile profile) {
        if (!parsed.errors().isEmpty()) {
            for (ErrorItem err : parsed.errors()) {
                saveStructuredGrammarError(userId, sessionId, assistantMessageId, userMessage, err, profile);
            }
        } else if (parsed.correction() != null && parsed.grammarPoint() != null) {
            saveLegacyGrammarError(userId, sessionId, assistantMessageId,
                    parsed.grammarPoint(), userMessage, parsed.correction(), profile);
        }
    }

    private void saveStructuredGrammarError(Long userId, Long sessionId, Long messageId,
                                            String userMessage, ErrorItem err,
                                            UserLearningProfile profile) {
        try {
            if (grammarErrorRepository.existsByMessageIdAndErrorCode(messageId, err.errorCode())) {
                return;
            }
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            String correctionText = err.correctedSpan() != null ? err.correctedSpan()
                    : err.exampleCorrectDe();
            String sev = GrammarErrorSeverity.normalizeToStored(
                    err.severity() != null ? err.severity() : GrammarErrorSeverity.MINOR.name());
            LocalDateTime now = LocalDateTime.now();
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(err.errorCode())
                    .errorCode(err.errorCode())
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .repairStatus("OPEN")
                    .originalText(userMessage)
                    .correctionText(correctionText)
                    .severity(sev)
                    .cefrLevel(cefrLevel)
                    .createdAt(now)
                    .build());

            userErrorObservationRepository.save(UserErrorObservation.builder()
                    .userId(userId)
                    .messageId(messageId)
                    .sessionId(sessionId)
                    .errorCode(err.errorCode())
                    .severity(sev)
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .createdAt(now)
                    .build());

            upsertUserErrorSkill(userId, err.errorCode(), sev, now);
            reviewSchedulerService.onMajorObservation(userId, err.errorCode(), sev);
        } catch (Exception e) {
            log.warn("Failed to save structured grammar error: {}", e.getMessage());
        }
    }

    private void upsertUserErrorSkill(Long userId, String errorCode, String severity, LocalDateTime now) {
        if (errorCode == null || errorCode.isBlank()) {
            return;
        }
        String code = errorCode.trim();
        Optional<UserErrorSkill> opt = userErrorSkillRepository.findByUserIdAndErrorCode(userId, code);
        if (opt.isEmpty()) {
            userErrorSkillRepository.save(UserErrorSkill.builder()
                    .userId(userId)
                    .errorCode(code)
                    .totalCount(1)
                    .lastSeenAt(now)
                    .lastSeverity(severity)
                    .openCount(1)
                    .resolvedCount(0)
                    .priorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(1, now, severity)))
                    .build());
        } else {
            UserErrorSkill s = opt.get();
            int total = s.getTotalCount() + 1;
            s.setTotalCount(total);
            s.setLastSeenAt(now);
            s.setLastSeverity(severity);
            s.setOpenCount(s.getOpenCount() + 1);
            s.setPriorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(total, now, severity)));
            userErrorSkillRepository.save(s);
        }
    }

    private void recordAssistantTurnMetrics(AiResponseDto parsed) {
        boolean noMajor = parsed.errors() == null || parsed.errors().stream().noneMatch(e -> {
            String s = e.severity() == null ? "" : e.severity().toUpperCase(Locale.ROOT);
            return s.contains("MAJOR") || s.contains("BLOCKING");
        });
        speakingMetrics.recordTurnAccuracy(noMajor);
        speakingMetrics.recordErrorsEmitted(parsed.errors());
    }

    private void saveLegacyGrammarError(Long userId, Long sessionId, Long messageId,
                                        String grammarPoint, String originalText,
                                        String correctionText, UserLearningProfile profile) {
        try {
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(grammarPoint)
                    .originalText(originalText)
                    .correctionText(correctionText)
                    .severity(detectSeverity(correctionText))
                    .cefrLevel(cefrLevel)
                    .repairStatus("OPEN")
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to save grammar error: {}", e.getMessage());
        }
    }

    private List<ErrorItemDto> toErrorItemDtos(List<ErrorItem> items) {
        if (items == null || items.isEmpty()) return List.of();
        return items.stream().map(e -> new ErrorItemDto(
                e.errorCode(),
                e.severity(),
                e.confidence(),
                e.wrongSpan(),
                e.correctedSpan(),
                e.ruleViShort(),
                e.exampleCorrectDe()
        )).toList();
    }

    private ErrorItemDto toErrorItemDto(UserGrammarError e) {
        String code = e.getErrorCode() != null ? e.getErrorCode() : e.getGrammarPoint();
        return new ErrorItemDto(
                code,
                e.getSeverity(),
                e.getConfidence() == null ? null : e.getConfidence().doubleValue(),
                e.getWrongSpan(),
                e.getCorrectedSpan(),
                e.getRuleViShort(),
                e.getExampleCorrectDe()
        );
    }

    private static BigDecimal toStoredConfidence(Double c) {
        if (c == null) return null;
        return BigDecimal.valueOf(c).setScale(3, RoundingMode.HALF_UP);
    }

    private String detectSeverity(String correction) {
        if (correction == null || correction.isBlank()) {
            return GrammarErrorSeverity.MINOR.name();
        }
        String lower = correction.toLowerCase();
        if (lower.contains("falsch") || lower.contains("incorrect") || lower.contains("never")) {
            return GrammarErrorSeverity.BLOCKING.name();
        }
        return GrammarErrorSeverity.MAJOR.name();
    }

    private UserLearningProfile defaultProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.A1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A0)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build();
    }

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s) {
        return toSessionDto(s, null);
    }

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s, AiSpeakingChatResponse initialAiMessage) {
        return new AiSpeakingSessionDto(
                s.getId(),
                s.getTopic(),
                s.getCefrLevel(),
                s.getPersona(),
                s.getResponseSchema(),
                s.getSessionMode(),
                s.getStatus().name(),
                s.getStartedAt(),
                s.getLastActivityAt(),
                s.getEndedAt(),
                s.getMessageCount(),
                initialAiMessage,
                s.getInterviewPosition(),
                s.getExperienceLevel(),
                s.getInterviewReportJson());
    }

    private AiSpeakingMessageDto toMessageDto(AiSpeakingMessage m, List<UserGrammarError> grammarRows) {
        List<ErrorItemDto> errors = grammarRows.stream()
                .map(this::toErrorItemDto)
                .toList();
        return new AiSpeakingMessageDto(
                m.getId(), m.getRole().name(), m.getUserText(),
                m.getAiSpeechDe(), m.getCorrection(), m.getExplanationVi(),
                m.getGrammarPoint(), m.getNewWord(), m.getUserInterestDetected(),
                m.getAssistantAction(), m.getAssistantFeedback(),
                m.getCreatedAt(),
                errors);
    }
    private void updateUserLearningProgress(Long userId, AiResponseDto parsed) {
        try {
            String lastError = null;
            if ("OFF_TOPIC".equals(parsed.status())) {
                lastError = "OFF_TOPIC";
            } else if (parsed.errors() != null && !parsed.errors().isEmpty()) {
                lastError = parsed.errors().get(0).errorCode();
            } else if (parsed.correction() != null && !parsed.correction().isBlank()) {
                lastError = "GENERAL_GRAMMAR";
            }

            if (lastError != null) {
                final String finalError = lastError;
                UserLearningProgress progress = progressRepository.findByUserId(userId)
                        .orElseGet(() -> UserLearningProgress.builder()
                                .user(userRepository.getReferenceById(userId))
                                .build());
                progress.setLastErrorType(finalError);
                progressRepository.save(progress);
            }
        } catch (Exception e) {
            log.warn("Failed to update user learning progress: {}", e.getMessage());
        }
    }
}
```

**Logic tính phase từ `messageCount`:**

```java
int currentTurn = (turnCount + 1) / 2;
// Turn 1     → Phase 1 (Begrüßung)
// Turn 2-3   → Phase 2 (Ice-Breaker)
// Turn 4-7   → Phase 3 (Hard Skills)
// Turn 8-10  → Phase 4 (STAR/Soft Skills)
// Turn 11+   → Phase 5 (Abschluss)
```

**Trước:** AI phải tự đoán mình đang ở phase nào dựa vào 10 tin nhắn cuối → hay bị lạc, lặp câu hỏi Phase 2 trong Phase 4.

**Sau:** Server tính chính xác phase và inject vào prompt:
```
== AKTUELLE PHASE (Server-gesteuert) ==
Du befindest dich in PHASE 3 — Fachliche Kompetenz / Hard Skills (Turn 5).
Anweisung: Tiefgreifende Fragen zur Eignung für "Data Analyst"...
```

---

### D: CEFR Language Leveling

**Thêm section `SPRACHNIVEAU-KONTROLLE`:**
- AI điều chỉnh độ khó câu hỏi theo CEFR level (B1-B2)
- Phát hiện khi ứng viên monologue >5 câu → AI ngắt lời lịch sự
- AI sử dụng Fachvokabular phù hợp level để "test" ứng viên

## Verification
- ✅ Backend compiles successfully (`./mvnw compile`)
- Không thay đổi API contract hoặc database schema
- Không ảnh hưởng COMMUNICATION/LESSON modes (turnCount=0 cho non-interview)
