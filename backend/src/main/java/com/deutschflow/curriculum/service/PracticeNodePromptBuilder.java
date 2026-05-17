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
 */
public final class PracticeNodePromptBuilder {

    private PracticeNodePromptBuilder() {}

    private static final int EXERCISES_PER_SESSION = 6;
    private static final int XP_PER_SESSION = 30;

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
                für vietnamesische Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle %d Hörverstehen-Übungen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN (aus der Lektion)
                %s

                %s

                # ÜBUNGSTYPEN (mische verschiedene Typen!)
                1. LISTEN_AND_CHOOSE: Höre den Text → wähle die richtige Antwort (3 Optionen)
                2. LISTEN_AND_FILL: Höre den Satz → fülle die Lücke
                3. LISTEN_AND_ORDER: Höre den Dialog → ordne die Sätze in der richtigen Reihenfolge
                4. DICTATION: Höre den Satz → schreibe ihn auf

                # WICHTIG FÜR HÖREN
                - Jede Übung MUSS ein Feld "audio_transcript" haben (der Text, den die App vorlesen wird)
                - Verwende kurze, klare Sätze (max 12 Wörter pro Satz)
                - Dialog-Übungen: max 4 Zeilen
                - Nur %s-Grammatik verwenden!

                # ERKLÄRUNGEN auf Vietnamesisch!

