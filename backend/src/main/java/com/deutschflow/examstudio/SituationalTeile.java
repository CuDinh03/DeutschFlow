package com.deutschflow.examstudio;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.text.Collator;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Xưởng đề đợt 3 — các Teil soạn theo tình huống đời thường (owner chốt 09/11: không lấy từ báo):
 * Lesen Teil 3 ({@code MATCH_AD_X}), Sprachbausteine Teil 1 ({@code GAP_MC}) và Teil 2 ({@code GAP_WORDBANK}),
 * Schreiben ({@code WRITE_EMAIL}). Khuôn đầu ra lấy đúng theo đề telc B1 Set 2 (V343).
 *
 * <p>Sprachbausteine: AI viết bức thư NGUYÊN VẸN trước, rồi mới chọn từ để đục lỗ. Mỗi lỗ định vị bằng
 * {@code before + target} (cụm đứng trước + từ gốc) chứ không bằng số thứ tự ký tự — AI đếm ký tự rất kém. Số ô
 * (21–30, 31–40) đánh theo thứ tự xuất hiện trong thư, như đề thật.
 *
 * <p>Phần Nghe (đợt 5, ba dạng {@code HOEREN_*}) nằm ở {@link HoerenTeile}; mọi nhánh theo dạng Teil ở đây gọi sang đó.
 */
@Component
@RequiredArgsConstructor
public class SituationalTeile {

    private final ExamStudioAi ai;

    // ── Bài / tình huống ────────────────────────────────────────────────────────────────────

    static final String ADS_SYSTEM = """
            Du schreibst Material für telc Deutsch %s, Leseverstehen (Anzeigen). Schreibe GENAU %d kurze,
            realistische Kleinanzeigen (je %d–%d Wörter) aus EINER deutschen oder österreichischen Stadt: Angebote
            und Gesuche aus dem Alltag (Wohnen, Kurse, Dienstleistungen, Verkauf, Freizeit, Arbeit). Einige Anzeigen
            sollen sich ähneln und nur in EINER Bedingung unterscheiden (kaufen/mieten, mit/ohne Haustier, Erfahrung
            nötig, Uhrzeit, Angebot/Gesuch), damit später feine Fallen möglich sind. Keine echten Firmennamen,
            Telefonnummern im Format 0xxx-xx xx xx, E-Mails auf example.de.
            Schreibe außerdem %s
            Antworte NUR mit JSON: {"city": "...", "ads": ["...", "..."],
              "examples": [{"situation": "...", "adIndex": 3}, {"situation": "...", "adIndex": null}]}
            """;

    static final String LETTER_SYSTEM = """
            Du schreibst für telc Deutsch %s, Sprachbausteine Teil 1, einen NEUEN halbformellen oder formellen
            Brief bzw. eine E-Mail (Beschwerde, Anfrage, Bitte um Information, Kündigung o. Ä.) mit Anrede und Gruß,
            %d–%d Wörter, Sie-Form, natürliches Deutsch auf Niveau %s. Der Text muss viele grammatische
            Ansatzpunkte bieten: Konnektoren (weil, obwohl, deshalb, wenn/ob/dass, damit), Präpositionen mit Kasus,
            Relativpronomen, Adjektivendungen, Perfekt mit haben/sein, Konjunktiv II (würde/hätte/wäre), Modalverben,
            Reflexivpronomen. KEINE Lücken einbauen.
            Antworte NUR mit JSON: {"letter": "Sehr geehrte …\\n\\n…\\n\\nMit freundlichen Grüßen\\nName"}
            """;

    static final String AD_LETTER_SYSTEM = """
            Du schreibst für telc Deutsch %s, Sprachbausteine Teil 2: (1) eine kurze Anzeige oder Mitteilung
            (25–45 Wörter, z. B. Kurs, Verein, Wohnungs- oder Jobangebot) und (2) einen Brief, der auf diese Anzeige
            antwortet (%d–%d Wörter, Anrede und Gruß, Sie-Form, Fragen und Bitten). Natürliches Deutsch, Niveau %s,
            viele Funktionswörter (Präpositionen, Konnektoren, Modalverben, Pronomen). KEINE Lücken einbauen.
            Antworte NUR mit JSON: {"stimulusAd": "...", "letter": "..."}
            """;

    static final String EMAIL_SYSTEM = """
            Du schreibst für telc Deutsch %s, Schriftlicher Ausdruck, eine E-Mail von einem Freund oder einer
            Freundin (du-Form, %d–%d Wörter) mit Betreff. Die E-Mail enthält genau die Anknüpfungspunkte für VIER
            Leitpunkte nach dem Muster des echten Tests: (1) Reaktion auf einen Vorschlag/eine Bitte/Einladung,
            (2) etwas über die eigene Situation (Wohnung, Pläne, Heimatland, Arbeit …), (3) einen Tipp oder Vorschlag
            geben, (4) etwas Neues erzählen oder eine Frage zurückstellen. Formuliere die vier Leitpunkte als kurze
            Aufgaben in Sie-Form (z. B. "Reaktion auf die Einladung: Können Sie kommen?").
            Antworte NUR mit JSON: {"from": "Vorname", "subject": "...", "body": "...", "points": ["...", "...", "...", "..."]}
            """;

    // ── A2 (Start Deutsch 2) ──
    static final String INFO_SYSTEM = """
            Du schreibst für telc Deutsch %s (Start Deutsch 2), Lesen Teil 1, eine kurze ÖFFENTLICHE INFORMATION:
            z. B. Wegweiser eines Kaufhauses/Rathauses/Krankenhauses, Programm eines Volkshochschulkurses, Seite
            einer Website mit Rubriken. Insgesamt %d–%d Wörter, als 8–14 kurze Zeilen ("2. Stock: Damenmode, Kinder-
            abteilung"). Einfache Wörter, viele konkrete Orte/Zeiten, damit fünf Alltagsaufgaben möglich sind.
            Antworte NUR mit JSON: {"title": "...", "lines": ["...", "..."]}
            """;

    static final String RF_TEXT_SYSTEM = """
            Du schreibst für telc Deutsch %s (Start Deutsch 2), Lesen Teil 2, einen NEUEN Text: eine persönliche
            E-Mail oder einen kurzen Zeitungs-/Zeitschriftenartikel über ein Alltagsthema, %d–%d Wörter, einfache
            Hauptsätze, Perfekt erlaubt. Der Text muss genug konkrete Aussagen für fünf richtig/falsch-Aufgaben haben.
            Antworte NUR mit JSON: {"title": "...", "text": "..."}
            """;

    static final String FORM_TEXT_SYSTEM = """
            Du schreibst für telc Deutsch %s (Start Deutsch 2), Schreiben Teil 1, einen kurzen Text (%d–%d Wörter):
            Eine Person (Freund/Bekannte/Kollege) möchte sich für etwas anmelden (Kurs, Verein, Bibliothek, Reise)
            und erzählt dabei Informationen über sich (Adresse, Telefonnummer, Geburtsdatum, Kurstag, Zahlungsart …).
            Mindestens SIEBEN konkrete Informationen, davon zwei mit Zahlen. Gib auch den Titel des Formulars.
            Antworte NUR mit JSON: {"formTitle": "Anmeldung …", "text": "..."}
            """;

    static final String NOTE_SYSTEM = """
            Du schreibst für telc Deutsch %s (Start Deutsch 2), Schreiben Teil 2, eine Schreibaufgabe: eine kurze
            Situation in Sie-Form (%d–%d Wörter, z. B. "Sie haben am Samstag eine Einladung zu einer Party bekommen,
            können aber nicht kommen. Schreiben Sie eine E-Mail an Ihre Freundin.") und GENAU VIER kurze Punkte, von
            denen die Kandidaten drei auswählen (z. B. "Grund", "Geschenk", "neuer Termin", "Gruß an die Familie").
            Antworte NUR mit JSON: {"title": "...", "situation": "...", "points": ["...", "...", "...", "..."]}
            """;

