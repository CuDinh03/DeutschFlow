package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.SpeakingPromptRequest;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Builds the dynamic system prompt for the "DeutschFlow AI Tutor".
 *
 * <p>Đầu vào gom về MỘT method nhận {@link SpeakingPromptRequest} (dọn nợ Đ6 04/08 — trước đây
 * là 9 overload chồng nhau). Phần prompt INTERVIEW được uỷ quyền hẳn cho
 * {@code InterviewPromptBuilder} (interview domain layer); bản preamble nội bộ cũ đã xoá.
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
              "correction": null ODER korrigierte Fassung NUR der ALLERLETZTEN Nutzer-Nachricht — frühere Turns aus der History NIEMALS korrigieren; null, wenn die letzte Nachricht sprachlich korrekt ist",
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

    /**
     * Đ4: biến thể KHÔNG suggestions cho chế độ on-demand — model không sinh 2 gợi ý mỗi lượt
     * (~⅓ completion token); client bấm nút thì lấy qua endpoint riêng. Nội dung còn lại giữ
     * NGUYÊN VĂN với {@link #JSON_SCHEMA_INSTRUCTION} (chỉ một tham số format: catalog codes).
     */
    private static final String JSON_SCHEMA_INSTRUCTION_NO_SUGGESTIONS = """
            Ausgabe: genau EIN JSON-Objekt, gültiges STRICT JSON (kein Markdown, kein Text drumherum).
            {
              "ai_speech_de": "Deutsch, Tutor-Antwort + kurze Folgefrage zum Target_Topic",
              "status": "OFF_TOPIC | ON_TOPIC_NEEDS_IMPROVEMENT | EXCELLENT",
              "similarity_score": 0.0,
              "feedback": "kurz, ermutigend, Vietnamesisch",
              "correction": null ODER korrigierte Fassung NUR der ALLERLETZTEN Nutzer-Nachricht — frühere Turns aus der History NIEMALS korrigieren; null, wenn die letzte Nachricht sprachlich korrekt ist",
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
              "learning_status": { "new_word": null, "user_interest_detected": null }
            }
            REGELN KURZ:
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

    /**
     * Prompt ĐẦY ĐỦ (tĩnh + động gộp một khối) — dùng cho INTERVIEW (P2 chưa tách chế độ này)
     * và mọi chỗ cần bản gộp. Level ưu tiên: policy bật ({@code cefrEffective}) → CEFR phiên
     * (clamp) → floor theo profile — đúng thứ tự ưu tiên cũ, prompt không đổi một byte.
     */
    public String buildSystemPrompt(SpeakingPromptRequest req) {
        String level = (req.policy() != null && req.policy().enabled())
                ? req.policy().cefrEffective()
                : sessionLevel(req);
        return buildInternal(req.profile(), req.knownInterests(), req.topic(), req.weakPoints(), level,
                req.policy(), req.persona(), req.responseSchema(), req.sessionMode(),
                req.interviewPosition(), req.experienceLevel(), req.turnCount(), req.interviewContext(),
                true, req.includeSuggestions());
    }

    /**
     * Phần TĨNH của prompt (Đ2 04/08): bất biến từng byte trong suốt phiên để prefix-cache của
     * Groq ăn được (token trúng cache không tính TPM + rẻ hơn). Khác bản gộp ở 2 điểm có chủ đích:
     * <ul>
     *   <li>KHÔNG chứa learner context (Interessen/Schwachstellen) + ADAPTIVE POLICY — hai khối
     *       đổi theo lượt, chuyển sang {@link #buildDynamicTurnContext};</li>
     *   <li>level lấy theo PHIÊN (CEFR chọn lúc tạo / floor profile), KHÔNG theo
     *       {@code policy.cefrEffective()} — policy trôi giữa các lượt sẽ phá cache; level hiệu
     *       dụng vẫn tới model qua dòng "effektives Niveau" trong khối động.</li>
     * </ul>
     * INTERVIEW chưa tách (directive đổi từng lượt nằm sâu trong InterviewPromptBuilder) — trả
     * bản gộp như cũ.
     */
    public String buildStaticSystemPrompt(SpeakingPromptRequest req) {
        if (req.sessionMode() == SpeakingSessionMode.INTERVIEW) {
            return buildSystemPrompt(req);
        }
        return buildInternal(req.profile(), req.knownInterests(), req.topic(), req.weakPoints(),
                sessionLevel(req), req.policy(), req.persona(), req.responseSchema(), req.sessionMode(),
                req.interviewPosition(), req.experienceLevel(), req.turnCount(), req.interviewContext(),
                false, req.includeSuggestions());
    }

    /**
     * Phần ĐỘNG theo lượt (Đ2): learner context + adaptive policy + RAG — gửi thành MESSAGE system
     * riêng ngay trước tin nhắn user (không nằm trong system prompt đầu) để phần tĩnh giữ nguyên
     * prefix. Trả {@code null} khi không có gì (hoặc INTERVIEW — toàn bộ nằm trong bản gộp).
     */
    public String buildDynamicTurnContext(SpeakingPromptRequest req, String ragContext) {
        if (req.sessionMode() == SpeakingSessionMode.INTERVIEW) {
            return null;
        }
        StringBuilder inner = new StringBuilder();
        appendCompressedLearnerContext(inner, req.knownInterests(), req.weakPoints());
        appendAdaptivePolicy(inner, req.policy());
        // QA 09/08 mục B: LESSON lượt 2 lặp nguyên lời chào thay vì nhận xét — bài không tiến triển.
        if (req.sessionMode() == SpeakingSessionMode.LESSON && req.turnCount() >= 1) {
            inner.append("BÀI HỌC ĐANG GIỮA CHỪNG (đã chào ở lượt đầu): CẤM chào lại hay giới thiệu lại bài. ")
                    .append("Nhận xét ngắn phần học viên vừa đọc (đúng/sai chỗ nào) rồi dạy tiếp phần kế.\n");
        }
        if (ragContext != null && !ragContext.isBlank()) {
            inner.append("\n=== TÀI LIỆU HỖ TRỢ (RAG CONTEXT) ===\n").append(ragContext).append("\n");
        }
        if (inner.isEmpty()) {
            return null;
        }
        // Đóng khung rõ nguồn: model từng sửa lỗi cả text ngữ cảnh khi nó lẫn vào lời học viên.
        return "NGỮ CẢNH TỪ SERVER cho lượt này (tham khảo — KHÔNG phải lời học viên, KHÔNG sửa lỗi hay trích dẫn phần này):\n"
                + inner;
    }

    private static String sessionLevel(SpeakingPromptRequest req) {
        return (req.sessionCefrLevel() != null && !req.sessionCefrLevel().isBlank())
                ? SpeakingCefrSupport.clampBand(req.sessionCefrLevel())
                : SpeakingCefrSupport.floorPracticeBand(req.profile());
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
                                    InterviewPromptContext interviewContext,
                                    boolean includeSuggestions) {
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
            sb.append("Chủ đề bài học: ").append(topicSection).append("\n");
            appendLessonFactSheet(sb, topicSection);
            sb.append("TIẾN TRIỂN BÀI HỌC: mỗi lượt dạy MỘT phần nhỏ mới hoặc nhận xét phần học viên vừa đọc — ");
            sb.append("không dạy lại phần đã dạy, không lặp lại lời chào/lời giới thiệu sau lượt đầu tiên.\n\n");

        } else if (isVietnamese) {
            sb.append("CHẾ ĐỘ GIAO TIẾP — Cuộc trò chuyện thân thiện về nước Đức bằng tiếng VIỆT.\n");
            sb.append("NGÔN NGỮ CHÍNH: tiếng VIỆT. Tuyệt đối không nói tiếng Đức làm ngôn ngữ chính.\n");
            sb.append("Chỉ lồng ghép từ/cụm tiếng Đức vào câu tiếng Việt để giảng dạy — văn bản thuần, KHÔNG dùng ký hiệu markdown (**, *, #).\n");
            sb.append("Ví dụ đúng: 'Ở Đức khi gặp nhau người ta hay nói Hallo (xin chào) hoặc Guten Morgen (chào buổi sáng).\n");
            sb.append("Ví dụ SAI: 'Hallo! Heute lernen wir...' — tức là nói toàn tiếng Đức là SAI.\n");
            sb.append("Mỗi câu trả lời phải: (1) chủ yếu tiếng Việt, (2) có 1-2 từ Đức mới kèm giải thích.\n\n");

        } else {
            sb.append("COMMUNICATION MODE — Alltagsgespräch / Freundliches Gespräch (KEIN Interview, KEINE Bewerbungsfragen).\n");
            appendCommunicationIdentity(sb, persona, hasIndustry, industry, topicSection);
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
            sb.append("9. DIREKTE FRAGEN AN DICH (z.B. 'Was machst du beruflich?'): beantworte sie ZUERST kurz als deine Persona (1 Satz), DANN eine Folgefrage — nie ausweichen.\n");
            if (hasIndustry) {
                sb.append("\n");
                sb.append("KONTEXTINFO BERUF (des LERNENDEN — nicht deiner!): Der Lernende arbeitet als '").append(industry).append("'.\n");
                sb.append("Du WEISST das bereits — frage NICHT 'Was ist dein Beruf?'. ");
                sb.append("Beziehe den Beruf nur EINMAL beiläufig in das Gespräch ein (z.B. Feierabend, Kollegen, Lieblingsmoment), dann zurück zum Alltag.\n");
                if (includeSuggestions) {
                    sb.append("Die 2 'suggestions' sollen alltagsnahe Antworten zum Beruf '")
                            .append(industry).append("' sein — NICHT Bewerbungsantworten, NICHT generisch.\n");
                }
            } else {
                sb.append("Der Lernende hat keinen Beruf angegeben. Führe ein allgemeines Alltagsgespräch über Hobby, Essen, Wochenende, Familie, Wetter, Filme.\n");
            }
            sb.append("\n");
        }
    }

    /**
     * Khối dữ kiện tĩnh cho bài LESSON có đáp án cố định (QA 09/08 mục B: model tự bịa
     * cách đọc bảng chữ cái). Nội dung tĩnh theo phiên (topic không đổi) → an toàn với
     * prefix-cache. Chủ đề tình huống (không có sheet) nhận ràng buộc thận trọng chung.
     */
    private void appendLessonFactSheet(StringBuilder sb, String topicSection) {
        String sheet = LessonFactSheets.factSheetFor(topicSection);
        if (sheet != null) {
            sb.append("\nDỮ KIỆN BẮT BUỘC (đã kiểm duyệt — nguồn duy nhất được phép dùng):\n");
            sb.append(sheet);
            sb.append("RÀNG BUỘC TUYỆT ĐỐI: KHÔNG tự bịa cách đọc/con số/quy tắc ngoài dữ kiện trên. ");
            sb.append("KHÔNG tự đặt câu ví dụ tiếng Đức mới — chỉ dùng đúng các câu mẫu đã cho. ");
            sb.append("Nếu học viên hỏi ngoài phạm vi dữ kiện, nói thật là bài này chỉ dạy phần trên.\n");
        } else {
            sb.append("RÀNG BUỘC: chỉ dùng câu tiếng Đức A1 đơn giản, chắc chắn đúng ngữ pháp và chính tả. ");
            sb.append("Không chắc chắn một dữ kiện (cách đọc, quy tắc, con số) thì KHÔNG dạy dữ kiện đó.\n");
        }
    }

    /**
     * Khối danh tính bất biến cho chế độ GIAO TIẾP (persona Đức) — đặt NGAY ĐẦU prompt
     * (primacy, mirror cơ chế {@code == ROLE ==} đã chứng minh giữ vai tốt ở INTERVIEW).
     * Chống 2 lỗi đã đo được (BAO_CAO_KIEM_TRA_PERSONA_2026-08-06): AI tự nhận nghề của
     * HỌC VIÊN làm nghề mình (11/32 lượt), và chủ đề chuyên ngành lệch persona kéo AI
     * "biến hình" thành chuyên gia ngành đó. Toàn bộ khối tĩnh theo phiên → nằm ở prefix
     * cache được (Đ2).
     */
    private void appendCommunicationIdentity(StringBuilder sb,
                                             SpeakingPersona persona,
                                             boolean hasIndustry,
                                             String industry,
                                             String topicSection) {
        String role = persona.communicationRole();
        sb.append("DEINE IDENTITÄT (UNVERÄNDERLICH):\n");
        if (role != null) {
            sb.append("- Du bist ").append(persona.displayName()).append(", ").append(role).append(".\n");
        } else {
            sb.append("- Du bist der DeutschFlow AI-Sprachtutor. Erfinde NIE einen eigenen Beruf — ");
            sb.append("nach deinem Beruf gefragt, sag ehrlich, dass du ein KI-Sprachpartner bist.\n");
        }
        if (hasIndustry) {
            sb.append("- '").append(industry).append("' ist der Beruf des LERNENDEN — NIEMALS dein eigener.\n");
        }
        sb.append("- Das Thema '").append(topicSection).append("' behandelst du aus DEINER Perspektive");
        if (role != null) {
            sb.append(" als ").append(role)
                    .append(" (z.B. als Person, die selbst zum Arzt geht — NICHT als Arzt, wenn das Thema Medizin ist)");
        }
        sb.append(".\n");
        if (role != null) {
            sb.append("- Fragt der Lernende nach DEINEM Beruf oder Alltag → antworte IMMER als ").append(role).append(".\n");
        }
        sb.append("\n");
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
                                 InterviewPromptContext interviewContext,
                                 boolean includeTurnDynamicBlocks,
                                 boolean includeSuggestions) {

        boolean hasIndustry = profile.getIndustry() != null && !profile.getIndustry().isBlank();
        String industry = hasIndustry ? profile.getIndustry() : null;
        String topicSection = (topic != null && !topic.isBlank()) ? topic : "Allgemeines Gespräch";
        boolean isVietnamese = isVietnamesePersona(persona);

        StringBuilder sb = new StringBuilder();

        appendModePreamble(sb, sessionMode, isVietnamese, hasIndustry, industry, topicSection, persona, level, interviewPosition, experienceLevel, turnCount, interviewContext, includeSuggestions);

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

        // Đ2: hai khối dưới đổi theo lượt — bản TĨNH bỏ qua, chúng đi theo buildDynamicTurnContext.
        if (includeTurnDynamicBlocks) {
            if (sessionMode != SpeakingSessionMode.INTERVIEW) {
                appendCompressedLearnerContext(sb, knownInterests, weakPoints);
            }
            appendAdaptivePolicy(sb, policy);
        }

        sb.append("\n");

        String personaSection = persona.personaPromptSection(level);
        if (personaSection != null && !personaSection.isBlank()) {
            sb.append(personaSection).append("\n");
        }
        sb.append("Priorität: Target_Topic hat Vorrang beim GESPRÄCHSTHEMA; deine IDENTITÄT (Name, Beruf, Rolle) aus der PERSONA bleibt IMMER bestehen — nicht das Thema verlassen.\n\n");
        // QA 09/08 mục C: UI render text thuần + câu được đọc bằng TTS — markdown lộ nguyên ** ra chat.
        sb.append("PLAINTEXT: Inhalt ALLER Textfelder ist reiner Text — KEIN Markdown (**fett**, *kursiv*, #, Listen, `Code`). Betonung nur durch Wortwahl.\n\n");

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
            if (includeSuggestions) {
                sb.append("4. Scaffolding: GENAU 2 suggestions auf Niveau ").append(level).append(".\n");
                sb.append("   - [0] KURZ + SICHER: 3-6 Wörter, leicht auszusprechen — eine direkte, klare Antwort auf deine LETZTE Frage.\n");
                sb.append("   - [1] LÄNGER + REICHER: 8-14 Wörter — eine ehrlichere/detailliertere Antwort auf DIESELBE Frage (anderer Registry oder mehr Kontext).\n");
                sb.append("   - BEIDE müssen die LETZTE Frage konkret beantworten — keine generischen Satzanfänge wie 'Ich möchte sagen...'.\n");
                sb.append("   - Grammatikalisch zu 100% fehlerfrei (korrekte Wortstellung TeKaMoLo, Genus, Kasus). Generiere KEINE fehlerhaften Vorschläge!\n");
                sb.append("5. Vietnamesische Kurzhinweise in feedback/explanation_vi/why_to_use wo nötig.\n\n");
            } else {
                sb.append("4. Vietnamesische Kurzhinweise in feedback/explanation_vi wo nötig.\n\n");
            }

            sb.append("Sprachliche Deckel: nicht über ").append(level).append(" hinaus.\n\n");

            // For Vietnamese personas: override ai_speech_de description in schema to clarify it holds Vietnamese + German words
            String schemaBlock = includeSuggestions
                    ? JSON_SCHEMA_INSTRUCTION.formatted(level, ErrorCatalog.codesCompactForPrompt())
                    : JSON_SCHEMA_INSTRUCTION_NO_SUGGESTIONS.formatted(ErrorCatalog.codesCompactForPrompt());
            if (isVietnamese) {
                String viSchema = schemaBlock
                    .replace(
                        "\"ai_speech_de\": \"Deutsch, Tutor-Antwort + kurze Folgefrage zum Target_Topic\"",
                        "\"ai_speech_de\": \"TIẾNG VIỆT LÀ CHÍNH — câu trả lời bằng tiếng Việt, lồng 1-2 từ Đức kèm giải thích nghĩa, văn bản thuần KHÔNG markdown. KHÔNG được dùng tiếng Đức làm ngôn ngữ chính.\""
                    );
                sb.append(viSchema);
                sb.append("\nLƯU Ý QUAN TRỌNG NHẤT: Trường ai_speech_de phải chứa câu tiếng VIỆT, không phải tiếng Đức. ");
                sb.append("Ví dụ: 'Chào bạn! Hôm nay mình học chữ A trong tiếng Đức nhé!' — ĐÂY LÀ ĐÚNG.\n");
                sb.append("Ví dụ: 'Hallo! Heute lernen wir das Alphabet!' — ĐÂY LÀ SAI.\n");
            } else {
                sb.append(schemaBlock);
            }
        }

        return sb.toString();
    }
}
