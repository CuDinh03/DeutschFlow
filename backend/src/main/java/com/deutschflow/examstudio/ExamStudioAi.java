package com.deutschflow.examstudio;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.examspeaking.scoring.LlmJson;
import com.deutschflow.examstudio.ExamStudioDtos.Fact;
import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.Text;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiServiceException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Mọi lời gọi LLM của Xưởng đề. Mỗi hàm một prompt, đầu ra JSON, có ghi sổ token theo admin gọi.
 *
 * <p>Tầng: sinh nội dung = {@link LlmTier#CONTENT}; chấm thang và AI "giỏi" giải đề = {@link LlmTier#GRADING_EXAM};
 * AI "yếu" (đóng vai học viên cấp dưới) = {@link LlmTier#CHAT_FREE} — model nhỏ, rẻ.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamStudioAi {

    static final String FEATURE_PREFIX = "EXAM_STUDIO_";

    private final OpenAiChatClient chatClient;
    private final LlmTierResolver tiers;
    private final AiUsageLedgerService ledger;
    private final ObjectMapper mapper;

    /**
     * Tầng model cho việc VIẾT (rút dữ kiện, viết bài, ra câu hỏi) của Teil lấy từ nguồn báo. Chạy thử
     * 11/11/2026 với tầng CONTENT (model nhỏ): bài chỉ 135/300 từ, câu "Siêu khó" chép gần nguyên một câu
     * của bài. Mặc định dùng tầng chấm thi (model lớn); đổi bằng {@code app.exam-studio.writer-tier}.
     */
    @org.springframework.beans.factory.annotation.Value("${app.exam-studio.writer-tier:GRADING_EXAM}")
    private LlmTier writerTier = LlmTier.GRADING_EXAM;

    JsonNode call(long userId, String op, LlmTier tier, String system, String user, double temperature,
                  int maxTokens) {
        AiChatCompletionResult res;
        try {
            res = chatClient.chatCompletionForTier(
                    List.of(new ChatMessage("system", system), new ChatMessage("user", user)),
                    tiers.spec(tier), temperature, maxTokens, true);
        } catch (AiServiceException e) {
            throw e;
        } catch (Exception e) {
            throw new AiServiceException("Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại.", e);
        }
        if (res == null || res.content() == null || res.content().isBlank()) {
            throw new AiServiceException("AI không trả về nội dung, vui lòng thử lại.");
        }
        try {
            ledger.record(userId, res.provider(), res.model(), res.usage(), FEATURE_PREFIX + op, null, null);
        } catch (Exception e) {
            log.warn("[ExamStudio] Không ghi được sổ token: {}", e.getMessage());
        }
        return LlmJson.parse(mapper, res.content())
                .orElseThrow(() -> new AiServiceException("AI trả JSON hỏng, hãy thử lại."));
    }

    // ── 1. Rút dữ kiện từ bài nguồn ─────────────────────────────────────────────────────────

    static final String FACTS_SYSTEM = """
            Du bereitest Material für eine Deutschprüfung (telc) vor. Du bekommst einen Zeitungs- oder
            Fachartikel. Aufgabe:
            1. Extrahiere bis zu 15 überprüfbare FAKTEN, die sich für einen Lesetext auf dem angegebenen
               Niveau eignen. Formuliere jeden Fakt mit EIGENEN Worten neu (max. 25 Wörter), übernimm keine
               Sätze aus dem Artikel. Zahlen immer mit Jahr bzw. Zeitraum.
               Verändere die AUSSAGEKRAFT nicht: Ein Zusammenhang ("hängt zusammen mit", "ist verbunden mit",
               "assoziiert") bleibt ein Zusammenhang und wird NIE zu Ursache und Wirkung ("führt zu",
               "erhöht", "senkt"). Ordne jede Aussage genau der Gruppe zu, für die der Artikel sie macht.
            2. Prüfe die Neutralität des Themas. Erlaubt: Arbeit, Wohnen, Gesundheit, Bildung, Verkehr,
               Reisen, Einkaufen, Technik im Alltag, Sport, Essen und Trinken. NICHT erlaubt: Politik,
               Migration, Krieg, Religion, umstrittene Wirtschaftsthemen. Bei Verstoß: neutral=false und
               Begründung auf Vietnamesisch.
            3. Falls bereits Fakten aus anderen Quellen gegeben sind: gib für jeden neuen Fakt "sameAs" mit der
               ID des bestehenden Fakts an, wenn er dasselbe aussagt (sonst null), und liste unter "confirms"
               die IDs bestehender Fakten, die dieser Artikel bestätigt.
            Antworte NUR mit JSON:
            {"title": "...|null", "author": "...|null", "publisher": "...|null", "publishedAt": "...|null",
             "neutral": true, "neutralityReasonVi": "...|null",
             "facts": [{"text": "...", "figure": "...|null", "year": "...|null", "paragraph": 1, "sameAs": null}],
             "confirms": []}
            """;

    static final int FACTS_MAX_CHARS = 36_000;

    JsonNode extractFacts(long userId, String level, String theme, String articleText, List<Fact> existing) {
        // 36 000 ký tự ≈ một bài khoa học 8–10 trang: với trần 14 000 cũ, phần kết quả của bài tải từ tệp
        // PDF bị cắt mất, AI chỉ còn đọc được tóm tắt và phương pháp.
        String clipped = articleText.length() > FACTS_MAX_CHARS ? articleText.substring(0, FACTS_MAX_CHARS) : articleText;
        String existingTxt = existing.isEmpty() ? "(keine)" : existing.stream()
                .map(f -> f.id() + ": " + f.text())
                .collect(Collectors.joining("\n"));
        String user = "Niveau: " + level + "\nThema: " + (theme == null ? "frei" : theme)
                + "\n\nBestehende Fakten:\n" + existingTxt + "\n\nArtikel (Absätze durch Leerzeilen getrennt):\n"
                + clipped;
        return call(userId, "FACTS", writerTier, FACTS_SYSTEM, user, 0.2, 3_000);
    }

    // ── 2. Viết bài đọc từ dữ kiện ──────────────────────────────────────────────────────────

    static final String TEXT_SYSTEM = """
            Du schreibst einen NEUEN Lesetext für telc Deutsch %s, Leseverstehen Teil 2 (Zeitungsartikel).
            Regeln:
            - Benutze NUR die gegebenen Fakten; erfinde keine Zahlen, Namen oder Studien.
            - Schreibe komplett mit eigenen Worten; übernimm keine Formulierung einer Quelle.
            - Länge des Haupttextes: MINDESTENS %d und höchstens %d Wörter, 5–7 Absätze mit je 3–5 Sätzen,
              kurze klare Sätze, Wortschatz %s. Ein kürzerer Text ist unbrauchbar. Reichen die Fakten nicht für
              die Länge, erkläre sie ausführlicher (Beispiel aus dem Alltag, Bedeutung für Betroffene), aber
              erfinde keine neuen Zahlen, Namen oder Ergebnisse.
            - Aussagekraft der Fakten beibehalten: Ein Zusammenhang wird nie zu Ursache und Wirkung. Jede
              Aussage bleibt bei der Gruppe, für die der Fakt sie macht. Pronomen und "diese/dieser" müssen
              sich eindeutig auf den richtigen Satz beziehen.
            - Zahlen immer mit Jahr. Neutraler Ton, keine Werbung, keine Politik.
            - Überschrift (titleDe) und Vorspann (vorspannDe, 1–2 Sätze, fett im Druck).
            - Höchstens 2 schwierige Wörter mit * markieren und im Glossar einfach auf Deutsch erklären.
            - Der Text muss genug Informationen für 5 Aufgaben bieten (verschiedene Absätze, Zahlen, Meinungen).
            Antworte NUR mit JSON:
            {"titleDe": "...", "vorspannDe": "...", "paragraphs": ["...", "..."],
             "glossary": [{"term": "...", "explanationDe": "..."}], "usedFactIds": ["f1", "..."]}
            """;

    static final String TEXT_T1_SYSTEM = """
            Du schreibst FÜNF NEUE kurze Texte für telc Deutsch %s, Leseverstehen Teil 1 (Kurzmeldungen aus
            Zeitung oder Internet, jeweils ein eigenes Ereignis oder Angebot).
            Regeln:
            - Benutze NUR die gegebenen Fakten; erfinde keine Zahlen, Namen oder Studien. Fehlen Fakten, ergänze
              nur harmloses Alltagswissen ohne Zahlen.
            - Komplett eigene Worte, keine Formulierung einer Quelle.
            - Jeder Text %d–%d Wörter, Wortschatz %s, klare Sätze, ein eindeutiges Hauptthema pro Text.
            - Die fünf Texte unterscheiden sich, bleiben aber im selben Themenfeld (damit verwechselbare
              Überschriften möglich sind).
            - Keine Überschriften schreiben.
            Antworte NUR mit JSON: {"texts": [{"text": "...", "usedFactIds": ["s1f1"]}]}
            """;

    JsonNode writeText(long userId, TeilSpec spec, String theme, List<Fact> facts, String note) {
        String system = spec.headlines()
                ? TEXT_T1_SYSTEM.formatted(spec.cefrLevel(), spec.minWords(), spec.maxWords(), spec.cefrLevel())
                : TEXT_SYSTEM.formatted(spec.cefrLevel(), spec.minWords(), spec.maxWords(), spec.cefrLevel());
        String user = "Thema: " + (theme == null ? "frei" : theme) + "\nFakten:\n" + facts.stream()
                .map(f -> f.id() + ": " + f.text()
                        + (f.figure() == null ? "" : " [Zahl: " + f.figure() + "]")
                        + (f.year() == null ? "" : " [Jahr: " + f.year() + "]"))
                .collect(Collectors.joining("\n"))
                + (note == null || note.isBlank() ? "" : "\n\nHinweis der Redaktion: " + note);
        return call(userId, "TEXT", writerTier, system, user, 0.6, 3_500);
    }

    static final String REWRITE_SYSTEM = """
            Du überarbeitest einen Abschnitt eines Lesetextes für telc Deutsch %s.
            Modus REWRITE: gleicher Inhalt, andere Formulierung. Modus SIMPLIFY: einfacher, kürzere Sätze,
            Wortschatz %s. Keine neuen Fakten. Antworte NUR mit JSON: {"replacement": "..."}
            """;

    JsonNode rewrite(long userId, TeilSpec spec, Text text, String selection, String mode, String note) {
        String system = REWRITE_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel());
        String user = "Modus: " + mode + "\nGanzer Text:\n" + text.context() + "\n\nAbschnitt:\n" + selection
                + (note == null || note.isBlank() ? "" : "\n\nHinweis: " + note);
        return call(userId, "TEXT", LlmTier.CONTENT, system, user, 0.5, 1_200);
    }

    // ── 3. Ra câu hỏi theo bậc ──────────────────────────────────────────────────────────────

    static final String ITEMS_SYSTEM = """
            Du erstellst Aufgaben für telc Deutsch %s, Leseverstehen Teil 2.

            FORM (wie im Original): Jede Aufgabe ist ein SATZANFANG ("question"), der mit " …" endet, und drei
            SATZENDEN ("options"), die den Satz grammatisch korrekt fortsetzen; genau EIN Ende ist laut Text
            richtig. Keine Fragesätze, kein Fragezeichen, kein "Welche Aussage …".
            Beispiel: "question": "Am Wochenende …", Enden: "schlafen viele Erwachsene länger als an
            Arbeitstagen." / "schlafen die meisten Menschen kürzer." / "arbeiten immer mehr Menschen."
            Die Reihenfolge der Aufgaben soll NICHT der Reihenfolge des Textes folgen.

            SCHWIERIGKEIT: Alles bleibt Niveau %s; nur die Fragetechnik ändert sich. Jede Stufe hat einen
            festen BAUPLAN. Halte ihn genau ein:
            - EASY: Beleg in EINEM Satz. Die Lösung benutzt die Wörter dieses Satzes. Beide falschen Enden
              nennen etwas, das im Text gar nicht vorkommt.
            - MEDIUM: Beleg in einem Absatz (2–3 Sätze). Die Lösung sagt dasselbe mit ANDEREN Wörtern
              (Synonym, andere Satzstruktur). Ein falsches Ende nimmt ein echtes Detail aus dem Text und
              ordnet es falsch zu.
            - HARD: Die Lösung steht in keinem Satz wörtlich, sie muss aus 2–3 Sätzen erschlossen werden.
              BEIDE falschen Enden benutzen echte Details aus dem Text mit einer feinen Falle (Ursache und
              Wirkung vertauscht, Zukunft statt Gegenwart, Negation, nur/alle, Zahl der falschen Gruppe
              zugeordnet).
            - EXPERT: Die Lösung verbindet Informationen aus ZWEI VERSCHIEDENEN Absätzen; kein einzelner
              Absatz reicht aus. Die Lösung benutzt kaum Wörter aus dem Text. Ein falsches Ende ist
              "halb richtig": die erste Hälfte stimmt mit dem Text, die zweite nicht.
            Niemals Schwierigkeit durch Wörter über dem Niveau oder durch unwichtige Details erzeugen. Gibt der
            Text eine verlangte Stufe nicht her, komme ihr so nah wie möglich.

            ARBEITSWEISE: Plane jede Aufgabe ZUERST im Feld "plan", dann schreibe sie:
            - "plan": {"paragraphs": [Nummern der Absätze, in denen der Beleg steht],
                       "traps": [Fallenregel je falschem Ende]}
            - "options": genau 3 Objekte {"text", "correct": true|false, "trap": Fallenregel auf Deutsch
              oder null}; genau eines correct.
            - "evidence": WÖRTLICHE, vollständige Sätze aus dem TEXT (nicht aus der Quelle), die die Lösung
              belegen — genau die Sätze aus den Absätzen in "plan.paragraphs", unverändert kopiert.
            - "explanationVi": Erklärung auf VIETNAMESISCH, warum die Lösung richtig ist und warum jede
              falsche Option falsch ist, mit Bezug auf die Textstelle. Bezeichne Optionen NUR mit {1}, {2},
              {3} (= Reihenfolge in "options"), niemals mit a/b/c.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "plan": {"paragraphs": [2], "traps": ["..."]},
              "question": "... …", "options": [...], "evidence": "...", "explanationVi": "..."}]}
            """;

    static final String ITEMS_T1_SYSTEM = """
            Du erstellst Überschriften für telc Deutsch %s, Leseverstehen Teil 1: fünf Texte, zehn Überschriften
            (a–j). Für jeden angegebenen Text schreibst du GENAU ZWEI Überschriften:
            - "headline": passt am besten zum Text (Hauptaussage, nicht nur ein Detail);
            - "nearHeadline": eine verwechselbare Falle, die NICHT passt (übertreibt "die meisten"/"alle",
              behauptet, was der Text verneint, vertauscht Rollen oder Ursache und Wirkung, greift ein
              Schlüsselwort auf, verfehlt aber die Aussage). Sie darf auch zu keinem anderen Text passen.
            Schwierigkeit pro Text (Niveau bleibt %s), je 0–2 Punkte:
            - phrasing: 0 = Überschrift wiederholt Schlüsselwörter; 1 = umformuliert; 2 = Hauptaussage erschließen.
            - evidence: 0 = ein Satz verrät alles; 1 = mehrere Sätze nötig; 2 = nur der ganze Text ergibt es.
            - distractors: 0 = Falle offensichtlich falsch; 1 = Falle nimmt ein Textdetail; 2 = feine Falle.
            - language: 0 = Grundwortschatz; 1 = ein Randwort; 2 = schwierige Struktur.
            Summe 0–1 EASY, 2–4 MEDIUM, 5–6 HARD, 7–8 EXPERT (EXPERT: Falle ist halb richtig und die Aussage
            ergibt sich aus mehreren Textteilen).
            Pro Text außerdem: "evidence" (wörtliches Zitat aus dem Text), "trap" (Fallenregel auf Deutsch),
            "explanationVi" (VIETNAMESISCH: warum {1} passt und warum {2} nicht; Überschriften NUR als {1} und
            {2} bezeichnen), "selfScore".
            Antworte NUR mit JSON: {"items": [{"slot": 0, "headline": "...", "nearHeadline": "...", "trap": "...",
              "evidence": "...", "explanationVi": "...", "selfScore": {}}]}
            """;

    JsonNode generateItems(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                           List<Item> keep, List<String> avoid) {
        return generateItems(userId, spec, text, slotIdx, slotLevels, keep, avoid, Map.of());
    }

    /** {@code hints}: slot → lời nhắc tiếng Đức vì sao lượt trước không đúng công thức của bậc (sinh lại một lần). */
    JsonNode generateItems(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                           List<Item> keep, List<String> avoid, Map<Integer, String> hints) {
        if (spec.headlines()) return generateHeadlines(userId, spec, text, slotIdx, slotLevels, keep, avoid);
        String system = ITEMS_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel());
        StringBuilder u = new StringBuilder();
        u.append("TEXT\nÜberschrift: ").append(text.titleDe()).append("\nVorspann: ").append(text.vorspannDe())
                .append("\n");
        List<String> paras = TextChecks.paragraphs(text.context());
        for (int i = 0; i < paras.size(); i++) u.append("[Absatz ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
        u.append("\nErstelle diese Aufgaben (slot → Schwierigkeit):\n");
        for (int i = 0; i < slotIdx.size(); i++) {
            u.append("slot ").append(slotIdx.get(i)[0]).append(" → ").append(slotLevels.get(i)).append("\n");
        }
        if (!keep.isEmpty()) {
            u.append("\nBereits vorhandene Aufgaben (nicht wiederholen, andere Textstellen prüfen):\n");
            for (Item it : keep) u.append("- ").append(it.question()).append(" ").append(it.options().get(it.correct())).append("\n");
        }
        if (hints != null && !hints.isEmpty()) {
            u.append("\nKORREKTUR — der erste Versuch hielt den Bauplan nicht ein. Schreibe diese Aufgaben neu:\n");
            hints.forEach((slot, hint) -> u.append("slot ").append(slot).append(": ").append(hint).append("\n"));
        }
        u.append(SituationalTeile.avoidBlock(avoid));
        return call(userId, "ITEMS", writerTier, system, u.toString(), 0.7, 4_500);
    }

    JsonNode generateHeadlines(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                               List<Item> keep, List<String> avoid) {
        StringBuilder u = new StringBuilder("TEXTE\n");
        List<String> paras = TextChecks.paragraphs(text.context());
        for (int i = 0; i < paras.size(); i++) u.append("[Text ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
        u.append("\nSchreibe Überschriften für (slot → Text → Schwierigkeit):\n");
        for (int i = 0; i < slotIdx.size(); i++) {
            int sl = slotIdx.get(i)[0];
            u.append("slot ").append(sl).append(" → Text ").append(sl + 1).append(" → ").append(slotLevels.get(i)).append("\n");
        }
        if (!keep.isEmpty()) {
            u.append("\nSchon vergebene Überschriften (nicht wiederholen):\n");
            for (Item it : keep) it.options().values().forEach(h -> u.append("- ").append(h).append("\n"));
        }
        u.append(SituationalTeile.avoidBlock(avoid));
        return call(userId, "ITEMS", LlmTier.CONTENT, ITEMS_T1_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel()),
                u.toString(), 0.7, 2_500);
    }

    // ── 4. Tự kiểm: chấm thang, giải thử ─────────────────────────────────────────────────────

    static final String RUBRIC_SYSTEM = """
            Du bist Prüfungsexperte für telc %s. Bewerte jede Aufgabe (Lösung ist angegeben) nach der Skala,
            je 0–2: phrasing (0 Wörter aus dem Text wiederholt / 1 umformuliert / 2 erschlossen),
            evidence (0 ein Satz / 1 ein Absatz / 2 ≥ 2 Absätze), distractors (0 offensichtlich falsch /
            1 Textdetail falsch zugeordnet / 2 feine Falle), language (0 Grundwortschatz / 1 ein Randwort /
            2 schwierige Struktur). Außerdem: multiParagraph (Lösung braucht ≥ 2 Absätze) und halfTrue
            (ein Distraktor ist halb richtig). Sei streng und unabhängig von früheren Einschätzungen.
            Antworte NUR mit JSON: {"items": [{"id": "...", "phrasing": 0, "evidence": 0, "distractors": 0,
              "language": 0, "multiParagraph": false, "halfTrue": false}]}
            """;

    JsonNode rubric(long userId, TeilSpec spec, Text text, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, RUBRIC_SYSTEM.formatted(spec.cefrLevel()),
                textBlock(spec, text) + "\nAUFGABEN MIT LÖSUNG:\n" + itemsBlock(spec, items, true), 0.0, 2_000);
    }

    static final String SOLVE_SYSTEM = """
            Löse die Aufgaben zum Text. Wähle pro Aufgabe den Buchstaben der passenden Option bzw. Überschrift
            (jede Überschrift höchstens einmal).
            Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": "a"}]}
            """;

    static final String WEAK_SOLVE_SYSTEM = """
            Du bist ein Deutschlerner auf Niveau A2. Du liest langsam und verstehst schwierige Sätze
            nicht immer. Löse die Aufgaben zum Text so, wie ein A2-Lerner es tun würde (wähle den Buchstaben).
            Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": "a"}]}
            """;

    static final String BLIND_SOLVE_SYSTEM = """
            Du siehst NUR Aufgaben, keinen Text. Gib eine Antwort nur dann an, wenn du die Lösung ohne Text
            sicher erkennen kannst (z. B. weil nur eine Option logisch oder allgemein bekannt ist);
            sonst "answer": null. Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": null}]}
            """;

    // ── 4b. Kiểm bài khớp dữ kiện; giải khi chỉ thấy một đoạn ─────────────────────────────────

    static final String FAITHFUL_SYSTEM = """
            Du prüfst einen Lesetext für eine Deutschprüfung gegen die FAKTEN, aus denen er geschrieben wurde.
            Melde jeden Satz des Textes, der
            - UNSUPPORTED: eine Zahl, einen Namen, ein Ergebnis oder einen Vergleich enthält, der in keinem Fakt steht;
            - CAUSAL: einen Zusammenhang als Ursache und Wirkung darstellt, obwohl der Fakt nur einen
              Zusammenhang nennt (oder umgekehrt);
            - WRONG_LINK: eine Aussage der falschen Gruppe, Zeit oder Sache zuordnet (auch durch ein Pronomen
              oder "diese", das sich auf den falschen Satz bezieht).
            Allgemeine Erklärungen ohne neue Zahlen oder Ergebnisse sind erlaubt und werden NICHT gemeldet.
            Sei genau; melde nichts, was die Fakten decken. "problemVi" auf VIETNAMESISCH, ein Satz.
            Antworte NUR mit JSON: {"issues": [{"sentence": "wörtlicher Satz aus dem Text",
              "type": "UNSUPPORTED|CAUSAL|WRONG_LINK", "problemVi": "..."}]}
            """;

    JsonNode faithfulness(long userId, TeilSpec spec, Text text, List<Fact> facts) {
        String factsTxt = facts.stream().map(f -> "- " + f.text()
                + (f.figure() == null ? "" : " [Zahl: " + f.figure() + "]")
                + (f.year() == null ? "" : " [Jahr: " + f.year() + "]")).collect(Collectors.joining("\n"));
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, FAITHFUL_SYSTEM,
                "FAKTEN:\n" + factsTxt + "\n\n" + textBlock(spec, text), 0.0, 1_500);
    }

    static final String ONE_PARAGRAPH_SYSTEM = """
            Zu jeder Aufgabe siehst du NUR EINEN Absatz eines längeren Textes. Gib eine Antwort nur dann an,
            wenn dieser eine Absatz die Lösung sicher belegt und kein weiterer Absatz nötig ist; sonst
            "answer": null. Rate nicht.
            Antworte NUR mit JSON: {"answers": [{"id": "...", "answer": null}]}
            """;

    /** {@code paragraphOf}: mã câu → đoạn duy nhất AI được xem. Câu giải được ở đây không phải câu gộp hai đoạn. */
    JsonNode solveOneParagraph(long userId, List<Item> items, Map<String, String> paragraphOf) {
        StringBuilder sb = new StringBuilder();
        for (Item it : items) {
            String para = paragraphOf.get(it.id());
            if (para == null) continue;
            sb.append(it.id()).append("\n  Absatz: ").append(para).append("\n  Aufgabe: ").append(it.question()).append("\n");
            for (String l : ItemRules.LETTERS) sb.append("  ").append(l).append(") ").append(it.options().get(l)).append("\n");
        }
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, ONE_PARAGRAPH_SYSTEM, sb.toString(), 0.0, 800);
    }

    JsonNode solveStrong(long userId, TeilSpec spec, Text text, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, SOLVE_SYSTEM,
                textBlock(spec, text) + "\nAUFGABEN:\n" + itemsBlock(spec, items, false), 0.0, 800);
    }

    JsonNode solveWeak(long userId, TeilSpec spec, Text text, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.CHAT_FREE, WEAK_SOLVE_SYSTEM,
                textBlock(spec, text) + "\nAUFGABEN:\n" + itemsBlock(spec, items, false), 0.3, 800);
    }

    JsonNode solveBlind(long userId, TeilSpec spec, List<Item> items) {
        return call(userId, "VERIFY", LlmTier.GRADING_EXAM, BLIND_SOLVE_SYSTEM,
                "AUFGABEN:\n" + itemsBlock(spec, items, false), 0.0, 800);
    }

    static String textBlock(TeilSpec spec, Text text) {
        List<String> paras = TextChecks.paragraphs(text.context());
        StringBuilder sb = new StringBuilder();
        if (spec.headlines()) {
            sb.append("TEXTE\n");
            for (int i = 0; i < paras.size(); i++) sb.append("[Text ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
            return sb.toString();
        }
        sb.append("TEXT\n").append(text.titleDe()).append("\n").append(text.vorspannDe()).append("\n");
        for (int i = 0; i < paras.size(); i++) sb.append("[Absatz ").append(i + 1).append("] ").append(paras.get(i)).append("\n");
        return sb.toString();
    }

    static String itemsBlock(TeilSpec spec, List<Item> items, boolean withKey) {
        StringBuilder sb = new StringBuilder();
        if (spec.headlines()) {
            Map<String, String> all = new TreeMap<>();
            for (Item it : items) all.putAll(it.options());
            sb.append("ÜBERSCHRIFTEN\n");
            all.forEach((l, h) -> sb.append("  ").append(l).append(") ").append(h).append("\n"));
            for (Item it : items) {
                sb.append(it.id()).append(": ").append(it.question()).append("\n");
                if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
            }
            return sb.toString();
        }
        for (Item it : items) {
            sb.append(it.id()).append(": ").append(it.question()).append("\n");
            for (String l : ItemRules.LETTERS) sb.append("  ").append(l).append(") ").append(it.options().get(l)).append("\n");
            if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
        }
        return sb.toString();
    }
}
