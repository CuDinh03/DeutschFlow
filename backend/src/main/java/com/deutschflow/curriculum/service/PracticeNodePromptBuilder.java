package com.deutschflow.curriculum.service;

import java.util.List;

/**
 * System Prompt templates for AI-generated Practice Node exercises.
 * <p>
 * Sau khi user hoàn thành một Theory Node, hệ thống sinh đồng thời
 * 4 Practice Node (Hören/Sprechen/Lesen/Schreiben).
 * Mỗi kỹ năng có prompt riêng, bài tập types riêng.
 * <p>
 * Cơ chế chống lặp: gửi kèm mô tả các câu đã làm trước đó
 * → AI không sinh lại câu trùng.
 * <p>
 * HỢP ĐỒNG NGÔN NGỮ (quyết định product 18/08): mọi thứ học viên thấy TRONG lúc làm bài
 * (instruction_de, câu hỏi, options, câu, gợi ý) là 100% tiếng Đức đúng trình độ.
 * Giải thích vì-sao-đúng nằm ở BA field {@code explanation_de/_en/_vi} và FE chỉ hiện
 * SAU khi nộp bài — dịch nghĩa + quy tắc ngữ pháp gộp hết vào giải thích.
 * Field {@code *_vi} kiểu cũ (instruction_vi, question_vi…) chỉ còn ở session đã lưu
 * trước ngày đổi; FE giữ fallback đọc chúng.
 * <p>
 * HỢP ĐỒNG HÌNH DẠNG — mọi prompt phải yêu cầu MỘT object chứa mảng {@code "exercises"},
 * không bao giờ là mảng ở cấp cao nhất: sinh practice gọi
 * {@code chatCompletionForTier(messages, tier, temperature, maxTokens)}, overload này mặc định
 * {@code forceJson=true} nên request luôn mang {@code response_format={"type":"json_object"}} —
 * chế độ CẤM mảng ở cấp cao nhất, nên model
 * buộc phải tự bọc mảng dưới một khoá do nó đặt ({@code "content"}, {@code "uebungen"}…).
 * Đó chính là gốc của sự cố prod 17–18/08 (session 33 HOEREN, 35 SPRECHEN) và 25/08
 * (node 114 HOEREN): học viên mở ra session 0 câu. LESEN chưa từng dính vì prompt của nó
 * vốn đã yêu cầu object. Xem {@link PracticeNodeService#normalizeExercisePayload}.
 */
public final class PracticeNodePromptBuilder {

    private PracticeNodePromptBuilder() {}

    private static final int EXERCISES_PER_SESSION = 6;
    private static final int XP_PER_SESSION = 30;

    /** Khối luật ngôn ngữ dùng chung cho cả 4 prompt. */
    private static String languageBlock(String cefrLevel) {
        return """
                # SPRACHE (STRENG BEFOLGEN!)
                - ALLES, was der Lernende WÄHREND der Übung sieht (instruction_de, Fragen, Optionen,
                  Sätze, Hinweise), ist AUSSCHLIESSLICH auf Deutsch — einfach und niveaugerecht für %s.
                  KEIN Vietnamesisch, KEIN Englisch in der Aufgabe selbst!
                - Jede Übung hat DREI Erklärungsfelder (werden erst NACH dem Einreichen angezeigt):
                  explanation_de (sehr einfaches Deutsch), explanation_en (Englisch),
                  explanation_vi (Vietnamesisch). Begründung der richtigen Antwort, Übersetzung
                  und Grammatikregel gehören in diese Erklärungen — nirgendwo sonst.""".formatted(cefrLevel);
    }

    // ─────────────────────────────────────────────────────────────
    // 🎧 HÖREN (Nghe)
    // ─────────────────────────────────────────────────────────────

