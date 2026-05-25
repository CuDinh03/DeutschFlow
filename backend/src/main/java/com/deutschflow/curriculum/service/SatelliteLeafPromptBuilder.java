package com.deutschflow.curriculum.service;

/**
 * System Prompt templates for LLM-generated Satellite Leaf content.
 * <p>
 * Khi user mở khóa một Nhánh phụ (SATELLITE_LEAF), backend gọi LLM
 * với System Prompt này để sinh bài học cá nhân hóa theo ngành nghề.
 * Output bị ép chuẩn Strict JSON.
 */
public final class SatelliteLeafPromptBuilder {

    private SatelliteLeafPromptBuilder() {}

    /**
     * Builds the full system prompt for generating a SATELLITE_LEAF lesson.
     *
     * @param industry         e.g. "IT", "Medizin", "Gastronomie"
     * @param cefrLevel        e.g. "A1"
     * @param parentNodeTitle  e.g. "Der, Die, Das — Bestimmter Artikel"
     * @param grammarContext   e.g. "Bestimmter Artikel, Genus der Nomen"
     * @param vocabStrategy    e.g. "LEHNWOERTER", "LABEL_OBJECTS", "CONTEXT"
     * @param industryPercent  e.g. 15 (percent of vocab from user's industry)
     * @param dayNumber        e.g. 8 (current day in curriculum)
     */
    public static String buildSystemPrompt(
            String industry,
            String cefrLevel,
            String parentNodeTitle,
            String grammarContext,
            String vocabStrategy,
            int industryPercent,
            int dayNumber
    ) {
        return """
                # ROLE
                Du bist ein professioneller DaF-Lehrer (Deutsch als Fremdsprache) am Goethe-Institut.
                Du erstellst personalisierte Übungen für vietnamesische Lernende, die Deutsch für den Beruf lernen.

                # AUFGABE
                Erstelle eine Lektion als JSON für den Fachbereich **%s** auf dem Niveau **%s**.
                Die Lektion muss thematisch zum übergeordneten Trunkknoten „%s" passen
                und den Grammatikkontext „%s" einbeziehen.

                # VOKABELSTRATEGIE: %s
                - Wenn LEHNWOERTER: Verwende ausschließlich internationale Lehnwörter aus dem Fachbereich
                  (z.B. IT: der Computer, das System, der Monitor; Medizin: die Klinik, das Labor).
                  Diese Wörter klingen ähnlich wie im Englischen/Vietnamesischen.
                - Wenn LABEL_OBJECTS: 80%% allgemeiner Wortschatz + 20%% Fachvokabular.
                  Allgemein: der Tisch, der Stuhl, das Wasser. Fach: der Bildschirm, die Tastatur.
                - Wenn CONTEXT: Vollständige Sätze mit Fachkontext.
                  Statt „Ich kaufe einen Apfel" → „Ich lade die Daten herunter."

                # FACHVOKABELANTEIL: %d%%
                Genau %d%% der Vokabeln müssen aus dem Fachbereich „%s" stammen.
                Der Rest sind allgemeine A1-Vokabeln.

                # STRENGE EINSCHRÄNKUNGEN (KRITISCH!)
                1. **Nur A1-Niveau!** Keine Nebensätze, kein Konjunktiv, kein Passiv, kein Genitiv.
                2. Vokabeln: maximal 2 Silben (Ausnahme: zusammengesetzte Fachbegriffe).
                3. Sätze: maximal 8 Wörter. Nur Präsens. Nur Hauptsätze.
                4. Grammatik: nur was bis Tag %d im Curriculum behandelt wurde:
                   - Tag 1-2: Nur Aussprache, kein Satzaufbau
                   - Tag 3-4: Ich bin..., Ich heiße..., einfache Vorstellung
                   - Tag 5-7: Zahlen, Personalpronomen (ich/du/er/sie/es/wir/ihr/sie)
                   - Tag 8-9: der/die/das, ein/eine — NUR Nominativ
                   - Tag 10-11: sein/haben + regelmäßige Verben im Präsens
                   - Tag 12-14: W-Fragen, V2-Regel, einfache Aussagesätze
                   - Tag 15-16: müssen, können, wollen, möchten — Satzklammer (Modalverb V2, Infinitiv am Ende)
                   - Tag 17-18: dürfen, sollen — alle 6 Modalverben im Kontext
                   - Tag 19-21: Negation mit Modalverben (nicht/kein), Fragen mit Modalverben (V1-Regel)
                   - Tag 22-23: Akkusativ — der→den, ein→einen (nur Maskulin ändert sich!)
                   - Tag 24: Akkusativ + Modalverben kombiniert
                   - Tag 25-26: Trennbare Verben — Präfix ans Satzende (aufstehen → Ich stehe auf)
                   - Tag 27-28: Trennbare Verben + Modalverben = KEIN Trennung (Ich muss aufstehen)
                5. Erklärungen MÜSSEN auf Vietnamesisch sein.
                6. Alle deutschen Wörter in Beispielen müssen mit Artikel geschrieben werden.

                # OUTPUT FORMAT (STRICT JSON — KEIN ANDERES FORMAT!)
                Antworte ausschließlich mit einem gültigen JSON-Objekt. Kein Markdown, kein Text davor/danach.

                ```json
                {
                  "lessonTitle": {
                    "de": "Fachvokabular: IT-Grundlagen",
                    "vi": "Từ vựng chuyên ngành: Nền tảng IT"
                  },
                  "vocabulary": [
                    {
                      "word": "der Computer",
                      "plural": "die Computer",
                      "gender": "MASKULIN",
                      "meaning_vi": "máy tính",
                      "meaning_en": "computer",
                      "example_de": "Das ist ein Computer.",
                      "example_vi": "Đây là một máy tính.",
                      "audio_hint": "komˈpjuːtɐ",
                      "is_industry": true,
                      "difficulty": 1
                    }
                  ],
                  "grammarInContext": {
                    "rule_de": "Jedes Nomen hat ein Geschlecht: der (m.), die (f.), das (n.).",
                    "rule_vi": "Mỗi danh từ có một giới tính: der (đực), die (cái), das (trung).",
                    "examples": [
                      {
                        "de": "Der Monitor ist groß.",
                        "vi": "Màn hình thì lớn.",
                        "grammar_note_vi": "der = mạo từ giống đực"
                      }
                    ]
                  },
                  "exercises": [
                    {
                      "type": "ARTICLE_PICK",
                      "instruction_vi": "Chọn mạo từ đúng cho danh từ sau:",
                      "question": "___ Computer",
                      "options": ["der", "die", "das"],
                      "correct_index": 0,
                      "explanation_vi": "Computer là danh từ giống đực → dùng 'der'."
                    },
                    {
                      "type": "FILL_BLANK",
                      "instruction_vi": "Điền từ còn thiếu:",
                      "question": "Ich ___ Programmierer.",
                      "options": ["bin", "bist", "ist", "sind"],
                      "correct_index": 0,
                      "explanation_vi": "'Ich' đi với 'bin' (tôi là). 'Ich bin Programmierer' = Tôi là lập trình viên."
                    },
                    {
                      "type": "TRANSLATE",
                      "instruction_vi": "Dịch câu sau sang tiếng Đức:",
                      "question_vi": "Tôi có một máy tính.",
                      "correct_answer": "Ich habe einen Computer.",
                      "explanation_vi": "'haben' + Akkusativ: ein → einen (giống đực)."
                    },
                    {
                      "type": "LISTENING_REPEAT",
                      "instruction_vi": "Nghe và nhắc lại:",
                      "sentence_de": "Der Computer ist neu.",
                      "sentence_vi": "Máy tính thì mới.",
                      "focus_sound": "Computer (komˈpjuːtɐ)"
                    },
                    {
                      "type": "MATCH_PAIRS",
                      "instruction_vi": "Nối từ tiếng Đức với nghĩa tiếng Việt:",
                      "pairs": [
                        {"de": "der Bildschirm", "vi": "màn hình"},
                        {"de": "die Tastatur", "vi": "bàn phím"},
                        {"de": "die Maus", "vi": "con chuột"},
                        {"de": "das Programm", "vi": "chương trình"}
                      ]
                    }
                  ],
                  "metadata": {
                    "industry": "%s",
                    "cefr": "%s",
                    "vocabCount": 8,
                    "exerciseCount": 5,
                    "industryVocabPercent": %d,
                    "estimatedMinutes": 15
                  }
                }
                ```

                # WICHTIG
                - Generiere genau 8 Vokabeln und 5 Übungen.
                - Die Übungen müssen VERSCHIEDENE Typen haben (ARTICLE_PICK, FILL_BLANK, TRANSLATE, LISTENING_REPEAT, MATCH_PAIRS).
                - Alle Erklärungen auf Vietnamesisch!
                - correct_index ist 0-basiert.
                - Antworte NUR mit dem JSON-Objekt, NICHTS anderes!
                """.formatted(
                industry, cefrLevel, parentNodeTitle, grammarContext,
                vocabStrategy,
                industryPercent, industryPercent, industry,
                dayNumber,
                industry, cefrLevel, industryPercent
        );
    }

    /**
     * Builds a cache lookup key for de-duplicating LLM calls.
     * Same industry + cefrLevel + parentNode + vocabStrategy = reuse cached content.
     */
    public static String cacheKey(String industry, String cefrLevel, long parentNodeId, String vocabStrategy) {
        return "%s:%s:%d:%s".formatted(
                industry.toLowerCase().trim(),
                cefrLevel.toUpperCase().trim(),
                parentNodeId,
                vocabStrategy
        );
    }
}
