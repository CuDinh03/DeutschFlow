package com.deutschflow.examstudio;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.examstudio.ExamStudioDtos.AudioTurn;
import com.deutschflow.examstudio.ExamStudioDtos.Check;
import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.Text;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Xưởng đề đợt 5 — phần Nghe telc B1 (owner chốt 13/11/2026: mỗi bộ đề có phần Nghe riêng do máy soạn).
 * Không lưu audio: app đọc lời thoại bằng TTS lúc bấm, nên một Teil Nghe chỉ là lời thoại + mệnh đề richtig/falsch.
 *
 * <ul>
 *   <li>Teil 1 ({@code HOEREN_STATEMENTS}): 5 người trả lời MỘT câu hỏi chung, nghe một lần, mỗi người một câu.</li>
 *   <li>Teil 2 ({@code HOEREN_INTERVIEW}): một cuộc phỏng vấn radio, nghe hai lần, 10 câu theo thứ tự bài.</li>
 *   <li>Teil 3 ({@code HOEREN_ANNOUNCEMENTS}): 5 thông báo / tin nhắn ngắn, mỗi bài có câu dẫn tình huống.</li>
 * </ul>
 *
 * Lời thoại gốc nằm ở {@link Text#audioTurns()}; {@link Text#context()} luôn là bản ghép các lượt lời (đo từ, dò
 * bằng chứng, chống trùng dùng chung đường với các Teil khác). Khuôn đầu ra lấy đúng theo phần HOEREN của đề viết
 * tay telc B1 (V343). {@link SituationalTeile} gọi sang đây ở mọi nhánh theo dạng Teil.
 */
final class HoerenTeile {

    private HoerenTeile() {}

    /** Khoá người nói của đề viết tay: PRUEFER = giọng nữ, PARTNER = giọng nam. */
    static final String FEMALE = "PRUEFER";
    static final String MALE = "PARTNER";

    static final String RICHTIG = "richtig";
    static final String FALSCH = "falsch";

    /** Mệnh đề chép từ bấy nhiêu từ liên tiếp của lời thoại trở lên ⇒ báo vàng (đề thật luôn diễn đạt lại). */
    static final int COPY_RUN_LIMIT = 6;

    // ── Lời thoại ──────────────────────────────────────────────────────────────────────────

    static final String SPOKEN_RULES = """
            GESPROCHENE SPRACHE: Die Texte werden VORGELESEN, nicht gelesen. Natürliches mündliches Deutsch auf Niveau
            %s: kurze Sätze, meist Hauptsätze, höchstens EIN Nebensatz pro Satz; ab und zu ein Füllwort ("also",
            "na ja", "eigentlich", "ehrlich gesagt"), aber sparsam; keine Schachtelsätze, keine Schriftsprache, keine
            Klammern, keine Abkürzungen, keine Aufzählungszeichen. Zahlen, Uhrzeiten und Preise als Wörter
            ausschreiben ("halb drei", "zwanzig Minuten", "zehn Prozent").
            NEUTRAL: Alltagsthema ohne Politik, Migration, Krieg, Religion. Erfundene Personen, keine echten Firmen-,
            Sender- oder Markennamen.""";

    static final String STATEMENTS_SYSTEM = """
            Du schreibst Hörtexte für telc Deutsch %s, Hörverstehen Teil 1 (Globalverstehen). In einer Radiosendung
            wird EINE gemeinsame Frage zu einem Alltagsthema gestellt, und GENAU %d verschiedene Personen antworten
            nacheinander, jede mit einem eigenen kurzen Statement (je %d–%d Wörter).
            %s
            INHALT: Jede Person hat eine andere Lebenssituation (Beruf, Alter, Familie) und eine andere Gewohnheit
            oder Meinung. Jedes Statement enthält 4–6 konkrete Details (Zeit, Ort, Häufigkeit, Grund) und mindestens
            EINEN Kontrast ("früher … heute", "eigentlich … aber", "nur am …", "fast nie"), damit später eine
            Richtig/Falsch-Aussage mit feiner Falle möglich ist. Die Personen nennen ihren Namen nicht und sprechen
            nicht miteinander. Frauen und Männer wechseln sich ab; die erste Person ist eine Frau.
            "topic" = einleitende Frage der Sendung in der dritten Person ("Was machen die Menschen in ihrer
            Mittagspause?"); "question" = die Frage an die Personen in der Sie-Form ("Wie verbringen Sie Ihre
            Mittagspause, und warum so?").
            Antworte NUR mit JSON: {"topic": "...", "question": "...", "statements": [{"gender": "f", "text": "..."},
              {"gender": "m", "text": "..."}]}
            """;