    Text writeText(long userId, TeilSpec spec, String theme, String situation, String note, List<String> avoid) {
        String user = "Themenfeld: " + (theme == null ? "frei (Alltag)" : theme)
                + "\nSituation der Redaktion: " + (situation == null || situation.isBlank() ? "frei wählen" : situation)
                + (note == null || note.isBlank() ? "" : "\nHinweis: " + note)
                + avoidBlock(avoid);
        String lv = spec.cefrLevel();
        if (spec.listening()) return HoerenTeile.writeText(ai, userId, spec, user);
        return switch (spec.teilType()) {
            case "MATCH_AD_X" -> {
                int n = spec.textCount();
                String exInstr = spec.exampleCount() >= 2
                        ? "ZWEI Beispiel-Situationen: die erste passt zu genau einer Anzeige (adIndex 0–" + (n - 1)
                        + "), die zweite passt zu keiner (adIndex null)."
                        : "EINE Beispiel-Situation, die zu genau einer Anzeige passt (adIndex 0–" + (n - 1) + ").";
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT,
                        ADS_SYSTEM.formatted(lv, n, spec.minWords(), spec.maxWords(), exInstr), user, 0.7, 3_000);
                List<String> ads = new ArrayList<>();
                out.path("ads").forEach(a -> {
                    String t = a.isTextual() ? a.asText() : a.path("text").asText("");
                    if (!t.isBlank()) ads.add(t.replaceAll("\\s+", " ").trim());
                });
                if (ads.size() < n) throw new IllegalStateException("AI chỉ trả " + ads.size() + "/" + n + " mẩu rao vặt, hãy thử lại.");
                Map<String, String> adMap = new LinkedHashMap<>();
                for (int i = 0; i < n; i++) adMap.put(TeilSpec.AD_LETTERS.get(i), ads.get(i));
                List<Example> examples = new ArrayList<>();
                JsonNode ex = out.path("examples");
                if (ex.size() >= 1) {
                    JsonNode e1 = ex.get(0);
                    int idx = e1.path("adIndex").asInt(-1);
                    if (idx >= 0 && idx < n) examples.add(new Example("01", e1.path("situation").asText(""), TeilSpec.AD_LETTERS.get(idx)));
                    if (spec.exampleCount() >= 2 && ex.size() >= 2) {
                        examples.add(new Example("02", ex.get(1).path("situation").asText(""), "x"));
                    }
                }
                yield new Text("", "", String.join("\n\n", ads.subList(0, n)), List.of(), adMap, examples,
                        null, null, null, null);
            }
            case "GAP_MC" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT,
                        LETTER_SYSTEM.formatted(lv, spec.minWords(), spec.maxWords(), lv), user, 0.6, 1_800);
                String letter = out.path("letter").asText("").trim();
                if (letter.isBlank()) throw new IllegalStateException("AI không trả bức thư.");
                yield new Text("", "", letter, List.of());
            }
            case "GAP_WORDBANK" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT,
                        AD_LETTER_SYSTEM.formatted(lv, spec.minWords(), spec.maxWords(), lv), user, 0.6, 1_800);
                String letter = out.path("letter").asText("").trim();
                String ad = out.path("stimulusAd").asText("").trim();
                if (letter.isBlank() || ad.isBlank()) throw new IllegalStateException("AI không trả đủ mẩu tin và bức thư.");
                yield new Text("", "", letter, List.of(), null, null, ad, null, null, null);
            }
            case "MC_INFO" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT, INFO_SYSTEM.formatted(lv, spec.minWords(),
                        spec.maxWords()), user, 0.7, 1_500);
                List<String> lines = new ArrayList<>();
                out.path("lines").forEach(l -> { if (!l.asText("").isBlank()) lines.add(l.asText().trim()); });
                if (lines.size() < 6) throw new IllegalStateException("AI trả bảng thông tin quá ngắn, hãy thử lại.");
                yield new Text(firstNonBlank(out.path("title").asText(null), "Information"), "", String.join("\n", lines), List.of());
            }
            case "TRUE_FALSE" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT, RF_TEXT_SYSTEM.formatted(lv, spec.minWords(),
                        spec.maxWords()), user, 0.7, 1_500);
                String body = out.path("text").asText("").trim();
                if (body.isBlank()) throw new IllegalStateException("AI không trả bài đọc.");
                yield new Text(firstNonBlank(out.path("title").asText(null), ""), "", body, List.of());
            }
            case "FILL_FORM" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT, FORM_TEXT_SYSTEM.formatted(lv, spec.minWords(),
                        spec.maxWords()), user, 0.7, 1_500);
                String body = out.path("text").asText("").trim();
                if (body.isBlank()) throw new IllegalStateException("AI không trả đoạn văn.");
                yield new Text(firstNonBlank(out.path("formTitle").asText(null), "Anmeldung"), "", body, List.of());
            }
            case "WRITE_NOTE" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT, NOTE_SYSTEM.formatted(lv, spec.minWords(),
                        spec.maxWords()), user, 0.7, 1_200);
                String body = out.path("situation").asText("").trim();
                List<String> points = new ArrayList<>();
                out.path("points").forEach(pt -> { if (!pt.asText("").isBlank()) points.add(pt.asText().trim()); });
                if (body.isBlank() || points.size() != 4) throw new IllegalStateException("AI không trả đủ tình huống và 4 ý.");
                Stimulus st = new Stimulus("SITUATION", null, firstNonBlank(out.path("title").asText(null), ""), body);
                yield new Text("", "", body, List.of(), null, null, null, null, st, points);
            }
            case "WRITE_EMAIL" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT,
                        EMAIL_SYSTEM.formatted(lv, spec.minWords(), spec.maxWords()), user, 0.7, 1_500);
                String body = out.path("body").asText("").trim();
                List<String> points = new ArrayList<>();
                out.path("points").forEach(p -> { if (!p.asText("").isBlank()) points.add(p.asText().trim()); });
                if (body.isBlank() || points.size() != 4) throw new IllegalStateException("AI không trả đủ E-Mail và 4 Leitpunkte.");
                Stimulus st = new Stimulus("EMAIL", firstNonBlank(out.path("from").asText(null), "Alex"),
                        firstNonBlank(out.path("subject").asText(null), "Hallo"), body);
                yield new Text("", "", body, List.of(), null, null, null, null, st, points);
            }
            default -> throw new IllegalStateException("Dạng Teil lạ: " + spec.teilType());
        };
    }

    // ── Câu hỏi ─────────────────────────────────────────────────────────────────────────────

    static final String SITUATIONS_SYSTEM = """
            Du erstellst Situationen für telc Deutsch %s, Leseverstehen (Anzeigen). Gegeben sind die Anzeigen.
            Schreibe für jeden angegebenen slot EINE Situation (1–2 Sätze, Sie-Form, "Sie suchen …", "Ihre Tochter
            möchte …") und nenne "answer": den Buchstaben der passenden Anzeige ODER "x", wenn keine passt.
            Regeln: jede Anzeige ist höchstens EINMAL Lösung; die gesperrten Buchstaben nicht verwenden; genau so
            viele "x" wie verlangt. "near" = Buchstabe der Anzeige, die am ehesten verwechselt wird (bei x: die
            fast passende Anzeige), "trap" = warum sie NICHT passt (eine Bedingung weicht ab).
            Schwierigkeit (Niveau bleibt %s), je 0–2: phrasing (Situation nimmt Wörter der Anzeige auf / umschrieben /
            muss erschlossen werden), evidence (eine Bedingung / zwei / mehrere kombinieren), distractors (near
            offensichtlich anders / teilweise ähnlich / weicht nur in einem Detail ab), language. Summe 0–1 EASY,
            2–4 MEDIUM, 5–6 HARD, 7–8 EXPERT.
            "evidence" = wörtliches Stück aus der Lösungs-Anzeige (bei x aus der near-Anzeige), "explanationVi" =
            VIETNAMESISCHE Erklärung mit den echten Buchstaben.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "situation": "...", "answer": "e", "near": "h",
              "trap": "...", "evidence": "...", "explanationVi": "...", "selfScore": {}}]}
            """;

    static final String GAPS_SYSTEM = """
            Du wählst Lücken für telc Deutsch %s, Sprachbausteine Teil 1 (Mehrfachauswahl a/b/c). Gegeben ist ein
            Brief. Wähle für jeden slot EIN Wort im Brief, das zur Lücke wird, passend zur verlangten Schwierigkeit.
            Typische Phänomene: Konnektor/Nebensatz, Verb/Adjektiv + Präposition, Pronominaladverb, Deklination
            (Adjektivendung, Artikel, Dativ Plural), Verbform (Perfekt-Hilfsverb, Konjunktiv II, Modalverb, Passiv),
            Reflexiv-/Personalpronomen, Partikel/Adverb. ~70 %% der Lücken: drei Formen DESSELBEN Wortes
            (Ihr/Ihrem/Ihren, war/wäre/würde); sonst drei Funktionswörter derselben Klasse (weil/obwohl/damit).
            - "target": das Wort GENAU wie im Brief (ein einzelnes Wort);
            - "before": die 3–6 Wörter, die im Brief DIREKT vor dem Wort stehen, genau abgeschrieben;
            - "options": genau 3 Objekte {"text","correct"}; das richtige ist target;
            - keine zwei Lücken im selben Satzteil, nicht in Anrede/Gruß, nicht schon gewählte Wörter;
            - "explanationVi": VIETNAMESISCH, Optionen NUR als {1}/{2}/{3};
            - "selfScore": phrasing (Lösung lokal erkennbar=0 … braucht Satzkontext=2), evidence (Signal direkt
              daneben=0 … im Nachbarsatz=2), distractors, language; Summe 0–1 EASY, 2–4 MEDIUM, 5–6 HARD, 7–8 EXPERT.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "target": "...", "before": "...", "options": [...],
              "phenomenon": "...", "explanationVi": "...", "selfScore": {}}]}
            """;

    static final String BANK_SYSTEM = """
            Du wählst Lücken für telc Deutsch %s, Sprachbausteine Teil 2 (Wortkasten a–o). Gegeben sind eine Anzeige
            und ein Brief. Wähle für jeden slot EIN Wort im Brief als Lücke: überwiegend Funktionswörter
            (Präpositionen, Konnektoren, Pronomen, Modalverben, Partikeln), dazu höchstens 3–5 Verb-/Partizip-/
            Adjektivformen. Kein Wort doppelt.
            - "target": GENAU wie im Brief (ein Wort); "before": 3–6 Wörter direkt davor, genau abgeschrieben;
            - "explanationVi": VIETNAMESISCH, nenne das Wort in GROSSBUCHSTABEN;
            - "selfScore" wie üblich (Summe 0–1 EASY … 7–8 EXPERT); HARD/EXPERT: das Lösungswort hat ein
              verwechselbares Gegenstück im Kasten (MICH/MIR, WÄRE/WÜRDE, WANN/WENN, OB/DASS, VORHER/BEVOR).
            Außerdem "distractors": %d Wörter für den Kasten, die NICHT gebraucht werden, aber mit Lösungswörtern
            verwechselbar sind (Paare wie oben), in GROSSBUCHSTABEN.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "target": "...", "before": "...", "explanationVi": "...",
              "selfScore": {}}], "distractors": ["..."]}
            """;

    /** Kết quả sinh câu: danh sách câu mới (đã đánh số theo khuôn) + bài có thể đổi (hộp từ) + câu hỏng. */
    record ItemsResult(List<Item> items, Text text, List<String> problems) {}

    ItemsResult generateItems(long userId, TeilSpec spec, Text text, List<Item> current, List<Integer> slots,
                              List<String> levels, List<String> avoid, Random rnd) {
        if (spec.listening()) return HoerenTeile.generateItems(ai, userId, spec, text, current, slots, levels, avoid, rnd);
        return switch (spec.teilType()) {
            case "MATCH_AD_X" -> situations(userId, spec, text, current, slots, levels, avoid);
            case "GAP_MC" -> gaps(userId, spec, text, current, slots, levels, rnd);
            case "GAP_WORDBANK" -> bankGaps(userId, spec, text, current, slots, levels);
            case "MC_INFO", "TRUE_FALSE", "FILL_FORM" -> simpleItems(userId, spec, text, current, slots, levels, avoid, rnd);
            default -> throw new IllegalStateException("Phần Viết không có câu hỏi trắc nghiệm.");
        };
    }

    private ItemsResult situations(long userId, TeilSpec spec, Text text, List<Item> current, List<Integer> slots,
                                   List<String> levels, List<String> avoid) {
        Set<Integer> todo = new HashSet<>(slots);
        Set<String> locked = new LinkedHashSet<>();
        int keptX = 0;
        for (int s = 0; s < current.size(); s++) {
            Item it = current.get(s);
            if (it == null || todo.contains(s)) continue;
            if ("x".equals(it.correct())) keptX++;
            else locked.add(it.correct());
        }
        if (text.examples() != null) text.examples().stream().filter(e -> !"x".equals(e.answer())).forEach(e -> locked.add(e.answer()));
        int needX = Math.max(0, spec.xCount() - keptX);
        StringBuilder u = new StringBuilder("ANZEIGEN\n");
        text.ads().forEach((l, a) -> u.append(l).append(") ").append(a).append("\n"));
        u.append("\nGesperrte Buchstaben (schon Lösung oder Beispiel): ").append(locked.isEmpty() ? "keine" : String.join(", ", locked));
        u.append("\nAnzahl \"x\" unter den neuen Situationen: genau ").append(Math.min(needX, slots.size()));
        u.append("\n\nSlots:\n");
        for (int i = 0; i < slots.size(); i++) u.append("slot ").append(slots.get(i)).append(" → ").append(levels.get(i)).append("\n");
        List<String> keptSituations = new ArrayList<>();
        for (int s = 0; s < current.size(); s++) if (current.get(s) != null && !todo.contains(s)) keptSituations.add(current.get(s).question());
        if (!keptSituations.isEmpty()) u.append("\nVorhandene Situationen (nicht wiederholen):\n- ").append(String.join("\n- ", keptSituations));
        u.append(avoidBlock(avoid));
        JsonNode out = ai.call(userId, "ITEMS", LlmTier.CONTENT, SITUATIONS_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel()),
                u.toString(), 0.7, 3_000);

        List<Item> result = new ArrayList<>(current);
        while (result.size() < spec.itemCount()) result.add(null);
        List<String> problems = new ArrayList<>();
        Set<String> used = new HashSet<>(locked);
        Map<Integer, JsonNode> bySlot = bySlot(out, slots);
        for (int i = 0; i < slots.size(); i++) {
            int s = slots.get(i);
            JsonNode n = bySlot.get(s);
            String sit = n == null ? null : textOf(n, "situation");
            String ans = n == null ? null : textOf(n, "answer");
            String near = n == null ? null : textOf(n, "near");
            ans = ans == null ? null : ans.trim().toLowerCase(Locale.ROOT);
            near = near == null ? null : near.trim().toLowerCase(Locale.ROOT);
            boolean ansOk = ans != null && ("x".equals(ans) || (text.ads().containsKey(ans) && !used.contains(ans)));
            if (sit == null || !ansOk || near == null || !text.ads().containsKey(near) || near.equals(ans)) {
                problems.add(spec.itemId(s));
                continue;
            }
            if (!"x".equals(ans)) used.add(ans);
            Map<String, String> opts = new TreeMap<>();
            if (!"x".equals(ans)) opts.put(ans, text.ads().get(ans));
            opts.put(near, text.ads().get(near));
            String trap = textOf(n, "trap");
            Item old = result.get(s);
            result.set(s, new Item(spec.itemId(s), sit, opts, ans, firstNonBlank(textOf(n, "explanationVi"), ""),
                    firstNonBlank(textOf(n, "evidence"), ""), trap == null ? List.of() : List.of(new Trap(near, trap)),
                    levels.get(i), null, old != null && old.locked(), null, List.of(), null));
        }
        return new ItemsResult(result, text, problems);
    }

    private ItemsResult gaps(long userId, TeilSpec spec, Text text, List<Item> current, List<Integer> slots,
                             List<String> levels, Random rnd) {
        String letter = text.context();
        Set<Integer> todo = new HashSet<>(slots);
        List<Item> kept = new ArrayList<>();
        for (int s = 0; s < current.size(); s++) if (current.get(s) != null && !todo.contains(s)) kept.add(current.get(s));
        StringBuilder u = new StringBuilder("BRIEF\n").append(letter).append("\n\nSlots:\n");
        for (int i = 0; i < slots.size(); i++) u.append("slot ").append(slots.get(i)).append(" → ").append(levels.get(i)).append("\n");
        if (!kept.isEmpty()) {
            u.append("\nSchon gewählte Wörter (nicht noch einmal, nicht im selben Satzteil): ");
            u.append(String.join(", ", kept.stream().map(k -> meta(k, "before") + " [" + meta(k, "target") + "]").toList()));
        }
        JsonNode out = ai.call(userId, "ITEMS", LlmTier.CONTENT, GAPS_SYSTEM.formatted(spec.cefrLevel()), u.toString(), 0.6, 3_500);
        Map<Integer, JsonNode> bySlot = bySlot(out, slots);

        record Placed(int pos, Item item, List<ItemRules.RawOption> raw, String explanation, boolean fresh) {}
        List<Placed> placed = new ArrayList<>();
        Set<Integer> taken = new HashSet<>();
        for (Item k : kept) {
            int pos = locate(letter, meta(k, "before"), meta(k, "target"));
            if (pos >= 0) {
                placed.add(new Placed(pos, k, null, null, false));
                taken.add(pos);
            }
        }
        List<String> problems = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            int s = slots.get(i);
            JsonNode n = bySlot.get(s);
            String target = n == null ? null : textOf(n, "target");
            String before = n == null ? "" : firstNonBlank(textOf(n, "before"), "");
            int pos = target == null || target.contains(" ") ? -1 : locate(letter, before, target);
            List<ItemRules.RawOption> raw = new ArrayList<>();
            if (n != null) n.path("options").forEach(o -> raw.add(new ItemRules.RawOption(
                    firstNonBlank(textOf(o, "text"), ""), o.path("correct").asBoolean(false), null)));
            boolean optsOk = target != null && raw.size() == 3
                    && raw.stream().filter(ItemRules.RawOption::correct).count() == 1
                    && raw.stream().filter(ItemRules.RawOption::correct).allMatch(o -> o.text().equals(target))
                    && raw.stream().map(o -> o.text().toLowerCase(Locale.ROOT)).distinct().count() == 3;
            if (pos < 0 || !optsOk || near(taken, pos, target.length() + 2)) {
                problems.add("ô của slot " + (s + 1));
                continue;
            }
            taken.add(pos);
            Map<String, String> m = new LinkedHashMap<>();
            m.put("target", target);
            m.put("before", before);
            m.put("phenomenon", firstNonBlank(textOf(n, "phenomenon"), ""));
            Item draft = new Item("tmp", sentenceWithGap(letter, pos, target), Map.of(), "", "",
                    sentenceAt(letter, pos), List.of(), levels.get(i), null, false, null, List.of(), m);
            placed.add(new Placed(pos, draft, raw, textOf(n, "explanationVi"), true));
        }
        // Số ô theo thứ tự xuất hiện trong thư; chữ đáp án của ô mới chọn sau khi biết thứ tự để rải đều.
        placed.sort(Comparator.comparingInt(Placed::pos));
        List<String> letters = new ArrayList<>();
        for (Placed p : placed) letters.add(p.fresh() ? null : p.item().correct());
        List<Item> result = new ArrayList<>();
        for (int i = 0; i < placed.size(); i++) {
            Placed p = placed.get(i);
            String id = spec.itemId(i);
            Map<String, String> m = new LinkedHashMap<>(p.item().meta() == null ? Map.of() : p.item().meta());
            m.put("gap", String.valueOf(spec.firstItemNumber() + i));
            if (!p.fresh()) {
                result.add(p.item().withId(id, m));
                continue;
            }
            String l = ItemRules.chooseLetter(letters, i, rnd);
            letters.set(i, l);
            ItemRules.Lettered lettered = ItemRules.letter(p.raw(), l, p.explanation());
            Item it = p.item();
            result.add(new Item(id, it.question(), lettered.options(), lettered.correct(), lettered.explanation(),
                    it.evidence(), List.of(), it.difficultyTarget(), null, false, null, List.of(), m));
        }
        return new ItemsResult(result, text, problems);
    }

    private ItemsResult bankGaps(long userId, TeilSpec spec, Text text, List<Item> current, List<Integer> slots,
                                 List<String> levels) {
        String letter = text.context();
        Set<Integer> todo = new HashSet<>(slots);
        List<Item> kept = new ArrayList<>();
        for (int s = 0; s < current.size(); s++) if (current.get(s) != null && !todo.contains(s)) kept.add(current.get(s));
        Set<String> keptTargets = new LinkedHashSet<>();
        for (Item k : kept) keptTargets.add(upper(meta(k, "target")));
        List<String> oldDistractors = new ArrayList<>();
        if (text.wordBank() != null) {
            Set<String> allTargets = new HashSet<>();
            for (Item c : current) if (c != null) allTargets.add(upper(meta(c, "target")));
            text.wordBank().values().stream().filter(w -> !allTargets.contains(w)).forEach(oldDistractors::add);
        }
        int needDistractors = 5;
        StringBuilder u = new StringBuilder("ANZEIGE\n").append(text.stimulusAd()).append("\n\nBRIEF\n").append(letter)
                .append("\n\nSlots:\n");
        for (int i = 0; i < slots.size(); i++) u.append("slot ").append(slots.get(i)).append(" → ").append(levels.get(i)).append("\n");
        if (!keptTargets.isEmpty()) u.append("\nSchon gewählte Wörter (nicht noch einmal): ").append(String.join(", ", keptTargets));
        JsonNode out = ai.call(userId, "ITEMS", LlmTier.CONTENT, BANK_SYSTEM.formatted(spec.cefrLevel(), needDistractors),
                u.toString(), 0.6, 3_000);
        Map<Integer, JsonNode> bySlot = bySlot(out, slots);

        record Placed(int pos, Item item) {}
        List<Placed> placed = new ArrayList<>();
        Set<Integer> taken = new HashSet<>();
        Set<String> targets = new LinkedHashSet<>(keptTargets);
        for (Item k : kept) {
            int pos = locate(letter, meta(k, "before"), meta(k, "target"));
            if (pos >= 0) {
                placed.add(new Placed(pos, k));
                taken.add(pos);
            }
        }
        List<String> problems = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            int s = slots.get(i);
            JsonNode n = bySlot.get(s);
            String target = n == null ? null : textOf(n, "target");
            String before = n == null ? "" : firstNonBlank(textOf(n, "before"), "");
            int pos = target == null || target.contains(" ") ? -1 : locate(letter, before, target);
            if (pos < 0 || targets.contains(upper(target)) || near(taken, pos, target.length() + 2)) {
                problems.add("ô của slot " + (s + 1));
                continue;
            }
            taken.add(pos);
            targets.add(upper(target));
            Map<String, String> m = new LinkedHashMap<>();
            m.put("target", target);
            m.put("before", before);
            placed.add(new Placed(pos, new Item("tmp", sentenceWithGap(letter, pos, target), Map.of(), "",
                    firstNonBlank(textOf(n, "explanationVi"), ""), sentenceAt(letter, pos), List.of(), levels.get(i),
                    null, false, null, List.of(), m)));
        }
        // Hộp từ: 10 từ đúng + từ nhiễu (cũ giữ lại khi chỉ sinh lại vài ô), viết HOA, xếp theo bảng chữ cái.
        List<String> distractors = new ArrayList<>(oldDistractors);
        if (distractors.size() < needDistractors) {
            out.path("distractors").forEach(d -> {
                String w = upper(d.asText(""));
                if (!w.isBlank() && !w.contains(" ") && !targets.contains(w) && !distractors.contains(w)) distractors.add(w);
            });
        }
        while (distractors.size() > needDistractors) distractors.remove(distractors.size() - 1);
        List<String> words = new ArrayList<>(targets);
        words.addAll(distractors);
        Collator de = Collator.getInstance(Locale.GERMAN);
        words.sort(de);
        Map<String, String> bank = new LinkedHashMap<>();
        for (int i = 0; i < words.size() && i < TeilSpec.BANK_LETTERS.size(); i++) bank.put(TeilSpec.BANK_LETTERS.get(i), words.get(i));
        Map<String, String> letterOf = new HashMap<>();
        bank.forEach((l, w) -> letterOf.put(w, l));
        if (distractors.size() < needDistractors) problems.add("hộp từ thiếu từ nhiễu (" + distractors.size() + "/5)");

        placed.sort(Comparator.comparingInt(Placed::pos));
        List<Item> result = new ArrayList<>();
        for (int i = 0; i < placed.size(); i++) {
            Item it = placed.get(i).item();
            Map<String, String> m = new LinkedHashMap<>(it.meta());
            m.put("gap", String.valueOf(spec.firstItemNumber() + i));
            String word = upper(m.get("target"));
            String l = letterOf.get(word);
            result.add(new Item(spec.itemId(i), it.question(), l == null ? Map.of() : Map.of(l, word), l == null ? "" : l,
                    it.explanationVi(), it.evidence(), List.of(), it.difficultyTarget(), null, it.locked(), null, List.of(), m));
        }
        return new ItemsResult(result, text.withWordBank(bank), problems);
    }

    static final String SIMPLE_ITEMS_SYSTEM = """
            Du erstellst Aufgaben für telc Deutsch %s (Start Deutsch 2). Aufgabentyp: %s
            Schwierigkeit pro slot (Niveau bleibt %s), je 0–2: phrasing (Lösung steht wörtlich da / umschrieben /
            muss erschlossen werden), evidence (eine Stelle / zwei Stellen / kombinieren), distractors, language.
            Summe 0–1 EASY, 2–4 MEDIUM, 5–6 HARD, 7–8 EXPERT. Niemals schwerer durch Wörter über dem Niveau.
            Für jeden slot: "evidence" = wörtliches Zitat aus dem Text, "explanationVi" = VIETNAMESISCHE Erklärung,
            "selfScore" = {"phrasing","evidence","distractors","language"}.
            Antworte NUR mit JSON: {"items": [{"slot": 0, ...}]}
            """;

    static final String MC_INFO_TASK = """
            Lesen Teil 1: zu jedem slot eine Alltagssituation ("Sie möchten einen Regenschirm kaufen.") mit drei
            kurzen Optionen aus der Information (Stockwerk, Raum, Rubrik, Uhrzeit); genau eine passt laut Information.
            Felder: "question", "options": [{"text","correct"}] ×3, "explanationVi" mit {1}/{2}/{3} statt a/b/c.
            """;

    static final String RF_TASK = """
            Lesen Teil 2: zu jedem slot eine Aussage über den Text; "answer": "richtig" oder "falsch". Insgesamt
            etwa gleich viele richtig und falsch (2–3 jeweils). Falsche Aussagen ändern genau ein Detail (Zeit, Person,
            Ort, Grund). Felder: "statement", "answer".
            """;

    static final String FORM_TASK = """
            Schreiben Teil 1: wähle für jeden slot EINE Information aus dem Text als Formularfeld. Felder: "label"
            (Formularfeld, z. B. "Telefonnummer", "Kurstag"), "answer" (kürzeste richtige Eintragung, so wie sie im
            Text steht oder daraus folgt), "accept" (weitere richtige Schreibweisen, z. B. ["Do.", "Donnerstag"]).
            Schwierige Felder: Information muss umgeformt/kombiniert werden (z. B. Datum aus "nächsten Montag, dem 3.").
            """;

    private ItemsResult simpleItems(long userId, TeilSpec spec, Text text, List<Item> current, List<Integer> slots,
                                    List<String> levels, List<String> avoid, Random rnd) {
        String task = switch (spec.teilType()) {
            case "MC_INFO" -> MC_INFO_TASK;
            case "TRUE_FALSE" -> RF_TASK;
            default -> FORM_TASK;
        };
        Set<Integer> todo = new HashSet<>(slots);
        StringBuilder u = new StringBuilder("TEXT\n");
        if (text.titleDe() != null && !text.titleDe().isBlank()) u.append(text.titleDe()).append("\n");
        u.append(text.context()).append("\n\nSlots:\n");
        for (int i = 0; i < slots.size(); i++) u.append("slot ").append(slots.get(i)).append(" → ").append(levels.get(i)).append("\n");
        List<String> keptQ = new ArrayList<>();
        for (int k = 0; k < current.size(); k++) if (current.get(k) != null && !todo.contains(k)) keptQ.add(current.get(k).question());
        if (!keptQ.isEmpty()) u.append("\nSchon vorhanden (nicht wiederholen):\n- ").append(String.join("\n- ", keptQ));
        u.append(avoidBlock(avoid));
        JsonNode out = ai.call(userId, "ITEMS", LlmTier.CONTENT,
                SIMPLE_ITEMS_SYSTEM.formatted(spec.cefrLevel(), task, spec.cefrLevel()), u.toString(), 0.6, 2_500);
        Map<Integer, JsonNode> bySlot = bySlot(out, slots);
        List<Item> result = new ArrayList<>(current);
        while (result.size() < spec.itemCount()) result.add(null);
        List<String> letters = new ArrayList<>();
        for (Item c : result) letters.add(c == null ? null : c.correct());
        List<String> problems = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            int sl = slots.get(i);
            JsonNode n = bySlot.get(sl);
            String level = levels.get(i);
            String evidence = n == null ? "" : firstNonBlank(textOf(n, "evidence"), "");
            boolean wasLocked = result.get(sl) != null && result.get(sl).locked();
            Item made = null;
            if (n != null) switch (spec.teilType()) {
                case "MC_INFO" -> {
                    List<ItemRules.RawOption> raw = new ArrayList<>();
                    n.path("options").forEach(o -> raw.add(new ItemRules.RawOption(
                            firstNonBlank(textOf(o, "text"), ""), o.path("correct").asBoolean(false), null)));
                    String q = textOf(n, "question");
                    if (q != null && raw.size() == 3 && raw.stream().filter(ItemRules.RawOption::correct).count() == 1) {
                        letters.set(sl, null);
                        String l = ItemRules.chooseLetter(letters, sl, rnd);
                        letters.set(sl, l);
                        ItemRules.Lettered le = ItemRules.letter(raw, l, textOf(n, "explanationVi"));
                        made = new Item(spec.itemId(sl), q, le.options(), le.correct(), le.explanation(), evidence,
                                List.of(), level, null, wasLocked, null, List.of());
                    }
                }
                case "TRUE_FALSE" -> {
                    String st = textOf(n, "statement");
                    String ans = textOf(n, "answer");
                    ans = ans == null ? null : ans.trim().toLowerCase(Locale.ROOT);
                    if (st != null && ("richtig".equals(ans) || "falsch".equals(ans))) {
                        made = new Item(spec.itemId(sl), st, Map.of("richtig", "richtig", "falsch", "falsch"), ans,
                                firstNonBlank(textOf(n, "explanationVi"), ""), evidence, List.of(), level, null,
                                wasLocked, null, List.of());
                    }
                }
                default -> {
                    String label = textOf(n, "label");
                    String ans = textOf(n, "answer");
                    if (label != null && ans != null) {
                        List<String> acc = new ArrayList<>();
                        n.path("accept").forEach(a -> { if (!a.asText("").isBlank()) acc.add(a.asText().trim()); });
                        Map<String, String> m = new LinkedHashMap<>();
                        m.put("accept", String.join("|", acc));
                        made = new Item(spec.itemId(sl), label, Map.of(), ans.trim(),
                                firstNonBlank(textOf(n, "explanationVi"), ""), evidence, List.of(), level, null,
                                wasLocked, null, List.of(), m);
                    }
                }
            }
            if (made == null) problems.add(spec.itemId(sl));
            else result.set(sl, made);
        }
        return new ItemsResult(result, text, problems);
    }

    /** Ô form (A2 Schreiben 1): các cách viết được chấp nhận, gồm đáp án chính. */
    static List<String> acceptedAnswers(Item it) {
        List<String> out = new ArrayList<>();
        out.add(it.correct());
        String acc = meta(it, "accept");
        if (!acc.isBlank()) out.addAll(Arrays.asList(acc.split("\\|")));
        return out;
    }

    // ── Giải thử / chấm thang ───────────────────────────────────────────────────────────────

    /** Đề đưa AI giải (không đáp án) hoặc chấm thang (kèm đáp án). */
    String solverBlock(TeilSpec spec, Text text, List<Item> items, boolean withKey) {
        if (spec.listening()) return HoerenTeile.solverBlock(spec, text, items, withKey);
        StringBuilder sb = new StringBuilder();
        switch (spec.teilType()) {
            case "MATCH_AD_X" -> {
                sb.append("ANZEIGEN\n");
                text.ads().forEach((l, a) -> sb.append(l).append(") ").append(a).append("\n"));
                sb.append("\nSITUATIONEN (Antwort: Buchstabe a–l oder x, wenn keine Anzeige passt; jede Anzeige höchstens einmal)\n");
                for (Item it : items) {
                    sb.append(it.id()).append(": ").append(it.question()).append("\n");
                    if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
                }
            }
            case "GAP_MC" -> {
                sb.append("TEXT\n").append(gappedText(text.context(), items)).append("\n\nLÜCKEN\n");
                for (Item it : items) {
                    sb.append(it.id()).append(" (Lücke ").append(meta(it, "gap")).append("): ");
                    ItemRules.LETTERS.forEach(l -> sb.append(l).append(") ").append(it.options().get(l)).append("  "));
                    sb.append("\n");
                    if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
                }
            }
            case "GAP_WORDBANK" -> {
                sb.append("ANZEIGE\n").append(text.stimulusAd()).append("\n\nTEXT\n").append(gappedText(text.context(), items))
                        .append("\n\nKASTEN (jedes Wort höchstens einmal)\n");
                if (text.wordBank() != null) text.wordBank().forEach((l, w) -> sb.append(l).append(") ").append(w).append("  "));
                sb.append("\n\nLÜCKEN\n");
                for (Item it : items) {
                    sb.append(it.id()).append(" (Lücke ").append(meta(it, "gap")).append(")\n");
                    if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
                }
            }
            case "MC_INFO" -> {
                sb.append("INFORMATION: ").append(nz(text.titleDe())).append("\n").append(text.context()).append("\n\nAUFGABEN (a, b oder c)\n");
                for (Item it : items) {
                    sb.append(it.id()).append(": ").append(it.question()).append("\n");
                    ItemRules.LETTERS.forEach(l -> sb.append("  ").append(l).append(") ").append(it.options().get(l)).append("\n"));
                    if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
                }
            }
            case "TRUE_FALSE" -> {
                sb.append("TEXT: ").append(nz(text.titleDe())).append("\n").append(text.context())
                        .append("\n\nAUSSAGEN (Antwort: \"richtig\" oder \"falsch\")\n");
                for (Item it : items) {
                    sb.append(it.id()).append(": ").append(it.question()).append("\n");
                    if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
                }
            }
            case "FILL_FORM" -> {
                sb.append("TEXT\n").append(text.context()).append("\n\nFORMULAR: ").append(nz(text.titleDe()))
                        .append(" (Antwort: kurze Eintragung als Text)\n");
                for (Item it : items) {
                    sb.append(it.id()).append(": ").append(it.question()).append("\n");
                    if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
                }
            }
            default -> { }
        }
        return sb.toString();
    }

    static final String WRITING_REVIEW_SYSTEM = """
            Du prüfst eine Schreibaufgabe für telc Deutsch %s (E-Mail an einen Freund, du-Form, vier Leitpunkte).
            Prüfe: (1) bietet die E-Mail für JEDEN Leitpunkt einen klaren Anknüpfungspunkt, (2) ist sie in der
            du-Form, (3) Niveau %s, (4) neutrales Alltagsthema ohne Politik/Religion/Migration, (5) sind die vier
            Leitpunkte voneinander verschieden und in 30 Minuten machbar.
            Antworte NUR mit JSON: {"points": [{"ok": true, "issueVi": null}, …4×], "duForm": true, "levelOk": true,
              "neutral": true, "issuesVi": ["..."]}
            """;

    static final String NOTE_REVIEW_SYSTEM = """
            Du prüfst eine Schreibaufgabe für telc Deutsch %s / Start Deutsch 2 (Situation + vier Punkte, drei davon
            werden gewählt, ca. 40 Wörter). Prüfe: (1) ist die Situation klar und alltagsnah, (2) sind die vier Punkte
            verschieden und je in 1–2 Sätzen auf Niveau %s machbar, (3) neutrales Thema ohne Politik/Religion/Migration.
            Antworte NUR mit JSON: {"points": [{"ok": true, "issueVi": null}, …4×], "levelOk": true, "neutral": true,
              "issuesVi": ["..."]}
            """;

    JsonNode reviewWriting(long userId, TeilSpec spec, Text text) {
        if ("WRITE_NOTE".equals(spec.teilType())) {
            StringBuilder u = new StringBuilder("SITUATION\n").append(text.stimulus().body()).append("\n\nPUNKTE\n");
            for (int i = 0; i < text.writingPoints().size(); i++) u.append(i + 1).append(". ").append(text.writingPoints().get(i)).append("\n");
            return ai.call(userId, "VERIFY", LlmTier.GRADING_EXAM, NOTE_REVIEW_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel()),
                    u.toString(), 0.0, 700);
        }
        StringBuilder u = new StringBuilder("E-MAIL von ").append(text.stimulus().from()).append(", Betreff: ")
                .append(text.stimulus().subject()).append("\n").append(text.stimulus().body()).append("\n\nLEITPUNKTE\n");
        for (int i = 0; i < text.writingPoints().size(); i++) u.append(i + 1).append(". ").append(text.writingPoints().get(i)).append("\n");
        return ai.call(userId, "VERIFY", LlmTier.GRADING_EXAM, WRITING_REVIEW_SYSTEM.formatted(spec.cefrLevel(), spec.cefrLevel()),
                u.toString(), 0.0, 900);
    }

    // ── Kiểm riêng từng dạng ────────────────────────────────────────────────────────────────

    boolean formatOk(TeilSpec spec, Text text, Item i) {
        if (i.question() == null || i.question().isBlank()) return false;
        if (spec.listening()) return HoerenTeile.formatOk(spec, text, i);
        return switch (spec.teilType()) {
            case "MATCH_AD_X" -> "x".equals(i.correct()) || (text.ads() != null && text.ads().containsKey(i.correct()));
            case "GAP_MC" -> i.options() != null && i.options().size() == 3 && ItemRules.LETTERS.contains(i.correct())
                    && i.options().values().stream().allMatch(o -> o != null && !o.isBlank())
                    && Objects.equals(i.options().get(i.correct()), meta(i, "target"));
            case "GAP_WORDBANK" -> text.wordBank() != null && text.wordBank().containsKey(i.correct())
                    && upper(meta(i, "target")).equals(text.wordBank().get(i.correct()));
            case "MC_INFO" -> i.options() != null && i.options().size() == 3 && ItemRules.LETTERS.contains(i.correct())
                    && i.options().values().stream().allMatch(o -> o != null && !o.isBlank());
            case "TRUE_FALSE" -> "richtig".equals(i.correct()) || "falsch".equals(i.correct());
            case "FILL_FORM" -> i.correct() != null && !i.correct().isBlank();
            default -> true;
        };
    }

    List<Check> checks(TeilSpec spec, Text text, List<Item> items, JsonNode writingReview) {
        List<Check> out = new ArrayList<>();
        if (spec.listening()) return HoerenTeile.checks(spec, text, items);
        switch (spec.teilType()) {
            case "MATCH_AD_X" -> {
                long x = items.stream().filter(i -> "x".equals(i.correct())).count();
                List<String> answers = items.stream().map(Item::correct).filter(c -> !"x".equals(c)).toList();
                boolean unique = answers.size() == new HashSet<>(answers).size();
                int wantX = spec.xCount();
                out.add(new Check("X_COUNT", "Đúng " + wantX + " tình huống không có mẩu hợp (x)", x == wantX ? "GREEN" : "RED",
                        x == wantX ? null : "Đang có " + x + " câu x."));
                out.add(new Check("ADS_UNIQUE", "Mỗi mẩu rao vặt là đáp án tối đa một lần", unique ? "GREEN" : "RED",
                        unique ? null : "Có mẩu được dùng làm đáp án hai lần."));
                int wantEx = spec.exampleCount();
                boolean exOk = text.examples() != null && text.examples().size() == wantEx
                        && !"x".equals(text.examples().get(0).answer())
                        && (wantEx < 2 || "x".equals(text.examples().get(1).answer()))
                        && !answers.contains(text.examples().get(0).answer());
                out.add(new Check("EXAMPLES", wantEx >= 2 ? "Hai ví dụ (01 ghép được, 02 là x)" : "Một ví dụ ghép được",
                        exOk ? "GREEN" : "YELLOW",
                        exOk ? null : "Ví dụ thiếu, sai dạng, hoặc mẩu của ví dụ 01 trùng đáp án một câu."));
                List<String> bad = new ArrayList<>();
                if (text.ads() != null) text.ads().forEach((l, a) -> {
                    int wc = TextChecks.wordCount(a);
                    if (wc < spec.minWords() || wc > spec.maxWords()) bad.add(l + ": " + wc + " từ");
                });
                int wantAds = spec.textCount();
                boolean full = text.ads() != null && text.ads().size() == wantAds;
                out.add(new Check("LENGTH", wantAds + " mẩu, mỗi mẩu " + spec.minWords() + "–" + spec.maxWords() + " từ",
                        full && bad.isEmpty() ? "GREEN" : "YELLOW", (full ? "" : "Không đủ " + wantAds + " mẩu. ") + String.join("; ", bad)));
            }
            case "GAP_MC", "GAP_WORDBANK" -> {
                boolean located = items.stream().allMatch(i -> locate(text.context(), meta(i, "before"), meta(i, "target")) >= 0);
                out.add(new Check("GAPS", "Mọi ô định vị được trong thư", located ? "GREEN" : "RED",
                        located ? null : "Có ô không còn tìm thấy từ gốc trong thư (thư đã bị sửa?) — sinh lại ô đó."));
                int wc = TextChecks.wordCount(text.context());
                boolean lenOk = wc >= spec.minWords() && wc <= spec.maxWords();
                out.add(new Check("LENGTH", "Độ dài thư", lenOk ? "GREEN" : "YELLOW",
                        wc + " từ (khuôn " + spec.minWords() + "–" + spec.maxWords() + ")."));
                if (spec.teilType().equals("GAP_MC")) {
                    boolean letterOk = ExamDraftService.lettersBalanced(items.stream().map(Item::correct).toList());
                    out.add(new Check("ANSWERS", "Phân bố đáp án a/b/c", letterOk ? "GREEN" : "YELLOW",
                            letterOk ? null : "Đáp án dồn vào một chữ hoặc 3 ô liền cùng chữ."));
                } else {
                    Map<String, String> bank = text.wordBank() == null ? Map.of() : text.wordBank();
                    boolean bankOk = bank.size() == 15 && new HashSet<>(bank.values()).size() == 15;
                    out.add(new Check("BANK", "Hộp 15 từ không trùng (10 đúng + 5 nhiễu)", bankOk ? "GREEN" : "RED",
                            bankOk ? null : "Hộp có " + bank.size() + " từ hoặc có từ trùng."));
                    boolean pair = hasConfusablePair(bank.values());
                    out.add(new Check("PAIRS", "Hộp có cặp từ dễ lẫn (MICH/MIR, WÄRE/WÜRDE…)", pair ? "GREEN" : "YELLOW",
                            pair ? null : "Không có cặp dễ lẫn nào — đề thật luôn có."));
                }
            }
            case "MC_INFO", "TRUE_FALSE", "FILL_FORM" -> {
                int wc = TextChecks.wordCount(text.context());
                boolean lenOk = wc >= spec.minWords() && wc <= spec.maxWords();
                out.add(new Check("LENGTH", "Độ dài văn bản", lenOk ? "GREEN" : "YELLOW",
                        wc + " từ (khuôn " + spec.minWords() + "–" + spec.maxWords() + ")."));
                if ("MC_INFO".equals(spec.teilType())) {
                    boolean letterOk = ExamDraftService.lettersBalanced(items.stream().map(Item::correct).toList());
                    out.add(new Check("ANSWERS", "Phân bố đáp án a/b/c", letterOk ? "GREEN" : "YELLOW",
                            letterOk ? null : "Đáp án dồn vào một chữ hoặc 3 câu liền cùng chữ."));
                } else if ("TRUE_FALSE".equals(spec.teilType())) {
                    long rich = items.stream().filter(i -> "richtig".equals(i.correct())).count();
                    boolean bal = rich >= 2 && rich <= 3;
                    out.add(new Check("ANSWERS", "Cân richtig/falsch (2–3 mỗi loại)", bal ? "GREEN" : "YELLOW",
                            bal ? null : rich + " câu richtig / " + (items.size() - rich) + " câu falsch."));
                } else {
                    Set<String> labels = new HashSet<>();
                    boolean uniq = items.stream().allMatch(i -> labels.add(i.question().trim().toLowerCase(Locale.ROOT)));
                    out.add(new Check("FIELDS", "5 ô form khác nhau", uniq ? "GREEN" : "RED", uniq ? null : "Có hai ô trùng tên."));
                    boolean digits = items.stream().anyMatch(i -> i.correct().matches(".*\\d.*"));
                    out.add(new Check("NUMBERS", "Có ít nhất một ô là số (như đề thật)", digits ? "GREEN" : "YELLOW",
                            digits ? null : "Không ô nào là số (điện thoại, ngày, mã…)."));
                }
            }
            case "WRITE_NOTE", "WRITE_EMAIL" -> {
                boolean four = text.writingPoints() != null && text.writingPoints().size() == 4;
                out.add(new Check("POINTS", "Đủ 4 Leitpunkte", four ? "GREEN" : "RED", four ? null : "Cần đúng 4 ý."));
                String body = text.stimulus() == null ? "" : text.stimulus().body();
                if ("WRITE_EMAIL".equals(spec.teilType())) {
                    boolean du = Pattern.compile("(?i)\\b(du|dir|dich|dein\\w*)\\b").matcher(body).find();
                    out.add(new Check("DU", "E-Mail xưng du", du ? "GREEN" : "YELLOW", du ? null : "Không thấy du/dir/dich trong thư."));
                }
                int wc = TextChecks.wordCount(body);
                boolean lenOk = wc >= spec.minWords() && wc <= spec.maxWords();
                out.add(new Check("LENGTH", "Độ dài E-Mail kích thích", lenOk ? "GREEN" : "YELLOW",
                        wc + " từ (khuôn " + spec.minWords() + "–" + spec.maxWords() + ")."));
                if (writingReview != null) {
                    List<String> issues = new ArrayList<>();
                    JsonNode pts = writingReview.path("points");
                    for (int k = 0; k < pts.size(); k++) {
                        if (!pts.get(k).path("ok").asBoolean(true)) {
                            issues.add("Ý " + (k + 1) + ": " + pts.get(k).path("issueVi").asText("không có chỗ bám trong thư"));
                        }
                    }
                    if (!writingReview.path("levelOk").asBoolean(true)) issues.add("Trình độ chưa đúng cấp.");
                    writingReview.path("issuesVi").forEach(s -> { if (!s.asText("").isBlank()) issues.add(s.asText()); });
                    out.add(new Check("REVIEW", "AI soát đề Viết", issues.isEmpty() ? "GREEN" : "YELLOW",
                            issues.isEmpty() ? null : String.join(" ", issues)));
                    boolean neutral = writingReview.path("neutral").asBoolean(true);
                    out.add(new Check("NEUTRAL", "Chủ đề trung lập", neutral ? "GREEN" : "RED", neutral ? null : "AI gắn cờ chủ đề nhạy cảm."));
                }
            }
            default -> { }
        }
        return out;
    }

    static final List<Set<String>> CONFUSABLE = List.of(
            Set.of("MICH", "MIR"), Set.of("WÄRE", "WÜRDE", "WÄREN", "WÜRDEN", "HÄTTE", "HÄTTEN"), Set.of("WANN", "WENN"),
            Set.of("OB", "DASS", "WAS"), Set.of("VORHER", "BEVOR"), Set.of("DENN", "WEIL", "DARUM", "TROTZDEM"),
            Set.of("IHRE", "EURE"), Set.of("MUSS", "SOLL"), Set.of("AM", "IM"), Set.of("KÖNNEN", "KONNTEN"),
            Set.of("AUCH", "NUR", "WENIGSTENS"));

    static boolean hasConfusablePair(Collection<String> words) {
        for (Set<String> group : CONFUSABLE) {
            if (words.stream().filter(group::contains).count() >= 2) return true;
        }
        return false;
    }

    // ── Đầu ra đúng khuôn đề telc (V343) ────────────────────────────────────────────────────

    Map<String, Object> content(TeilSpec spec, Text text, List<Item> items) {
        if (spec.listening()) return HoerenTeile.content(spec, text, items);
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("teil", spec.teil());
        if (!spec.writing()) {
            c.put("type", spec.outputType());
            c.put("point_per_item", spec.points());
        }
        switch (spec.teilType()) {
            case "MATCH_AD_X" -> {
                c.put("single_use", true);
                c.put("allow_none", true);
                c.put("instruction_de", spec.instructionDe());
                c.put("instruction_vi", spec.instructionVi());
                c.put("examples", text.examples() == null ? List.of() : text.examples().stream().map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("label", e.label());
                    m.put("situation", e.situation());
                    m.put("answer", e.answer());
                    return m;
                }).toList());
                c.put("ads", text.ads());
            }
            case "GAP_MC" -> {
                c.put("instruction_de", spec.instructionDe());
                c.put("instruction_vi", spec.instructionVi());
                c.put("gapped_text", gappedText(text.context(), items));
            }
            case "GAP_WORDBANK" -> {
                c.put("single_use", true);
                c.put("instruction_de", spec.instructionDe());
                c.put("instruction_vi", spec.instructionVi());
                c.put("stimulus_ad", text.stimulusAd());
                c.put("word_bank", text.wordBank());
                c.put("gapped_text", gappedText(text.context(), items));
            }
            case "MC_INFO", "TRUE_FALSE" -> {
                c.put("instruction_de", spec.instructionDe());
                c.put("instruction_vi", spec.instructionVi());
                if (text.titleDe() != null && !text.titleDe().isBlank()) c.put("title_de", text.titleDe());
                c.put("context", text.context());
            }
            case "FILL_FORM" -> {
                c.put("instruction_de", spec.instructionDe());
                c.put("instruction_vi", spec.instructionVi());
                c.put("context", text.context());
                c.put("form_title", text.titleDe());
                c.put("max_points", spec.itemCount());
                c.put("form_fields", items.stream().map(it -> {
                    Map<String, Object> f = new LinkedHashMap<>();
                    f.put("field", it.question());
                    f.put("answer", it.correct());
                    List<String> acc = acceptedAnswers(it).subList(1, acceptedAnswers(it).size());
                    f.put("accept", acc);
                    f.put("explanation_vi", it.explanationVi());
                    f.put("evidence", it.evidence());
                    f.put("difficulty_target", it.difficultyTarget());
                    return f;
                }).toList());
                c.remove("type");
                c.put("type", "FILL_FORM");
                c.remove("point_per_item");
                return c;
            }
            case "WRITE_NOTE" -> {
                c.put("type", "WRITE_NOTE");
                c.put("instruction_de", spec.instructionDe());
                c.put("instruction_vi", spec.instructionVi());
                c.put("prompt", text.stimulus() == null ? text.context() : text.stimulus().body());
                c.put("writing_points", text.writingPoints());
                c.put("choose_points", 3);
                c.put("word_target", 40);
                c.put("max_points", 10);
                return c;
            }
            case "WRITE_EMAIL" -> {
                Stimulus st = text.stimulus();
                String from = st == null ? "Ihr Freund" : st.from();
                c.put("instruction_de", "Ihr Freund " + from + " hat Ihnen eine E-Mail geschrieben. Antworten Sie. "
                        + spec.instructionDe().replace("Antworten Sie auf die E-Mail. ", ""));
                c.put("instruction_vi", spec.instructionVi());
                c.put("prompt", "Ihr Freund " + from + " hat Ihnen geschrieben. Antworten Sie.");
                Map<String, Object> stim = new LinkedHashMap<>();
                stim.put("type", "EMAIL");
                stim.put("from", from);
                stim.put("subject", st == null ? "" : st.subject());
                stim.put("body", st == null ? "" : st.body());
                c.put("stimulus", stim);
                c.put("shuffle_points", true);
                c.put("writing_points", text.writingPoints());
                return c;
            }
            default -> { }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Item it : items) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", it.id());
            if (spec.teilType().startsWith("GAP_")) m.put("gap", Integer.parseInt(meta(it, "gap")));
            else m.put("question", it.question());
            if ("GAP_MC".equals(spec.teilType()) || "MC_INFO".equals(spec.teilType())) m.put("options", it.options());
            m.put("correct", it.correct());
            m.put("explanation_vi", it.explanationVi());
            m.put("evidence", it.evidence());
            m.put("traps", it.traps());
            m.put("difficulty_target", it.difficultyTarget());
            m.put("difficulty_measured", it.difficultyMeasured() == null ? null : it.difficultyMeasured().level());
            out.add(m);
        }
        c.put("items", out);
        return c;
    }

    /** Văn bản dùng để đo số từ, từ vựng, trùng nguồn. */
    static String metricsText(TeilSpec spec, Text t) {
        return switch (spec.teilType()) {
            case "MATCH_AD_X" -> t.ads() == null ? t.context() : String.join("\n\n", t.ads().values());
            case "GAP_WORDBANK" -> (t.stimulusAd() == null ? "" : t.stimulusAd() + "\n\n") + t.context();
            case "WRITE_EMAIL", "WRITE_NOTE" -> t.stimulus() == null ? t.context() : t.stimulus().body();
            default -> t.context();
        };
    }

    // ── Phụ trợ định vị ô ──────────────────────────────────────────────────────────────────

    /** Vị trí (ký tự) của {@code target} ngay sau cụm {@code before}; không có cụm thì lần xuất hiện duy nhất. */
    static int locate(String text, String before, String target) {
        if (text == null || target == null || target.isBlank()) return -1;
        Pattern word = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(target) + "(?![\\p{L}\\p{N}])");
        if (before != null && !before.isBlank()) {
            String[] parts = before.trim().split("\\s+");
            String pat = String.join("[\\s\\p{Punct}„“”»«–]*", Arrays.stream(parts).map(Pattern::quote).toList())
                    + "[\\s\\p{Punct}„“”»«–]*(?=" + Pattern.quote(target) + "(?![\\p{L}\\p{N}]))";
            Matcher m = Pattern.compile(pat).matcher(text);
            if (m.find()) {
                int pos = m.end();
                if (m.find()) return -1; // hai chỗ khớp: mơ hồ
                return pos;
            }
        }
        Matcher m = word.matcher(text);
        if (!m.find()) return -1;
        int pos = m.start();
        return m.find() ? -1 : pos;
    }

    /** Thư có ô: mỗi từ gốc thay bằng ___N___ theo số ô của câu. */
    static String gappedText(String letter, List<Item> items) {
        record G(int pos, int len, String gap) {}
        List<G> gs = new ArrayList<>();
        for (Item it : items) {
            int pos = locate(letter, meta(it, "before"), meta(it, "target"));
            if (pos >= 0) gs.add(new G(pos, meta(it, "target").length(), meta(it, "gap")));
        }
        gs.sort(Comparator.comparingInt(G::pos).reversed());
        StringBuilder sb = new StringBuilder(letter);
        for (G g : gs) sb.replace(g.pos(), g.pos() + g.len(), "___" + g.gap() + "___");
        return sb.toString();
    }

    static String sentenceAt(String text, int pos) {
        int start = Math.max(0, Math.max(text.lastIndexOf(". ", pos), Math.max(text.lastIndexOf("\n", pos), text.lastIndexOf("? ", pos))) + 1);
        int endDot = text.indexOf(". ", pos);
        int endNl = text.indexOf("\n", pos);
        int end = text.length();
        if (endDot >= 0) end = Math.min(end, endDot + 1);
        if (endNl >= 0) end = Math.min(end, endNl);
        return text.substring(start, end).trim();
    }

    static String sentenceWithGap(String text, int pos, String target) {
        String gapped = text.substring(0, pos) + "___" + text.substring(pos + target.length());
        return sentenceAt(gapped, pos);
    }

    private static boolean near(Set<Integer> taken, int pos, int dist) {
        for (int t : taken) if (Math.abs(t - pos) < dist) return true;
        return false;
    }

    private static Map<Integer, JsonNode> bySlot(JsonNode out, List<Integer> slots) {
        Map<Integer, JsonNode> map = new HashMap<>();
        int fallback = 0;
        for (JsonNode n : out.path("items")) {
            int slot = n.has("slot") ? n.path("slot").asInt(-1) : -1;
            if (!slots.contains(slot) || map.containsKey(slot)) {
                while (fallback < slots.size() && map.containsKey(slots.get(fallback))) fallback++;
                if (fallback >= slots.size()) break;
                slot = slots.get(fallback);
            }
            map.put(slot, n);
        }
        return map;
    }

    static String avoidBlock(List<String> avoid) {
        if (avoid == null || avoid.isEmpty()) return "";
        return "\n\nBereits in der Aufgabendatenbank (Thema, Situation und Inhalt NICHT wiederholen, etwas anderes wählen):\n- "
                + String.join("\n- ", avoid);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    static String meta(Item i, String key) {
        return i.meta() == null || i.meta().get(key) == null ? "" : i.meta().get(key);
    }

    private static String upper(String s) {
        return s == null ? "" : s.trim().toUpperCase(Locale.GERMAN);
    }

    private static String textOf(JsonNode n, String f) {
        return ExamDraftService.text(n, f);
    }

    private static String firstNonBlank(String... vs) {
        return ExamDraftService.firstNonBlank(vs);
    }
}