    public static String buildHoerenPrompt(
            String lessonTitle, String cefrLevel,
            List<String> vocabularyWords, String grammarFocus,
            List<String> seenQuestionSummaries, int generation
    ) {
        String seenBlock = buildSeenBlock(seenQuestionSummaries);
        int difficultyBoost = Math.min(generation - 1, 5); // tăng dần level

        return """
                # ROLE
                Du bist ein DaF-Prüfer am Goethe-Institut. Du erstellst Hörverstehen-Übungen
                für Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle %d Hörverstehen-Übungen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN (aus der Lektion)
                %s

                %s

                %s

                # ÜBUNGSTYPEN (mische verschiedene Typen!)
                1. LISTEN_AND_CHOOSE: Höre den Text → wähle die richtige Antwort (3 Optionen)
                2. LISTEN_AND_FILL: Höre den Satz → fülle die Lücke
                3. LISTEN_AND_ORDER: Höre den Dialog → ordne die Sätze in der richtigen Reihenfolge
                4. DICTATION: Höre den Satz → schreibe ihn auf

                # WICHTIG FÜR HÖREN
                - Jede Übung MUSS ein Feld "audio_transcript" haben (der Text, den die App vorlesen wird)
                - question_de und options: auf Deutsch, einfacher als der Transcript-Text
                - Verwende kurze, klare Sätze (max 12 Wörter pro Satz)
                - Dialog-Übungen: max 4 Zeilen
                - Nur %s-Grammatik verwenden!

                # OUTPUT FORMAT (STRICT JSON)
                Antworte NUR mit EINEM JSON-Objekt, das die %d Übungen im Feld "exercises" enthält:
                ```json
                {
                  "exercises": [
                    {
                      "type": "LISTEN_AND_CHOOSE",
                      "instruction_de": "Höre zu und wähle die richtige Antwort.",
                      "audio_transcript": "Der Zug fährt um 14 Uhr ab.",
                      "question_de": "Wann fährt der Zug ab?",
                      "options": ["Um 13 Uhr", "Um 14 Uhr", "Um 15 Uhr"],
                      "correct_index": 1,
                      "explanation_de": "Im Text steht: um 14 Uhr.",
                      "explanation_en": "The transcript clearly says: um 14 Uhr (at 2 p.m.).",
                      "explanation_vi": "Trong transcript nói rõ: um 14 Uhr (lúc 14 giờ)."
                    },
                    {
                      "type": "LISTEN_AND_FILL",
                      "instruction_de": "Höre zu und ergänze das fehlende Wort.",
                      "audio_transcript": "Guten Morgen! Wie geht es Ihnen?",
                      "sentence_with_blank": "Guten ___! Wie geht es Ihnen?",
                      "correct_answer": "Morgen",
                      "accept_also": ["morgen"],
                      "explanation_de": "Guten Morgen sagt man am Vormittag.",
                      "explanation_en": "Guten Morgen = good morning.",
                      "explanation_vi": "Guten Morgen = chào buổi sáng."
                    },
                    {
                      "type": "DICTATION",
                      "instruction_de": "Höre zu und schreibe den Satz.",
                      "audio_transcript": "Ich komme aus Vietnam.",
                      "correct_answer": "Ich komme aus Vietnam.",
                      "accept_also": ["ich komme aus Vietnam"],
                      "explanation_de": "kommen aus + Land.",
                      "explanation_en": "komme aus = come from.",
                      "explanation_vi": "komme aus = đến từ."
                    }
                  ]
                }
                ```
                Antworte NUR mit dem JSON-Objekt, NICHTS anderes!
                """.formatted(
                cefrLevel, EXERCISES_PER_SESSION, lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
                languageBlock(cefrLevel),
                seenBlock,
                cefrLevel,
                EXERCISES_PER_SESSION
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 🗣️ SPRECHEN (Nói)
    // ─────────────────────────────────────────────────────────────

    public static String buildSprechenPrompt(
            String lessonTitle, String cefrLevel,
            List<String> vocabularyWords, String grammarFocus,
            List<String> seenQuestionSummaries, int generation
    ) {
        String seenBlock = buildSeenBlock(seenQuestionSummaries);
        int difficultyBoost = Math.min(generation - 1, 5);

        return """
                # ROLE
                Du bist ein DaF-Sprechtrainer am Goethe-Institut. Du erstellst Sprechübungen
                für Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle %d Sprechübungen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN
                %s

                %s

                %s

                # ÜBUNGSTYPEN
                1. SPEAKING_REPEAT: Höre und wiederhole den Satz
                   → Felder: sentence_de, focus_sounds[]
                2. SPEAKING_RESPONSE: Beantworte die Frage mündlich
                   → Felder: question_de, expected_answer, grading_keywords[], accept_also[]
                3. SPEAKING_DESCRIBE: Beschreibe die Situation
                   → Felder: situation_de, expected_phrases[], grading_keywords[]
                4. ROLE_PLAY: Führe einen kurzen Dialog
                   → Felder: scenario_de, partner_line_de, expected_response, grading_keywords[]

                # WICHTIG FÜR SPRECHEN
                - situation_de / scenario_de: sehr einfach formulieren (max 12 Wörter), nur %s-Wortschatz
                - grading_keywords: die Schlüsselwörter die in der Antwort vorkommen müssen
                - focus_sounds: IPA-Laute zum Üben (z.B. /ʃ/, /ç/, /aɪ/)
                - Sätze: max 8 Wörter für %s

                # OUTPUT FORMAT (STRICT JSON)
                Antworte NUR mit EINEM JSON-Objekt, das die %d Übungen im Feld "exercises" enthält:
                ```json
                {
                  "exercises": [
                    {
                      "type": "SPEAKING_REPEAT",
                      "instruction_de": "Höre zu und sprich nach.",
                      "sentence_de": "Guten Morgen, Frau Müller!",
                      "focus_sounds": ["/ɡuːtən/", "/mɔʁɡən/"],
                      "explanation_de": "Achtung: Morgen spricht man /mɔʁɡən/.",
                      "explanation_en": "Pronunciation: Morgen = /mɔʁɡən/. The sentence means: Good morning, Ms Müller!",
                      "explanation_vi": "Chú ý: Morgen đọc /mɔʁɡən/. Câu này nghĩa là: Chào buổi sáng, bà Müller!"
                    },
                    {
                      "type": "SPEAKING_RESPONSE",
                      "instruction_de": "Beantworte die Frage auf Deutsch.",
                      "question_de": "Wie heißen Sie?",
                      "expected_answer": "Ich heiße...",
                      "grading_keywords": ["heiße", "ich"],
                      "accept_also": ["Mein Name ist..."],
                      "explanation_de": "Ich heiße... oder Mein Name ist... sind beide richtig.",
                      "explanation_en": "Both Ich heiße... and Mein Name ist... are correct.",
                      "explanation_vi": "Dùng Ich heiße hoặc Mein Name ist đều đúng."
                    }
                  ]
                }
                ```
                Antworte NUR mit dem JSON-Objekt, NICHTS anderes!
                """.formatted(
                cefrLevel, EXERCISES_PER_SESSION, lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
                languageBlock(cefrLevel),
                seenBlock,
                cefrLevel,
                cefrLevel,
                EXERCISES_PER_SESSION
        );
    }

    // ─────────────────────────────────────────────────────────────
    // 📖 LESEN (Đọc)
    // ─────────────────────────────────────────────────────────────

    public static String buildLesenPrompt(
            String lessonTitle, String cefrLevel,
            List<String> vocabularyWords, String grammarFocus,
            List<String> seenQuestionSummaries, int generation
    ) {
        String seenBlock = buildSeenBlock(seenQuestionSummaries);
        int difficultyBoost = Math.min(generation - 1, 5);
        int passageLength = 50 + (difficultyBoost * 15); // 50→125 words

        return """
                # ROLE
                Du bist ein DaF-Prüfer am Goethe-Institut. Du erstellst Leseverstehen-Übungen
                für Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle einen Lesetext (%d–%d Wörter) und %d Fragen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN
                %s

                %s

                %s

                # ÜBUNGSTYPEN
                1. READ_AND_CHOOSE: Lies den Text → wähle die richtige Antwort (3 Optionen)
                2. READ_TRUE_FALSE: Lies → Richtig oder Falsch?
                3. READ_AND_FILL: Lies den Text mit Lücken → fülle die fehlenden Wörter
                4. READ_AND_MATCH: Ordne Sätze den richtigen Bedeutungen zu

                # WICHTIG FÜR LESEN
                - Der Lesetext MUSS zuerst kommen (Feld "reading_passage")
                - question_de und options: auf Deutsch, einfacher als der Lesetext
                - Verwende Vokabeln aus der Lektion
                - Textformat: E-Mail, Notiz, Anzeige, Brief oder Dialog (variiere!)
                - Nur %s-Grammatik!

                # OUTPUT FORMAT (STRICT JSON)
                ```json
                {
                  "reading_passage": {
                    "text_de": "Liebe Frau Weber, ...",
                    "text_type": "E-Mail"
                  },
                  "exercises": [
                    {
                      "type": "READ_AND_CHOOSE",
                      "instruction_de": "Lies den Text und wähle die richtige Antwort.",
                      "question_de": "Wen lädt Frau Weber ein?",
                      "options": ["Die Kollegen", "Die Nachbarn", "Die Familie"],
                      "correct_index": 1,
                      "explanation_de": "Im Brief steht: Liebe Nachbarn.",
                      "explanation_en": "The letter says Liebe Nachbarn = dear neighbours.",
                      "explanation_vi": "Trong thư nói: Liebe Nachbarn = hàng xóm."
                    },
                    {
                      "type": "READ_TRUE_FALSE",
                      "instruction_de": "Lies den Satz. Richtig oder falsch?",
                      "statement_de": "Die Party ist am Sonntag.",
                      "correct_answer": false,
                      "explanation_de": "Falsch — im Text steht: am Samstag.",
                      "explanation_en": "False — the text says am Samstag (on Saturday).",
                      "explanation_vi": "Sai — trong thư nói am Samstag (thứ Bảy)."
                    }
                  ]
                }
                ```
                Antworte NUR mit dem JSON-Objekt, NICHTS anderes!
                """.formatted(
                cefrLevel,
                passageLength, passageLength + 30, EXERCISES_PER_SESSION,
                lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
                languageBlock(cefrLevel),
                seenBlock,
                cefrLevel
        );
    }

    // ─────────────────────────────────────────────────────────────
    // ✏️ SCHREIBEN (Viết)
    // ─────────────────────────────────────────────────────────────

    public static String buildSchreibenPrompt(
            String lessonTitle, String cefrLevel,
            List<String> vocabularyWords, String grammarFocus,
            List<String> seenQuestionSummaries, int generation
    ) {
        String seenBlock = buildSeenBlock(seenQuestionSummaries);
        int difficultyBoost = Math.min(generation - 1, 5);

        return """
                # ROLE
                Du bist ein DaF-Lehrer am Goethe-Institut. Du erstellst Schreibübungen
                für Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle %d Schreibübungen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN
                %s

                %s

                %s

                # ÜBUNGSTYPEN
                1. WRITE_ANSWER: Beantworte die Frage schriftlich mit einem ganzen Satz
                   → Felder: question_de, correct_answer, accept_also[]
                2. REORDER_WORDS: Ordne die Wörter zu einem richtigen Satz
                   → Felder: words[], correct_order[]
                3. FILL_GRAMMAR: Ergänze die richtige Form (Verb konjugieren, Artikel, usw.)
                   → Felder: sentence_with_blank, hint_de, correct_answer, accept_also[]
                4. FREE_WRITE: Schreibe einen kurzen Text zur Aufgabe
                   → Felder: prompt_de, min_words, example_answer, grading_keywords[]

                # WICHTIG FÜR SCHREIBEN
                - WRITE_ANSWER: akzeptiere mehrere richtige Antworten (accept_also)
                - REORDER: max 7 Wörter
                - FILL_GRAMMAR: hint_de sehr kurz und auf Deutsch (z.B. Verb: kommen, mit ich);
                  die Grammatikregel gehört in die Erklärungen!
                - FREE_WRITE: max 1 pro Session, min_words = 15–30
                - Nur %s-Grammatik!

                # OUTPUT FORMAT (STRICT JSON)
                Antworte NUR mit EINEM JSON-Objekt, das die %d Übungen im Feld "exercises" enthält:
                ```json
                {
                  "exercises": [
                    {
                      "type": "WRITE_ANSWER",
                      "instruction_de": "Beantworte die Frage mit einem ganzen Satz.",
                      "question_de": "Wie heißt du?",
                      "correct_answer": "Ich heiße Anna.",
                      "accept_also": ["Mein Name ist Anna.", "Ich bin Anna."],
                      "explanation_de": "Ich heiße..., Mein Name ist... oder Ich bin... sind alle richtig.",
                      "explanation_en": "You can answer with Ich heiße, Mein Name ist or Ich bin.",
                      "explanation_vi": "Có thể dùng Ich heiße, Mein Name ist hoặc Ich bin."
                    },
                    {
                      "type": "REORDER_WORDS",
                      "instruction_de": "Ordne die Wörter zu einem Satz.",
                      "words": ["heißt", "Wie", "Sie", "?"],
                      "correct_order": ["Wie", "heißt", "Sie", "?"],
                      "explanation_de": "W-Frage: Fragewort (Wie) + Verb (heißt) + Subjekt (Sie).",
                      "explanation_en": "W-question order: question word (Wie) + verb (heißt) + subject (Sie). Meaning: What is your name? (formal)",
                      "explanation_vi": "W-Frage: từ để hỏi (Wie) + động từ (heißt) + chủ ngữ (Sie). Nghĩa: Bạn tên gì? (trang trọng)"
                    },
                    {
                      "type": "FILL_GRAMMAR",
                      "instruction_de": "Ergänze die richtige Form des Verbs.",
                      "sentence_with_blank": "Ich ___ aus Vietnam. (kommen)",
                      "hint_de": "Verb: kommen, mit ich",
                      "correct_answer": "komme",
                      "accept_also": [],
                      "explanation_de": "ich + Verb: -en weg, -e dazu → komm + e = komme.",
                      "explanation_en": "With ich drop -en and add -e: komm + e = komme.",
                      "explanation_vi": "ich + động từ: bỏ -en, thêm -e → komm + e = komme."
                    }
                  ]
                }
                ```
                Antworte NUR mit dem JSON-Objekt, NICHTS anderes!
                """.formatted(
                cefrLevel, EXERCISES_PER_SESSION, lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
                languageBlock(cefrLevel),
                seenBlock,
                cefrLevel,
                EXERCISES_PER_SESSION
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Builds the "already seen" block to inject into AI prompts for anti-repetition.
     */
    private static String buildSeenBlock(List<String> seenQuestionSummaries) {
        if (seenQuestionSummaries == null || seenQuestionSummaries.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("# BEREITS GEZEIGTE ÜBUNGEN (NICHT WIEDERHOLEN!)\n");
        sb.append("Der Lernende hat bereits folgende Übungen gemacht. ");
        sb.append("Erstelle KOMPLETT ANDERE Übungen mit anderen Vokabeln, Satzstrukturen und Übungstypen:\n");
        for (int i = 0; i < seenQuestionSummaries.size(); i++) {
            sb.append("  ").append(i + 1).append(". ").append(seenQuestionSummaries.get(i)).append("\n");
        }
        return sb.toString();
    }

    /**
     * Selects the correct prompt builder based on skill type.
     */
    public static String buildPromptForSkill(
            String skillType, String lessonTitle, String cefrLevel,
            List<String> vocabularyWords, String grammarFocus,
            List<String> seenQuestionSummaries, int generation
    ) {
        return switch (skillType) {
            case "HOEREN" -> buildHoerenPrompt(lessonTitle, cefrLevel, vocabularyWords, grammarFocus, seenQuestionSummaries, generation);
            case "SPRECHEN" -> buildSprechenPrompt(lessonTitle, cefrLevel, vocabularyWords, grammarFocus, seenQuestionSummaries, generation);
            case "LESEN" -> buildLesenPrompt(lessonTitle, cefrLevel, vocabularyWords, grammarFocus, seenQuestionSummaries, generation);
            case "SCHREIBEN" -> buildSchreibenPrompt(lessonTitle, cefrLevel, vocabularyWords, grammarFocus, seenQuestionSummaries, generation);
            default -> throw new IllegalArgumentException("Unknown skill type: " + skillType);
        };
    }

    /**
     * Generates a short summary of an exercise for use in the "already seen" block.
     * Used when building prompts for Gen 2+ to tell AI what NOT to repeat.
     */
    public static String summarizeExercise(String type, String questionText) {
        String truncated = questionText.length() > 60 ? questionText.substring(0, 60) + "..." : questionText;
        return type + " — " + truncated;
    }
}