    static final String INTERVIEW_SYSTEM = """
            Du schreibst einen Hörtext für telc Deutsch %s, Hörverstehen Teil 2 (Detailverstehen): EIN Radiointerview
            von %d–%d Wörtern. Eine Moderatorin oder ein Moderator spricht mit EINEM Gast über dessen Projekt, Beruf,
            Verein, Geschäft oder Hobby aus dem Alltag einer deutschen, österreichischen oder Schweizer Stadt.
            AUFBAU: Begrüßung der Hörerinnen und Hörer mit dem Namen der Sendung und Vorstellung des Gastes; dann
            7–9 klare Frage-Antwort-Wechsel (kurze Frage, Antwort mit 3–5 Sätzen); am Ende Dank und Verabschiedung.
            Moderation und Gast haben VERSCHIEDENE Geschlechter (zwei verschiedene Stimmen).
            %s
            INHALT: Die Antworten enthalten viele überprüfbare Details (Zeiträume, Mengen, Gründe, wer, wo, wie oft,
            was sich geändert hat, was NICHT geplant ist), verteilt über das ganze Gespräch, damit zehn
            Richtig/Falsch-Aussagen in der Reihenfolge des Gesprächs möglich sind.
            "guestName" = Anrede + Nachname ("Herr Vogel", "Frau Brandt"); "role" ist "host" oder "guest".
            Antworte NUR mit JSON: {"show": "...", "hostGender": "f", "guestName": "Herr Vogel", "guestGender": "m",
              "turns": [{"role": "host", "text": "..."}, {"role": "guest", "text": "..."}]}
            """;

    static final String ANNOUNCEMENTS_SYSTEM = """
            Du schreibst Hörtexte für telc Deutsch %s, Hörverstehen Teil 3 (selektives Verstehen). Schreibe GENAU %d
            kurze, voneinander unabhängige Hörtexte (je %d–%d Wörter), jeder aus einer ANDEREN Alltagssituation:
            Nachricht auf dem Anrufbeantworter (Praxis, Werkstatt, Kollege, Freundin), Durchsage (Bahnhof, Flughafen,
            Kaufhaus, Supermarkt, Schwimmbad), Radiomeldung (Wetter, Verkehr, Veranstaltungstipp), automatische
            Telefonansage. Höchstens zwei Texte derselben Textsorte. Jeden Text spricht EINE Person; Frauen- und
            Männerstimmen wechseln sich ab. Das angegebene Themenfeld gilt für mindestens zwei der Texte; die übrigen
            kommen aus anderen Alltagsbereichen.
            %s
            INHALT: je 4–6 konkrete Angaben (Uhrzeit, Tag, Ort, Preis, Bedingung, was man tun soll), darunter eine
            Einschränkung oder Änderung ("aber nicht für …", "nur bis …", "statt … jetzt …").
            "scene" = EIN Satz in der Sie-Form, der die Situation ansagt, OHNE Aufgabennummer, z. B. "Sie hören eine
            Nachricht auf Ihrem Anrufbeantworter." / "Sie sind am Bahnhof und hören folgende Durchsage." / "Im Radio
            hören Sie den Wetterbericht."
            Antworte NUR mit JSON: {"texts": [{"gender": "f", "scene": "...", "text": "..."},
              {"gender": "m", "scene": "...", "text": "..."}]}
            """;

