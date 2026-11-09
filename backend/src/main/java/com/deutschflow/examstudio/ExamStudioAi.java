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

    JsonNode extractFacts(long userId, String level, String theme, String articleText, List<Fact> existing) {
        String clipped = articleText.length() > 14_000 ? articleText.substring(0, 14_000) : articleText;
        String existingTxt = existing.isEmpty() ? "(keine)" : existing.stream()
                .map(f -> f.id() + ": " + f.text())
                .collect(Collectors.joining("\n"));
        String user = "Niveau: " + level + "\nThema: " + (theme == null ? "frei" : theme)
                + "\n\nBestehende Fakten:\n" + existingTxt + "\n\nArtikel (Absätze durch Leerzeilen getrennt):\n"
                + clipped;
        return call(userId, "FACTS", LlmTier.CONTENT, FACTS_SYSTEM, user, 0.2, 2_500);
    }

    // ── 2. Viết bài đọc từ dữ kiện ──────────────────────────────────────────────────────────

    static final String TEXT_SYSTEM = """
            Du schreibst einen NEUEN Lesetext für telc Deutsch %s, Leseverstehen Teil 2 (Zeitungsartikel).
            Regeln:
            - Benutze NUR die gegebenen Fakten; erfinde keine Zahlen, Namen oder Studien.
            - Schreibe komplett mit eigenen Worten; übernimm keine Formulierung einer Quelle.
            - Länge des Haupttextes: %d–%d Wörter, 5–7 Absätze, kurze klare Sätze, Wortschatz %s.
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
        return call(userId, "TEXT", LlmTier.CONTENT, system, user, 0.6, 2_500);
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
            Du erstellst Aufgaben für telc Deutsch %s, Leseverstehen Teil 2: jede Aufgabe ist ein
            Satzanfang ("question", endet mit " …") mit drei Satzenden; genau EIN Ende ist laut Text richtig.
            Die Reihenfolge der Aufgaben soll NICHT der Reihenfolge des Textes folgen.

            Schwierigkeit pro Aufgabe (alles bleibt Niveau %s, nur die Fragetechnik ändert sich):
            Bewertungsskala, je 0–2 Punkte:
            - phrasing: 0 = Lösung wiederholt Wörter des Textes; 1 = umformuliert; 2 = muss erschlossen werden.
            - evidence: 0 = Beleg in einem Satz; 1 = in einem Absatz (2–3 Sätze); 2 = über ≥ 2 Absätze verteilt.
            - distractors: 0 = falsch und nicht im Text; 1 = Detail aus dem Text, falsch zugeordnet;
              2 = feine Falle (Ursache/Wirkung vertauscht, Zukunft statt Gegenwart, Negation, nur/alle,
              Zahl der falschen Gruppe zugeordnet).
            - language: 0 = Grundwortschatz; 1 = ein Wort am Rand des Niveaus; 2 = schwierige Struktur
              (Passiv, Konjunktiv II, doppelte Verneinung).
            Summe 0–1 = EASY, 2–4 = MEDIUM, 5–6 = HARD, 7–8 = EXPERT.
            EXPERT zusätzlich: Information aus ≥ 2 Absätzen kombinieren UND mindestens ein Distraktor ist
            "halb richtig" (eine Hälfte stimmt mit dem Text, die andere nicht).
            Niemals Schwierigkeit durch Wörter über dem Niveau oder durch unwichtige Details erzeugen.

            Für jede Aufgabe:
            - "options": genau 3 Objekte {"text", "correct": true|false, "trap": Fallenregel auf Deutsch
              oder null}; genau eines correct.
            - "evidence": wörtliches Zitat aus dem TEXT (nicht aus der Quelle), das die Lösung belegt.
            - "explanationVi": Erklärung auf VIETNAMESISCH, warum die Lösung richtig ist und warum jede
              falsche Option falsch ist, mit Bezug auf die Textstelle. Bezeichne Optionen NUR mit {1}, {2},
              {3} (= Reihenfolge in "options"), niemals mit a/b/c.
            - "selfScore": {"phrasing","evidence","distractors","language"} nach der Skala.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "question": "...", "options": [...], "evidence": "...",
              "explanationVi": "...", "selfScore": {...}}]}
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
                           List<Item> keep) {
        if (spec.headlines()) return generateHeadlines(userId, spec, text, slotIdx, slotLevels, keep);
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
        return call(userId, "ITEMS", LlmTier.CONTENT, system, u.toString(), 0.7, 3_500);
    }

    JsonNode generateHeadlines(long userId, TeilSpec spec, Text text, List<int[]> slotIdx, List<String> slotLevels,
                               List<Item> keep) {
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