                # OUTPUT FORMAT (STRICT JSON)
                Antworte NUR mit einem JSON-Array von %d Übungen:
                ```json
                [
                  {
                    "type": "LISTEN_AND_CHOOSE",
                    "instruction_vi": "Nghe và chọn đáp án đúng",
                    "audio_transcript": "Der Zug fährt um 14 Uhr ab.",
                    "question_vi": "Tàu khởi hành lúc mấy giờ?",
                    "options": ["13 Uhr", "14 Uhr", "15 Uhr"],
                    "correct_index": 1,
                    "explanation_vi": "Trong transcript nói rõ: um 14 Uhr."
                  },
                  {
                    "type": "LISTEN_AND_FILL",
                    "instruction_vi": "Nghe và điền từ còn thiếu",
                    "audio_transcript": "Guten Morgen! Wie geht es Ihnen?",
                    "sentence_with_blank": "Guten ___! Wie geht es Ihnen?",
                    "correct_answer": "Morgen",
                    "accept_also": ["morgen"],
                    "explanation_vi": "Guten Morgen = Chào buổi sáng"
                  },
                  {
                    "type": "DICTATION",
                    "instruction_vi": "Nghe và viết lại câu",
                    "audio_transcript": "Ich komme aus Vietnam.",
                    "correct_answer": "Ich komme aus Vietnam.",
                    "accept_also": ["ich komme aus Vietnam", "Ich komme aus Vietnam"],
                    "explanation_vi": "komme aus = đến từ"
                  }
                ]
                ```
                Antworte NUR mit dem JSON-Array, NICHTS anderes!
                """.formatted(
                cefrLevel, EXERCISES_PER_SESSION, lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
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
                für vietnamesische Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle %d Sprechübungen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN
                %s

                %s

                # ÜBUNGSTYPEN
                1. SPEAKING_REPEAT: Höre und wiederhole den Satz
                   → Felder: sentence_de, sentence_vi, focus_sounds[]
                2. SPEAKING_RESPONSE: Beantworte die Frage mündlich
                   → Felder: question_de, question_vi, expected_answer, grading_keywords[], accept_also[]
                3. SPEAKING_DESCRIBE: Beschreibe die Situation
                   → Felder: situation_vi, expected_phrases[], grading_keywords[]
                4. ROLE_PLAY: Führe einen kurzen Dialog
                   → Felder: scenario_vi, partner_line_de, expected_response, grading_keywords[]

                # WICHTIG FÜR SPRECHEN
                - grading_keywords: die Schlüsselwörter die in der Antwort vorkommen müssen
                - focus_sounds: IPA-Laute zum Üben (z.B. /ʃ/, /ç/, /aɪ/)
                - Sätze: max 8 Wörter für %s
                - Erklärungen auf Vietnamesisch!

                # OUTPUT FORMAT (STRICT JSON)
                Antworte NUR mit einem JSON-Array von %d Übungen:
                ```json
                [
                  {
                    "type": "SPEAKING_REPEAT",
                    "instruction_vi": "Nghe và nhắc lại câu sau",
                    "sentence_de": "Guten Morgen, Frau Müller!",
                    "sentence_vi": "Chào buổi sáng, bà Müller!",
                    "focus_sounds": ["/ɡuːtən/", "/mɔʁɡən/"],
                    "explanation_vi": "Chú ý: Morgen đọc /mɔʁɡən/, không phải /moocghen/"
                  },
                  {
                    "type": "SPEAKING_RESPONSE",
                    "instruction_vi": "Trả lời câu hỏi bằng tiếng Đức",
                    "question_de": "Wie heißen Sie?",
                    "question_vi": "Bạn tên gì?",
                    "expected_answer": "Ich heiße...",
                    "grading_keywords": ["heiße", "ich"],
                    "accept_also": ["Mein Name ist..."],
                    "explanation_vi": "Dùng 'Ich heiße' hoặc 'Mein Name ist' đều đúng."
                  }
                ]
                ```
                Antworte NUR mit dem JSON-Array, NICHTS anderes!
                """.formatted(
                cefrLevel, EXERCISES_PER_SESSION, lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
                seenBlock,
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
                für vietnamesische Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle einen Lesetext (%d–%d Wörter) und %d Fragen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN
                %s

                %s

                # ÜBUNGSTYPEN
                1. READ_AND_CHOOSE: Lies den Text → wähle die richtige Antwort (3 Optionen)
                2. READ_TRUE_FALSE: Lies → Richtig oder Falsch?
                3. READ_AND_FILL: Lies den Text mit Lücken → fülle die fehlenden Wörter
                4. READ_AND_MATCH: Ordne Sätze den richtigen Bedeutungen zu

                # WICHTIG FÜR LESEN
                - Der Lesetext MUSS zuerst kommen (Feld "reading_passage")
                - Verwende Vokabeln aus der Lektion
                - Textformat: E-Mail, Notiz, Anzeige, Brief oder Dialog (variiere!)
                - Nur %s-Grammatik!
                - Erklärungen auf Vietnamesisch!

                # OUTPUT FORMAT (STRICT JSON)
                ```json
                {
                  "reading_passage": {
                    "text_de": "Liebe Frau Weber, ...",
                    "text_type": "E-Mail",
                    "text_vi_hint": "Nội dung tóm tắt bằng tiếng Việt (chỉ hiển thị sau khi làm bài)"
                  },
                  "exercises": [
                    {
                      "type": "READ_AND_CHOOSE",
                      "instruction_vi": "Đọc đoạn văn và chọn đáp án đúng",
                      "question_vi": "Bà Weber mời ai đến bữa tiệc?",
                      "options": ["Đồng nghiệp", "Hàng xóm", "Gia đình"],
                      "correct_index": 1,
                      "explanation_vi": "Trong thư nói: 'Liebe Nachbarn' = hàng xóm"
                    },
                    {
                      "type": "READ_TRUE_FALSE",
                      "instruction_vi": "Đọc và xác định: Đúng hay Sai?",
                      "statement_de": "Die Party ist am Sonntag.",
                      "correct_answer": false,
                      "explanation_vi": "Sai — trong thư nói 'am Samstag' (thứ Bảy)."
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
                für vietnamesische Lernende auf dem Niveau %s.

                # AUFGABE
                Erstelle %d Schreibübungen zum Thema „%s".
                Grammatikfokus: %s
                Schwierigkeitsstufe: %d (1=leicht, 10=schwer)

                # VERFÜGBARE VOKABELN
                %s

                %s

                # ÜBUNGSTYPEN
                1. TRANSLATE_VI_DE: Dịch câu từ tiếng Việt sang tiếng Đức
                   → Felder: sentence_vi, correct_answer, accept_also[]
                2. REORDER_WORDS: Sắp xếp từ thành câu đúng
                   → Felder: words[], correct_order[], translation_vi
                3. FILL_GRAMMAR: Điền dạng đúng (chia động từ, mạo từ, v.v.)
                   → Felder: sentence_with_blank, hint_vi, correct_answer, accept_also[], grammar_rule_vi
                4. FREE_WRITE: Viết đoạn ngắn theo đề bài
                   → Felder: prompt_vi, prompt_de, min_words, example_answer, grading_keywords[]

                # WICHTIG FÜR SCHREIBEN
                - TRANSLATE: akzeptiere mehrere richtige Übersetzungen
                - REORDER: max 7 Wörter
                - FILL_GRAMMAR: immer grammar_rule_vi erklären!
                - FREE_WRITE: max 1 pro Session, min_words = 15–30
                - Nur %s-Grammatik! Erklärungen auf Vietnamesisch!

                # OUTPUT FORMAT (STRICT JSON)
                Antworte NUR mit einem JSON-Array von %d Übungen:
                ```json
                [
                  {
                    "type": "TRANSLATE_VI_DE",
                    "instruction_vi": "Dịch câu sau sang tiếng Đức",
                    "sentence_vi": "Tôi tên là Anna.",
                    "correct_answer": "Ich heiße Anna.",
                    "accept_also": ["Mein Name ist Anna.", "Ich bin Anna."],
                    "explanation_vi": "Có thể dùng 'Ich heiße', 'Mein Name ist' hoặc 'Ich bin'."
                  },
                  {
                    "type": "REORDER_WORDS",
                    "instruction_vi": "Sắp xếp từ thành câu hoàn chỉnh",
                    "words": ["heißt", "Wie", "Sie", "?"],
                    "correct_order": ["Wie", "heißt", "Sie", "?"],
                    "translation_vi": "Bạn tên gì? (trang trọng)",
                    "explanation_vi": "W-Frage: Fragewort (Wie) + Verb (heißt) + Subjekt (Sie)"
                  },
                  {
                    "type": "FILL_GRAMMAR",
                    "instruction_vi": "Điền dạng đúng của động từ",
                    "sentence_with_blank": "Ich ___ aus Vietnam. (kommen)",
                    "hint_vi": "Chia động từ 'kommen' với 'ich'",
                    "correct_answer": "komme",
                    "accept_also": [],
                    "grammar_rule_vi": "ich + Verb: bỏ -en, thêm -e → komm + e = komme"
                  }
                ]
                ```
                Antworte NUR mit dem JSON-Array, NICHTS anderes!
                """.formatted(
                cefrLevel, EXERCISES_PER_SESSION, lessonTitle, grammarFocus,
                3 + difficultyBoost,
                String.join(", ", vocabularyWords),
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