    static Text writeText(ExamStudioAi ai, long userId, TeilSpec spec, String user) {
        String lv = spec.cefrLevel();
        String spoken = SPOKEN_RULES.formatted(lv);
        return switch (spec.teilType()) {
            case "HOEREN_STATEMENTS" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT, STATEMENTS_SYSTEM.formatted(lv, spec.textCount(),
                        spec.minWords(), spec.maxWords(), spoken), user, 0.7, 3_000);
                yield statementsText(spec, out);
            }
            case "HOEREN_INTERVIEW" -> {
                String system = INTERVIEW_SYSTEM.formatted(lv, spec.minWords(), spec.maxWords(), spoken);
                Text first = interviewText(ai.call(userId, "TEXT", LlmTier.CONTENT, system, user, 0.7, 4_000));
                int words = TextChecks.wordCount(first.context());
                if (words >= spec.minWords()) yield first;
                // Model hay viết hụt độ dài: nhắc đúng con số và cho viết lại MỘT lần; vẫn hụt thì giữ bản dài hơn
                // (đèn Độ dài sẽ báo).
                try {
                    Text again = interviewText(ai.call(userId, "TEXT", LlmTier.CONTENT, system, user
                            + "\nDein letztes Interview hatte nur " + words + " Wörter. Schreibe es neu mit mindestens "
                            + spec.minWords() + " Wörtern: mehr Frage-Antwort-Wechsel und längere Antworten.", 0.7, 4_000));
                    yield TextChecks.wordCount(again.context()) > words ? again : first;
                } catch (RuntimeException e) {
                    yield first;
                }
            }
            case "HOEREN_ANNOUNCEMENTS" -> {
                JsonNode out = ai.call(userId, "TEXT", LlmTier.CONTENT, ANNOUNCEMENTS_SYSTEM.formatted(lv,
                        spec.textCount(), spec.minWords(), spec.maxWords(), spoken), user, 0.7, 3_000);
                yield announcementsText(spec, out);
            }
            default -> throw new IllegalStateException("Dạng Teil lạ: " + spec.teilType());
        };
    }

    /** Teil 1: câu khung ghép đúng kiểu đề viết tay — câu hỏi mở đầu + câu hỏi đặt cho năm người. */
    static Text statementsText(TeilSpec spec, JsonNode out) {
        List<AudioTurn> turns = new ArrayList<>();
        int i = 0;
        for (JsonNode n : out.path("statements")) {
            String body = clean(n.isTextual() ? n.asText() : n.path("text").asText(""));
            if (body.isBlank()) continue;
            turns.add(new AudioTurn(speakerOf(n.path("gender").asText(null), i), null, stripNumber(body), null));
            i++;
        }
        int want = spec.textCount();
        if (turns.size() < want) {
            throw new IllegalStateException("AI chỉ trả " + turns.size() + "/" + want + " đoạn lời thoại, hãy thử lại.");
        }
        turns = new ArrayList<>(turns.subList(0, want));
        String question = clean(out.path("question").asText(""));
        if (question.isBlank()) throw new IllegalStateException("AI không trả câu hỏi chung của Teil 1.");
        String topic = clean(out.path("topic").asText(""));
        String framing = (topic.isBlank() ? "" : topic + " ") + "Wir haben " + numberWord(want)
                + " Personen gefragt: „" + question.replaceAll("^[„\"“]+|[“\"”]+$", "") + "“ Hören Sie dazu die Antworten.";
        return new Text("", "", contextOf(turns), List.of(), null, null, null, null, null, null, turns, framing);
    }

    /** Teil 2: lượt lời của người dẫn và khách; hai giọng khác nhau. */
    static Text interviewText(JsonNode out) {
        boolean hostFemale = !isMale(out.path("hostGender").asText("f"));
        String guestName = clean(out.path("guestName").asText(""));
        if (guestName.isBlank()) guestName = "Gast";
        // Khách luôn khác giọng người dẫn: hai giọng TTS phải phân biệt được, kể cả khi model khai trùng giới.
        String hostSpeaker = hostFemale ? FEMALE : MALE;
        String guestSpeaker = hostFemale ? MALE : FEMALE;
        String hostName = hostFemale ? "Moderatorin" : "Moderator";
        List<AudioTurn> turns = new ArrayList<>();
        for (JsonNode n : out.path("turns")) {
            String body = clean(n.path("text").asText(""));
            if (body.isBlank()) continue;
            boolean guest = "guest".equalsIgnoreCase(n.path("role").asText(""))
                    || "gast".equalsIgnoreCase(n.path("role").asText(""));
            turns.add(new AudioTurn(guest ? guestSpeaker : hostSpeaker, guest ? guestName : hostName, body, null));
        }
        if (turns.size() < 6 || turns.stream().map(AudioTurn::speaker).distinct().count() < 2) {
            throw new IllegalStateException("AI không trả đủ lượt lời của cuộc phỏng vấn, hãy thử lại.");
        }
        String show = clean(out.path("show").asText(""));
        return new Text(show, "", contextOf(turns), List.of(), null, null, null, null, null, null, turns, null);
    }

    /** Teil 3: mỗi đoạn một câu dẫn tình huống (chưa kèm số câu — số ghép lúc xuất). */
    static Text announcementsText(TeilSpec spec, JsonNode out) {
        List<AudioTurn> turns = new ArrayList<>();
        int i = 0;
        for (JsonNode n : out.path("texts")) {
            String body = clean(n.path("text").asText(""));
            String scene = stripLeadNumber(clean(n.path("scene").asText("")));
            if (body.isBlank() || scene.isBlank()) continue;
            turns.add(new AudioTurn(speakerOf(n.path("gender").asText(null), i), null, body, scene));
            i++;
        }
        int want = spec.textCount();
        if (turns.size() < want) {
            throw new IllegalStateException("AI chỉ trả " + turns.size() + "/" + want + " đoạn lời thoại có câu dẫn, hãy thử lại.");
        }
        turns = new ArrayList<>(turns.subList(0, want));
        return new Text("", "", contextOf(turns), List.of(), null, null, null, null, null, null, turns, null);
    }

    /** Bản ghép các lượt lời: mỗi lượt một đoạn. Bằng chứng của câu hỏi được dò trong chuỗi này. */
    static String contextOf(List<AudioTurn> turns) {
        List<String> parts = new ArrayList<>();
        if (turns != null) for (AudioTurn t : turns) if (t != null && t.text() != null && !t.text().isBlank()) parts.add(t.text().trim());
        return String.join("\n\n", parts);
    }

    /** Lời thoại do admin sửa tay: chuẩn hoá khoá người nói, cắt khoảng trắng, bỏ lượt rỗng của Teil 2. */
    static Text sanitized(TeilSpec spec, Text t) {
        if (t.audioTurns() == null) return t;
        List<AudioTurn> turns = new ArrayList<>();
        for (AudioTurn a : t.audioTurns()) {
            if (a == null) continue;
            String body = a.text() == null ? "" : a.text().trim();
            if (body.isBlank() && !spec.listeningSegments()) continue;
            String speaker = MALE.equalsIgnoreCase(a.speaker()) ? MALE : FEMALE;
            turns.add(new AudioTurn(speaker, blankToNull(a.name()), body, blankToNull(a.leadInDe())));
        }
        return new Text(t.titleDe(), t.vorspannDe(), contextOf(turns), t.glossary(), null, null, null, null, null, null,
                turns, blankToNull(t.framingDe()));
    }

    /** Thay một đoạn bôi đen (AI viết lại) trong lời thoại; {@code context} ghép lại theo. */
    static Text replaced(Text t, String selection, String replacement) {
        if (t.audioTurns() == null) return t.withContext(t.context().replace(selection, replacement));
        List<AudioTurn> turns = new ArrayList<>();
        for (AudioTurn a : t.audioTurns()) {
            turns.add(new AudioTurn(a.speaker(), a.name(), a.text() == null ? null : a.text().replace(selection, replacement),
                    a.leadInDe()));
        }
        return t.withAudio(turns, contextOf(turns));
    }

    // ── Câu hỏi ─────────────────────────────────────────────────────────────────────────────

    static final String ITEMS_SYSTEM = """
            Du erstellst Richtig/Falsch-Aufgaben für telc Deutsch %s, Hörverstehen. Die Kandidaten HÖREN den Text und
            lesen nur die Aussagen. %s
            REGELN für jede Aussage ("statement"):
            - EIN kurzer Aussagesatz (höchstens 16 Wörter), Niveau %s, kein Fragesatz;
            - NICHT wörtlich aus dem Hörtext: andere Wörter und andere Satzstruktur (Umschreibung, Synonym,
              Oberbegriff); höchstens drei aufeinanderfolgende Wörter dürfen wie im Hörtext sein;
            - "richtig": der Hörtext sagt genau das, nur mit anderen Worten;
            - "falsch": die Aussage WIDERSPRICHT einem konkreten Detail des Hörtextes (Zeit, Häufigkeit, Person, Ort,
              Grund, früher/heute, alle/manche). NIEMALS eine Aussage, über die der Hörtext nichts sagt;
            - eindeutig: wer aufmerksam zuhört, kann sicher entscheiden; kein Weltwissen, keine Meinungsfrage;
            - halte für jeden slot die verlangte Lösung ("soll") ein.
            SCHWIERIGKEIT (Niveau bleibt %s), je 0–2: phrasing (Wörter des Hörtextes / umschrieben / muss erschlossen
            werden), evidence (ein Satz / zwei Sätze / mehrere Stellen verbinden), distractors (bei falsch: Detail
            offensichtlich anders / klingt ähnlich / nur eine feine Einschränkung weicht ab), language. Summe 0–1
            EASY, 2–4 MEDIUM, 5–6 HARD, 7–8 EXPERT. Niemals schwerer durch Wörter über dem Niveau.
            "evidence" = EIN vollständiger Satz, WÖRTLICH aus dem Hörtext kopiert, der die Lösung belegt;
            "explanationVi" = kurze VIETNAMESISCHE Erklärung, die die entscheidende Stelle auf Deutsch in „…“ zitiert
            und mit "⇒ ĐÚNG." oder "⇒ SAI." endet; "selfScore" = {"phrasing","evidence","distractors","language"}.
            Antworte NUR mit JSON: {"items": [{"slot": 0, "statement": "...", "answer": "falsch", "evidence": "...",
              "explanationVi": "...", "selfScore": {"phrasing": 1, "evidence": 0, "distractors": 1, "language": 0}}]}
            """;

    static final String STATEMENTS_TASK = """
            Teil 1: Fünf Personen antworten auf dieselbe Frage. Zu jedem slot gehört GENAU der Hörtext mit derselben
            Nummer. Schreibe EINE Aussage über diese Person, beginnend mit "Die Sprecherin …" bzw. "Der Sprecher …"
            (wie beim Hörtext angegeben), zur Hauptaussage oder zu einer wichtigen Einzelheit dieses Statements.""";

    static final String INTERVIEW_TASK = """
            Teil 2: Ein Radiointerview. Die Aussagen folgen der REIHENFOLGE des Gesprächs: der erste slot betrifft
            den Anfang, der letzte das Ende, und jede Aussage betrifft eine andere Stelle. Nenne den Gast mit Namen
            ("Herr Vogel …") oder sprich über sein Projekt; keine Aussage über Begrüßung oder Verabschiedung.""";

    static final String ANNOUNCEMENTS_TASK = """
            Teil 3: Fünf kurze Durchsagen und Nachrichten. Zu jedem slot gehört GENAU der Hörtext mit derselben
            Nummer. Schreibe EINE Aussage über eine wichtige Information dieses Textes (was man tun soll, wann, wo,
            unter welcher Bedingung), unpersönlich oder mit "man", "Die Anruferin …", "Der Anrufer …".""";

    static SituationalTeile.ItemsResult generateItems(ExamStudioAi ai, long userId, TeilSpec spec, Text text,
                                                      List<Item> current, List<Integer> slots, List<String> levels,
                                                      List<String> avoid, Random rnd) {
        List<AudioTurn> turns = text.audioTurns() == null ? List.of() : text.audioTurns();
        if (turns.isEmpty()) throw new IllegalStateException("Bản nháp chưa có lời thoại — viết lời thoại trước.");
        int count = spec.itemCount();
        List<Item> result = new ArrayList<>(current);
        while (result.size() < count) result.add(null);
        Set<Integer> todo = new HashSet<>(slots);

        // Máy định trước đáp án từng câu để cả Teil cân richtig/falsch; AI viết mệnh đề theo đáp án đã giao.
        List<String> fixed = new ArrayList<>();
        for (int s = 0; s < count; s++) fixed.add(todo.contains(s) || result.get(s) == null ? null : result.get(s).correct());
        List<String> wanted = planAnswers(fixed, rnd);

        String task = switch (spec.teilType()) {
            case "HOEREN_STATEMENTS" -> STATEMENTS_TASK;
            case "HOEREN_INTERVIEW" -> INTERVIEW_TASK;
            default -> ANNOUNCEMENTS_TASK;
        };
        StringBuilder u = new StringBuilder();
        if (spec.listeningSegments()) {
            if (text.framingDe() != null && !text.framingDe().isBlank()) u.append("RAHMEN: ").append(text.framingDe()).append("\n\n");
            for (int s : slots) {
                if (s >= turns.size()) continue;
                AudioTurn t = turns.get(s);
                u.append("HÖRTEXT ").append(s).append(" (").append(MALE.equals(t.speaker()) ? "Sprecher" : "Sprecherin").append(")");
                if (t.leadInDe() != null && !t.leadInDe().isBlank()) u.append(" — Situation: ").append(t.leadInDe());
                u.append("\n").append(t.text()).append("\n\n");
            }
        } else {
            u.append("INTERVIEW\n").append(transcript(turns)).append("\n");
        }
        u.append("Slots:\n");
        for (int i = 0; i < slots.size(); i++) {
            int s = slots.get(i);
            u.append("slot ").append(s).append(" → ").append(levels.get(i)).append(", soll: ").append(wanted.get(s)).append("\n");
        }
        List<String> kept = new ArrayList<>();
        for (int s = 0; s < count; s++) {
            if (result.get(s) != null && !todo.contains(s)) kept.add("slot " + s + ": " + result.get(s).question());
        }
        if (!kept.isEmpty()) {
            u.append("\nSchon vorhanden (nicht wiederholen");
            if (!spec.listeningSegments()) u.append("; die neue Aussage muss in der Reihenfolge des Gesprächs zwischen ihre Nachbarn passen");
            u.append("):\n- ").append(String.join("\n- ", kept));
        }
        u.append(SituationalTeile.avoidBlock(avoid));
        String lv = spec.cefrLevel();
        JsonNode out = ai.call(userId, "ITEMS", LlmTier.CONTENT, ITEMS_SYSTEM.formatted(lv, task, lv, lv), u.toString(),
                0.6, spec.listeningSegments() ? 2_500 : 4_500);

        Map<Integer, JsonNode> bySlot = new HashMap<>();
        int fallback = 0;
        for (JsonNode n : out.path("items")) {
            int slot = n.has("slot") ? n.path("slot").asInt(-1) : -1;
            if (!slots.contains(slot) || bySlot.containsKey(slot)) {
                while (fallback < slots.size() && bySlot.containsKey(slots.get(fallback))) fallback++;
                if (fallback >= slots.size()) break;
                slot = slots.get(fallback);
            }
            bySlot.put(slot, n);
        }
        List<String> problems = new ArrayList<>();
        for (int i = 0; i < slots.size(); i++) {
            int s = slots.get(i);
            JsonNode n = bySlot.get(s);
            String statement = n == null ? null : ExamDraftService.text(n, "statement");
            String answer = n == null ? null : ExamDraftService.text(n, "answer");
            answer = answer == null ? null : answer.trim().toLowerCase(Locale.ROOT);
            boolean segmentOk = !spec.listeningSegments() || s < turns.size();
            if (statement == null || !segmentOk || !(RICHTIG.equals(answer) || FALSCH.equals(answer))) {
                problems.add(spec.itemId(s));
                continue;
            }
            boolean wasLocked = result.get(s) != null && result.get(s).locked();
            result.set(s, new Item(spec.itemId(s), statement, Map.of(RICHTIG, RICHTIG, FALSCH, FALSCH), answer,
                    firstNonBlank(ExamDraftService.text(n, "explanationVi"), ""),
                    firstNonBlank(ExamDraftService.text(n, "evidence"), ""), List.of(), levels.get(i), null, wasLocked,
                    null, List.of()));
        }
        // Teil 2, sinh cả Teil: xếp câu theo thứ tự bằng chứng trong cuộc phỏng vấn rồi đánh số lại. Sinh lại riêng
        // một câu thì KHÔNG xếp lại (mã câu của các câu khác phải giữ nguyên cho hàng đợi sửa); đèn ORDER báo nếu lệch.
        if (!spec.listeningSegments() && todo.size() >= count && problems.isEmpty()) {
            result = inScriptOrder(spec, text.context(), result);
        }
        return new SituationalTeile.ItemsResult(result, text, problems);
    }

    /**
     * Đáp án giao cho từng câu. {@code fixed}: đáp án các câu giữ nguyên ({@code null} = câu cần sinh). Mục tiêu
     * một nửa richtig (số lẻ thì làm tròn ngẫu nhiên lên hoặc xuống); thử xáo vài lần để không có 4 câu liền cùng
     * đáp án.
     */
    static List<String> planAnswers(List<String> fixed, Random rnd) {
        int n = fixed.size();
        int target = n / 2 + (n % 2 == 1 && rnd.nextBoolean() ? 1 : 0);
        int have = (int) fixed.stream().filter(RICHTIG::equals).count();
        List<Integer> open = new ArrayList<>();
        for (int i = 0; i < n; i++) if (fixed.get(i) == null) open.add(i);
        int need = Math.max(0, Math.min(open.size(), target - have));
        List<String> pool = new ArrayList<>();
        for (int i = 0; i < open.size(); i++) pool.add(i < need ? RICHTIG : FALSCH);
        List<String> best = null;
        for (int attempt = 0; attempt < 30; attempt++) {
            Collections.shuffle(pool, rnd);
            List<String> candidate = new ArrayList<>(fixed);
            for (int i = 0; i < open.size(); i++) candidate.set(open.get(i), pool.get(i));
            if (best == null) best = candidate;
            if (longestRun(candidate) <= 3) return candidate;
        }
        return best == null ? new ArrayList<>(fixed) : best;
    }

    static int longestRun(List<String> answers) {
        int best = 0;
        int run = 0;
        String prev = null;
        for (String a : answers) {
            run = a != null && a.equals(prev) ? run + 1 : 1;
            prev = a;
            best = Math.max(best, run);
        }
        return best;
    }

    /**
     * Đèn cân đáp án: GREEN khi mỗi loại chiếm 40–60 % (5 câu ⇒ 2–3, 10 câu ⇒ 4–6); RED khi mọi câu cùng một đáp án
     * (học viên chọn bừa một cột là đúng hết); còn lại YELLOW.
     */
    static String balanceLight(List<String> answers) {
        int n = answers.size();
        if (n == 0) return "RED";
        long rich = answers.stream().filter(RICHTIG::equals).count();
        if (n >= 2 && (rich == 0 || rich == n)) return "RED";
        return rich * 10 >= n * 4L && rich * 10 <= n * 6L ? "GREEN" : "YELLOW";
    }

    /** Vị trí bằng chứng của câu trong lời thoại (đã chuẩn hoá); không tìm thấy ⇒ -1. */
    static int evidencePos(String context, Item it) {
        if (it == null || it.evidence() == null || it.evidence().isBlank()) return -1;
        return norm(context).indexOf(norm(it.evidence()));
    }

    /** Xếp câu theo vị trí bằng chứng (câu không dò được bằng chứng giữ chỗ tương đối) rồi đánh số lại. */
    static List<Item> inScriptOrder(TeilSpec spec, String context, List<Item> items) {
        record Placed(int pos, int index, Item item) {}
        List<Placed> placed = new ArrayList<>();
        int last = 0;
        for (int i = 0; i < items.size(); i++) {
            Item it = items.get(i);
            if (it == null) return items; // thiếu câu: giữ nguyên chỗ, lần sinh sau lấp
            int pos = evidencePos(context, it);
            if (pos < 0) pos = last;
            last = pos;
            placed.add(new Placed(pos, i, it));
        }
        placed.sort(Comparator.comparingInt(Placed::pos).thenComparingInt(Placed::index));
        List<Item> out = new ArrayList<>();
        for (int i = 0; i < placed.size(); i++) out.add(placed.get(i).item().withId(spec.itemId(i), placed.get(i).item().meta()));
        return out;
    }

    // ── Giải thử / chấm thang ───────────────────────────────────────────────────────────────

    static String solverBlock(TeilSpec spec, Text text, List<Item> items, boolean withKey) {
        List<AudioTurn> turns = text.audioTurns() == null ? List.of() : text.audioTurns();
        StringBuilder sb = new StringBuilder();
        if (spec.listeningSegments()) {
            sb.append("HÖRTEXTE (Transkript). Jede Aussage gehört NUR zu dem Hörtext mit derselben Nummer. ")
                    .append("Antwort: \"richtig\" oder \"falsch\".\n");
            if (text.framingDe() != null && !text.framingDe().isBlank()) sb.append("Rahmen: ").append(text.framingDe()).append("\n");
            for (Item it : items) {
                int s = slotOf(spec, it);
                sb.append("\nHÖRTEXT ").append(it.id());
                if (s >= 0 && s < turns.size()) {
                    AudioTurn t = turns.get(s);
                    sb.append(MALE.equals(t.speaker()) ? " (Sprecher)" : " (Sprecherin)");
                    if (t.leadInDe() != null && !t.leadInDe().isBlank()) sb.append(" — ").append(t.leadInDe());
                    sb.append(":\n").append(t.text()).append("\n");
                } else {
                    sb.append(": (fehlt)\n");
                }
                sb.append("AUSSAGE ").append(it.id()).append(": ").append(it.question()).append("\n");
                if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
            }
            return sb.toString();
        }
        sb.append("INTERVIEW (Transkript)\n").append(transcript(turns))
                .append("\nAUSSAGEN (Antwort: \"richtig\" oder \"falsch\")\n");
        for (Item it : items) {
            sb.append(it.id()).append(": ").append(it.question()).append("\n");
            if (withKey) sb.append("  Lösung: ").append(it.correct()).append("\n");
        }
        return sb.toString();
    }

    static String transcript(List<AudioTurn> turns) {
        StringBuilder sb = new StringBuilder();
        for (AudioTurn t : turns) {
            sb.append(t.name() == null || t.name().isBlank() ? (MALE.equals(t.speaker()) ? "Sprecher" : "Sprecherin") : t.name())
                    .append(": ").append(t.text()).append("\n");
        }
        return sb.toString();
    }

    // ── Kiểm riêng ──────────────────────────────────────────────────────────────────────────

    static boolean formatOk(TeilSpec spec, Text text, Item i) {
        if (!(RICHTIG.equals(i.correct()) || FALSCH.equals(i.correct()))) return false;
        if (!spec.listeningSegments()) return true;
        List<AudioTurn> turns = text.audioTurns() == null ? List.of() : text.audioTurns();
        int s = slotOf(spec, i);
        return s >= 0 && s < turns.size() && turns.get(s).text() != null && !turns.get(s).text().isBlank();
    }

    static List<Check> checks(TeilSpec spec, Text text, List<Item> items) {
        List<Check> out = new ArrayList<>();
        List<AudioTurn> turns = text.audioTurns() == null ? List.of() : text.audioTurns();
        List<String> missing = new ArrayList<>();
        if (spec.listeningSegments()) {
            if (turns.size() != spec.textCount()) missing.add("có " + turns.size() + "/" + spec.textCount() + " đoạn lời thoại");
            for (int k = 0; k < turns.size(); k++) {
                AudioTurn t = turns.get(k);
                if (t.text() == null || t.text().isBlank()) missing.add("đoạn " + (k + 1) + " trống");
                if ("HOEREN_ANNOUNCEMENTS".equals(spec.teilType()) && (t.leadInDe() == null || t.leadInDe().isBlank())) {
                    missing.add("đoạn " + (k + 1) + " thiếu câu dẫn tình huống");
                }
            }
            if ("HOEREN_STATEMENTS".equals(spec.teilType()) && (text.framingDe() == null || text.framingDe().isBlank())) {
                missing.add("thiếu câu khung (câu hỏi chung cho năm người)");
            }
        } else {
            if (turns.size() < 6) missing.add("cuộc phỏng vấn mới có " + turns.size() + " lượt lời");
            if (turns.stream().map(AudioTurn::speaker).distinct().count() != 2) missing.add("cần đúng hai giọng (người dẫn và khách)");
            if (turns.stream().anyMatch(t -> t.name() == null || t.name().isBlank())) missing.add("có lượt lời thiếu tên người nói");
        }
        out.add(new Check("SCRIPT", "Lời thoại đủ đoạn, đủ người nói", missing.isEmpty() ? "GREEN" : "RED",
                missing.isEmpty() ? null : capitalize(String.join("; ", missing)) + "."));

        if (spec.listeningSegments()) {
            List<String> bad = new ArrayList<>();
            boolean tooShort = false;
            for (int k = 0; k < turns.size(); k++) {
                int wc = TextChecks.wordCount(turns.get(k).text());
                if (wc < spec.minWords() || wc > spec.maxWords()) bad.add("đoạn " + (k + 1) + ": " + wc + " từ");
                if (wc < spec.minWords() / 2) tooShort = true;
            }
            out.add(new Check("LENGTH", "Mỗi đoạn " + spec.minWords() + "–" + spec.maxWords() + " từ",
                    bad.isEmpty() ? "GREEN" : tooShort ? "RED" : "YELLOW", bad.isEmpty() ? null : capitalize(String.join("; ", bad)) + "."));
            boolean oneVoice = turns.size() > 1 && turns.stream().map(AudioTurn::speaker).distinct().count() < 2;
            out.add(new Check("VOICES", "Có cả giọng nữ và giọng nam", oneVoice ? "YELLOW" : "GREEN",
                    oneVoice ? "Mọi đoạn cùng một giọng — đề viết tay xen kẽ nữ và nam." : null));
        } else {
            int wc = TextChecks.wordCount(text.context());
            boolean ok = wc >= spec.minWords() && wc <= spec.maxWords();
            // Ngắn hẳn (dưới ba phần tư khuôn) là đỏ: không đủ chi tiết cho mười câu ở mười chỗ khác nhau.
            boolean far = wc < spec.minWords() * 3 / 4;
            out.add(new Check("LENGTH", "Độ dài cuộc phỏng vấn", ok ? "GREEN" : far ? "RED" : "YELLOW",
                    wc + " từ (khuôn " + spec.minWords() + "–" + spec.maxWords() + ")."));
        }

        List<String> answers = items.stream().map(Item::correct).toList();
        long rich = answers.stream().filter(RICHTIG::equals).count();
        String bal = balanceLight(answers);
        out.add(new Check("ANSWERS", "Cân richtig/falsch", bal, "GREEN".equals(bal) ? null
                : rich + " câu richtig / " + (items.size() - rich) + " câu falsch."
                + ("RED".equals(bal) ? " Mọi câu cùng một đáp án." : "")));

        if (!spec.listeningSegments()) {
            boolean ordered = true;
            int prev = -1;
            for (Item it : items) {
                int pos = evidencePos(text.context(), it);
                if (pos < 0) continue;
                if (pos < prev) ordered = false;
                prev = pos;
            }
            out.add(new Check("ORDER", "Câu theo thứ tự cuộc phỏng vấn", ordered ? "GREEN" : "YELLOW",
                    ordered ? null : "Có câu đứng sai thứ tự so với bài nghe — bấm Sinh câu hỏi lại để xếp lại."));
        }

        List<String> copied = new ArrayList<>();
        List<String> script = lowerWords(text.context());
        for (Item it : items) {
            int run = longestCommonRun(lowerWords(it.question()), script);
            if (run >= COPY_RUN_LIMIT) copied.add(it.id() + " (" + run + " từ liền)");
        }
        out.add(new Check("PARAPHRASE", "Mệnh đề không chép nguyên văn lời thoại", copied.isEmpty() ? "GREEN" : "YELLOW",
                copied.isEmpty() ? null : "Chép lời thoại: " + String.join(", ", copied) + "."));
        return out;
    }

    /** Dãy từ chung dài nhất (liên tiếp) giữa mệnh đề và lời thoại. */
    static int longestCommonRun(List<String> a, List<String> b) {
        int best = 0;
        int[] prev = new int[b.size() + 1];
        for (String wa : a) {
            int[] cur = new int[b.size() + 1];
            for (int j = 1; j <= b.size(); j++) {
                if (wa.equals(b.get(j - 1))) {
                    cur[j] = prev[j - 1] + 1;
                    best = Math.max(best, cur[j]);
                }
            }
            prev = cur;
        }
        return best;
    }

    // ── Đầu ra đúng khuôn phần HOEREN của đề viết tay (V343) ─────────────────────────────────

    static Map<String, Object> content(TeilSpec spec, Text text, List<Item> items) {
        List<AudioTurn> turns = text.audioTurns() == null ? List.of() : text.audioTurns();
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("teil", spec.teil());
        c.put("point_per_item", spec.points());
        c.put("max_plays", spec.maxPlays());
        c.put("reading_seconds", spec.readingSeconds());
        c.put("ansage_de", spec.ansageDe());
        if ("HOEREN_STATEMENTS".equals(spec.teilType())) c.put("framing_de", text.framingDe());
        c.put("instruction_de", spec.instructionDe());
        c.put("instruction_vi", spec.instructionVi());
        if (!spec.listeningSegments()) {
            List<Map<String, Object>> script = new ArrayList<>();
            for (AudioTurn t : turns) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("speaker", t.speaker());
                m.put("name", t.name());
                m.put("text", t.text());
                script.add(m);
            }
            c.put("audio_script", script);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Item it : items) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", it.id());
            if (spec.listeningSegments()) {
                int s = slotOf(spec, it);
                AudioTurn t = s >= 0 && s < turns.size() ? turns.get(s) : new AudioTurn(FEMALE, null, "", null);
                int number = spec.firstItemNumber() + Math.max(s, 0);
                m.put("speaker", t.speaker());
                if ("HOEREN_ANNOUNCEMENTS".equals(spec.teilType())) {
                    m.put("lead_in_de", "Lesen Sie jetzt die Aufgabe " + number + ". " + nz(t.leadInDe()));
                }
                m.put("question", it.question());
                // Teil 1: người đọc xướng số câu trước mỗi đoạn (nghe một lần, không có câu dẫn riêng).
                m.put("audio_script", "HOEREN_STATEMENTS".equals(spec.teilType()) ? "Nummer " + number + ". " + nz(t.text()) : nz(t.text()));
            } else {
                m.put("question", it.question());
            }
            m.put("correct", it.correct());
            m.put("explanation_vi", it.explanationVi());
            // Khoá riêng của Xưởng đề (đề viết tay không có; bộ lọc đề của học viên bỏ các khoá này).
            m.put("evidence", it.evidence());
            m.put("difficulty_target", it.difficultyTarget());
            m.put("difficulty_measured", it.difficultyMeasured() == null ? null : it.difficultyMeasured().level());
            out.add(m);
        }
        c.put("items", out);
        return c;
    }

    // ── Phụ ────────────────────────────────────────────────────────────────────────────────

    /** Vị trí của câu trong Teil theo số ở cuối mã ("HV1-43" ⇒ 2). */
    static int slotOf(TeilSpec spec, Item it) {
        String id = it.id() == null ? "" : it.id();
        if (!id.startsWith(spec.itemIdPrefix())) return -1;
        try {
            return Integer.parseInt(id.substring(spec.itemIdPrefix().length())) - spec.firstItemNumber();
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static String speakerOf(String gender, int index) {
        if (gender == null || gender.isBlank()) return index % 2 == 0 ? FEMALE : MALE;
        return isMale(gender) ? MALE : FEMALE;
    }

    private static boolean isMale(String gender) {
        String g = gender == null ? "" : gender.trim().toLowerCase(Locale.ROOT);
        return g.equals("m") || g.startsWith("mann") || g.startsWith("mä") || g.startsWith("male") || g.equals("partner");
    }

    private static String numberWord(int n) {
        return switch (n) {
            case 3 -> "drei";
            case 4 -> "vier";
            case 5 -> "fünf";
            case 6 -> "sechs";
            default -> String.valueOf(n);
        };
    }

    /** Model đôi khi tự thêm "Nummer 41." ở đầu đoạn — bỏ đi, số được ghép lúc xuất. */
    private static String stripNumber(String s) {
        return s.replaceFirst("^(?i)nummer\\s+\\d+\\s*[.:]\\s*", "");
    }

    private static String stripLeadNumber(String s) {
        return s.replaceFirst("^(?i)lesen sie jetzt die aufgabe\\s+\\d+\\s*[.:]\\s*", "");
    }

    private static String clean(String s) {
        return s == null ? "" : s.replace("**", "").replaceAll("\\s+", " ").trim();
    }

    private static List<String> lowerWords(String s) {
        List<String> out = new ArrayList<>();
        for (String w : TextChecks.words(s == null ? "" : s)) out.add(w.toLowerCase(Locale.GERMAN));
        return out;
    }

    private static String norm(String s) {
        return s == null ? "" : s.replaceAll("[\\s*]+", " ").trim().toLowerCase(Locale.ROOT).replaceAll("[„“”\"]", "\"");
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String firstNonBlank(String... vs) {
        return ExamDraftService.firstNonBlank(vs);
    }
}
