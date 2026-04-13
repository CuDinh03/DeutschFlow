package com.deutschflow.user.service;

import com.deutschflow.user.dto.SessionDetailResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Builds session exercises from the current theory lesson plus the previous session's theory,
 * with varied formats (MC, gap, word order, true/false, text, listen, speak-repeat, industry vocab).
 */
public final class TheoryBasedExerciseGenerator {

    private static final Pattern WS = Pattern.compile("\\s+");

    private TheoryBasedExerciseGenerator() {}

    public static List<SessionDetailResponse.ExerciseItem> generate(
            long userId,
            int week,
            int sessionIndex,
            String sessionType,
            SessionDetailResponse.TheoryLesson current,
            SessionDetailResponse.TheoryLesson previous,
            String industry,
            List<String> interestTags,
            int minutes,
            int difficulty,
            String uiLang,
            ObjectMapper objectMapper
    ) {
        String lang = uiLang == null ? "vi" : uiLang.trim().toLowerCase(Locale.ROOT);
        long seed = userId * 7919L + week * 1301L + sessionIndex * 97L;
        Random rnd = new Random(seed);

        List<SourcePhrase> phrases = new ArrayList<>();
        List<SourceVocab> vocabs = new ArrayList<>();
        collect(current, phrases, vocabs, "");
        if (previous != null) {
            collect(previous, phrases, vocabs, "prev");
        }
        vocabs.addAll(industryVocabs(industry, rnd));

        if (phrases.isEmpty() && vocabs.isEmpty()) {
            return fallbackBank(lang, week, sessionIndex, difficulty, minutes, 0);
        }

        int targetCount = Math.min(14, Math.max(12, Math.max(6, minutes / 4)));
        int perMin = Math.max(3, minutes / Math.max(1, targetCount));

        List<SessionDetailResponse.ExerciseItem> out = new ArrayList<>();
        Set<String> usedQuestions = new HashSet<>();
        int n = 0;

        // 1–2: article / gender MC from noun phrases
        for (SourceVocab v : pickDistinct(vocabs, rnd, 4)) {
            if (out.size() >= targetCount) break;
            var ex = articleMc(lang, week, sessionIndex, n++, v, rnd, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        // Gap (subject or article) from short phrase
        for (SourcePhrase p : pickDistinct(phrases, rnd, 3)) {
            if (out.size() >= targetCount) break;
            var ex = gapMc(lang, week, sessionIndex, n++, p, rnd, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        // Word order: ưu tiên kéo thả (ORDER_DRAG), sau đó ORDER_MC
        int dragBudget = 4;
        for (SourcePhrase p : pickDistinct(phrases, rnd, 8)) {
            if (out.size() >= targetCount) break;
            SessionDetailResponse.ExerciseItem ex = null;
            if (dragBudget > 0) {
                ex = mainOrderDrag(lang, week, sessionIndex, n, p, rnd, usedQuestions, difficulty, perMin);
                if (ex != null) {
                    n++;
                    dragBudget--;
                }
            }
            if (ex == null) {
                ex = orderMc(lang, week, sessionIndex, n++, p, rnd, usedQuestions, difficulty, perMin);
            }
            if (ex != null) {
                out.add(ex);
            }
        }

        // Meaning match
        for (SourceVocab v : pickDistinct(vocabs, rnd, 5)) {
            if (out.size() >= targetCount) break;
            var ex = meaningMc(lang, week, sessionIndex, n++, v, vocabs, rnd, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        // True / false grammar-ish
        for (SourcePhrase p : pickDistinct(phrases, rnd, 3)) {
            if (out.size() >= targetCount) break;
            var ex = trueFalseMc(lang, week, sessionIndex, n++, p, rnd, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        // Listen + MC (audio = German sentence)
        for (SourcePhrase p : pickDistinct(phrases, rnd, 3)) {
            if (out.size() >= targetCount) break;
            var ex = listenMc(lang, week, sessionIndex, n++, p, rnd, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        // Text / repeat (short phrase)
        for (SourcePhrase p : pickDistinct(phrases, rnd, 2)) {
            if (out.size() >= targetCount) break;
            var ex = speakRepeat(lang, week, sessionIndex, n++, p, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        // Interest-themed quick MC
        var interestEx = interestMc(lang, week, sessionIndex, n++, interestTags, rnd, usedQuestions, difficulty, perMin);
        if (interestEx != null && out.size() < targetCount) {
            out.add(interestEx);
        }

        // Memory-style: match German columns (still MC: pick correct translation)
        for (SourceVocab v : pickDistinct(vocabs, rnd, 3)) {
            if (out.size() >= targetCount) break;
            var ex = memoryMc(lang, week, sessionIndex, n++, v, vocabs, rnd, usedQuestions, difficulty, perMin);
            if (ex != null) out.add(ex);
        }

        int fbSalt = 0;
        while (out.size() < 6) {
            out.addAll(fallbackBank(lang, week, sessionIndex, difficulty, perMin, fbSalt));
            fbSalt += 2;
        }

        ensureMinListeningAndWriting(out, lang, week, sessionIndex, phrases, vocabs, rnd, usedQuestions, difficulty, perMin, n);

        return List.copyOf(out);
    }

    private static long countListening(List<SessionDetailResponse.ExerciseItem> out) {
        return out.stream().filter(e -> "LISTENING".equals(e.skill())).count();
    }

    private static long countWriting(List<SessionDetailResponse.ExerciseItem> out) {
        return out.stream().filter(e -> "TEXT".equals(e.format()) || "SPEAK_REPEAT".equals(e.format())).count();
    }

    /**
     * Tối thiểu 3 bài nghe (LISTENING) và 3 bài viết (TEXT hoặc SPEAK_REPEAT) trong bài tập tổng hợp.
     */
    private static void ensureMinListeningAndWriting(
            List<SessionDetailResponse.ExerciseItem> out,
            String lang,
            int week,
            int sessionIndex,
            List<SourcePhrase> phrases,
            List<SourceVocab> vocabs,
            Random rnd,
            Set<String> used,
            int diff,
            int perMin,
            int startIdx
    ) {
        int idx = Math.max(startIdx, 9000);
        int guard = 0;
        while (countListening(out) < 3 && guard++ < 40) {
            SessionDetailResponse.ExerciseItem added = null;
            for (SourcePhrase p : pickDistinct(phrases, rnd, 25)) {
                var ex = listenMc(lang, week, sessionIndex, idx++, p, rnd, used, diff, perMin);
                if (ex != null) {
                    out.add(ex);
                    added = ex;
                    break;
                }
            }
            if (added == null) {
                break;
            }
        }
        guard = 0;
        while (countWriting(out) < 3 && guard++ < 40) {
            SessionDetailResponse.ExerciseItem added = null;
            for (SourcePhrase p : pickDistinct(phrases, rnd, 25)) {
                var ex = speakRepeat(lang, week, sessionIndex, idx++, p, used, diff, perMin);
                if (ex != null) {
                    out.add(ex);
                    added = ex;
                    break;
                }
            }
            if (added == null) {
                for (SourceVocab v : pickDistinct(vocabs, rnd, 20)) {
                    var ex = mainTypeGermanForMeaning(lang, week, sessionIndex, idx++, v, rnd, used, diff, perMin);
                    if (ex != null) {
                        out.add(ex);
                        added = ex;
                        break;
                    }
                }
            }
            if (added == null) {
                break;
            }
        }
    }

    /** TEXT: gõ từ tiếng Đức theo nghĩa (bổ sung tối thiểu bài viết). */
    private static SessionDetailResponse.ExerciseItem mainTypeGermanForMeaning(
            String lang, int week, int session, int idx, SourceVocab v, Random rnd, Set<String> used, int diff, int min
    ) {
        if (v.meaning().isBlank() || v.german().length() > 48) return null;
        String norm = normalizeAnswer(v.german().trim());
        if (norm.isBlank()) return null;
        String q = I18n.pick(lang,
                "Gõ từ/cụm tiếng Đức cho nghĩa:\n«" + v.meaning() + "»",
                "Type the German word/phrase for:\n«" + v.meaning() + "»",
                "Tippe das deutsche Wort zu:\n„" + v.meaning() + "“");
        if (!register(used, "maintxt:" + q)) return null;
        String title = I18n.pick(lang, "Schreiben", "Writing", "Schreiben");
        return item("w", week, session, idx, title, "VOCABULARY", diff, min, q, List.of(), "TEXT", null, norm, v.exampleDe(), null);
    }

    /** Ghép câu kéo thả (bài tập tổng hợp). */
    private static SessionDetailResponse.ExerciseItem mainOrderDrag(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        List<String> tokens = tokenize(p.text());
        if (tokens.size() < 3 || tokens.size() > 9) return null;
        String q = I18n.pick(lang,
                "Kéo thả các nhãn để ghép đúng câu tiếng Đức.",
                "Drag labels to build the correct German sentence.",
                "Ziehe die Wörter in die richtige Reihenfolge.");
        if (!register(used, "mdrag:" + p.text())) return null;
        List<String> labels = shuffleCopy(tokens, rnd);
        String norm = tokens.stream().map(TheoryBasedExerciseGenerator::normalizeAnswer).collect(Collectors.joining("|"));
        String title = I18n.pick(lang, "Satzbau (kéo thả)", "Word order (drag)", "Satzbau (Drag & Drop)");
        String expl = I18n.pick(lang,
                "Thứ tự đúng: «" + String.join(" ", tokens) + "».",
                "Correct order: «" + String.join(" ", tokens) + "».",
                "Richtige Reihenfolge: „" + String.join(" ", tokens) + "“.");
        return item("w", week, session, idx, title, "GRAMMAR", diff, min,
                q + "\n\n« " + String.join(" · ", labels) + " »",
                labels, "ORDER_DRAG", null, norm, p.text(), expl);
    }

    /**
     * Exactly ten quick exercises from the <strong>current</strong> theory only (no previous session),
     * mixed formats including typing and drag-order.
     */
    public static List<SessionDetailResponse.ExerciseItem> generateTheoryGate(
            long userId,
            int week,
            int sessionIndex,
            SessionDetailResponse.TheoryLesson current,
            String industry,
            List<String> interestTags,
            int minutes,
            int difficulty,
            String uiLang,
            ObjectMapper objectMapper
    ) {
        String lang = uiLang == null ? "vi" : uiLang.trim().toLowerCase(Locale.ROOT);
        long seed = userId * 9173L + week * 1301L + sessionIndex * 101L;
        Random rnd = new Random(seed);

        List<SourcePhrase> phrases = new ArrayList<>();
        List<SourceVocab> vocabs = new ArrayList<>();
        collect(current, phrases, vocabs, "");
        vocabs.addAll(industryVocabs(industry, rnd));

        if (phrases.isEmpty() && vocabs.isEmpty()) {
            return gateFallbackTen(lang, week, sessionIndex, difficulty, Math.max(2, minutes / 10));
        }

        int perMin = Math.max(2, minutes / 10);
        Set<String> used = new HashSet<>();
        List<SessionDetailResponse.ExerciseItem> out = new ArrayList<>();
        int idx = 0;

        for (SourceVocab v : pickDistinct(vocabs, rnd, 8)) {
            if (out.size() >= 10) break;
            var ex = gateArticleMc(lang, week, sessionIndex, idx++, v, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourcePhrase p : pickDistinct(phrases, rnd, 8)) {
            if (out.size() >= 10) break;
            var ex = gateGapMc(lang, week, sessionIndex, idx++, p, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourcePhrase p : pickDistinct(phrases, rnd, 8)) {
            if (out.size() >= 10) break;
            var ex = gateOrderDrag(lang, week, sessionIndex, idx++, p, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourceVocab v : pickDistinct(vocabs, rnd, 10)) {
            if (out.size() >= 10) break;
            var ex = gateMeaningMc(lang, week, sessionIndex, idx++, v, vocabs, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourcePhrase p : pickDistinct(phrases, rnd, 6)) {
            if (out.size() >= 10) break;
            var ex = gateTrueFalseMc(lang, week, sessionIndex, idx++, p, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourcePhrase p : pickDistinct(phrases, rnd, 6)) {
            if (out.size() >= 10) break;
            var ex = gateListenMc(lang, week, sessionIndex, idx++, p, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourcePhrase p : pickDistinct(phrases, rnd, 4)) {
            if (out.size() >= 10) break;
            var ex = gateSpeakRepeat(lang, week, sessionIndex, idx++, p, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourceVocab v : pickDistinct(vocabs, rnd, 8)) {
            if (out.size() >= 10) break;
            var ex = gateTypeGermanForMeaning(lang, week, sessionIndex, idx++, v, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        for (SourcePhrase p : pickDistinct(phrases, rnd, 6)) {
            if (out.size() >= 10) break;
            var ex = gateOrderMc(lang, week, sessionIndex, idx++, p, rnd, used, difficulty, perMin);
            if (ex != null) out.add(ex);
        }
        var interestEx = gateInterestMc(lang, week, sessionIndex, idx++, interestTags, rnd, used, difficulty, perMin);
        if (interestEx != null && out.size() < 10) {
            out.add(interestEx);
        }

        int salt = 0;
        while (out.size() < 10) {
            for (SessionDetailResponse.ExerciseItem fb : fallbackBank(lang, week, sessionIndex, difficulty, perMin, salt)) {
                if (out.size() >= 10) break;
                SessionDetailResponse.ExerciseItem g = remapToGateWithExplanation(fb, week, sessionIndex, out.size(), lang);
                out.add(g);
            }
            salt += 2;
        }
        return out.stream().limit(10).toList();
    }

    private static SessionDetailResponse.ExerciseItem remapToGateWithExplanation(
            SessionDetailResponse.ExerciseItem fb, int week, int sessionIndex, int ord, String lang
    ) {
        String newId = "gt" + week + "s" + sessionIndex + "_" + ord;
        String expl = I18n.pick(lang,
                "Đáp án đúng theo quy tắc ngữ pháp / từ vựng của buổi này.",
                "This matches the grammar/vocabulary rule from today's lesson.",
                "Das passt zur heutigen Grammatik / zum Wortschatz.");
        return new SessionDetailResponse.ExerciseItem(
                newId,
                fb.title(),
                fb.skill(),
                fb.difficulty(),
                fb.minutes(),
                fb.question(),
                fb.options(),
                fb.format(),
                fb.correctOptionIndex(),
                fb.expectedAnswerNormalized(),
                fb.audioGerman(),
                expl
        );
    }

    private static List<SessionDetailResponse.ExerciseItem> gateFallbackTen(
            String lang, int week, int sessionIndex, int difficulty, int perMin
    ) {
        List<SessionDetailResponse.ExerciseItem> out = new ArrayList<>();
        int salt = 0;
        while (out.size() < 10) {
            for (SessionDetailResponse.ExerciseItem fb : fallbackBank(lang, week, sessionIndex, difficulty, perMin, salt)) {
                out.add(remapToGateWithExplanation(fb, week, sessionIndex, out.size(), lang));
                if (out.size() >= 10) break;
            }
            salt += 2;
        }
        return out;
    }

    private static SessionDetailResponse.ExerciseItem gateArticleMc(
            String lang, int week, int session, int idx, SourceVocab v, Random rnd, Set<String> used, int diff, int min
    ) {
        String noun = stripLeadingArticle(v.german());
        if (noun.isBlank() || noun.equalsIgnoreCase(v.german())) {
            return null;
        }
        String q = I18n.pick(lang,
                "Chọn mạo từ đúng cho: " + noun + "\nNgữ cảnh: " + shorten(v.exampleDe(), 80),
                "Choose the correct article for: " + noun + "\nContext: " + shorten(v.exampleDe(), 80),
                "Wähle den richtigen Artikel für: " + noun + "\nKontext: " + shorten(v.exampleDe(), 80));
        if (!register(used, "gt:" + q)) return null;
        String correct = leadingArticleToken(v.german());
        if (correct == null) return null;
        List<String> pool = new ArrayList<>(List.of("der", "die", "das", "ein", "eine"));
        pool.removeIf(x -> x.equalsIgnoreCase(correct));
        Collections.shuffle(pool, rnd);
        List<String> opts = new ArrayList<>();
        opts.add(correct.toLowerCase(Locale.ROOT));
        for (String p : pool) {
            if (opts.size() >= 4) break;
            if (!opts.contains(p)) opts.add(p);
        }
        Collections.shuffle(opts, rnd);
        int correctIdx = opts.indexOf(correct.toLowerCase(Locale.ROOT));
        String title = I18n.pick(lang, "Ôn: Artikel", "Review: articles", "Wiederholung: Artikel");
        String expl = I18n.pick(lang,
                "Danh từ «" + noun + "» đi với mạo từ «" + correct + "» trong tiếng Đức.",
                "The noun «" + noun + "» uses the article «" + correct + "».",
                "Zu „" + noun + "“ passt der Artikel „" + correct + "“.");
        return item("gt", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "MC", correctIdx, null, v.exampleDe(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateGapMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        List<String> tokens = tokenize(p.text());
        if (tokens.size() < 3) return null;
        String first = tokens.get(0);
        if (!Character.isUpperCase(first.charAt(0))) return null;
        String masked = "___ " + String.join(" ", tokens.subList(1, tokens.size()));
        String q = I18n.pick(lang,
                "Điền vào chỗ trống (gõ một từ tiếng Đức):\n" + masked,
                "Fill the gap (type one German word):\n" + masked,
                "Ergänze (ein Wort tippen):\n" + masked);
        if (!register(used, "gtgap:" + q)) return null;
        List<String> opts = List.of();
        String norm = normalizeAnswer(first);
        String title = I18n.pick(lang, "Ôn: Lückentext", "Review: gap", "Wiederholung: Lückentext");
        String expl = I18n.pick(lang,
                "Chủ ngữ / từ đầu câu đúng là «" + first + "».",
                "The correct first word is «" + first + "».",
                "Das richtige erste Wort ist „" + first + "“.");
        return item("gt", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "TEXT", null, norm, p.text(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateOrderDrag(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        List<String> tokens = tokenize(p.text());
        if (tokens.size() < 3 || tokens.size() > 9) return null;
        String q = I18n.pick(lang,
                "Ghép câu đúng: kéo thả các nhãn theo thứ tự.",
                "Build the sentence: drag labels into the correct order.",
                "Satzbau: ziehe die Wörter in die richtige Reihenfolge.");
        if (!register(used, "gtdrag:" + p.text())) return null;
        List<String> labels = shuffleCopy(tokens, rnd);
        String norm = tokens.stream().map(TheoryBasedExerciseGenerator::normalizeAnswer).collect(Collectors.joining("|"));
        String title = I18n.pick(lang, "Ôn: Kéo thả", "Review: drag order", "Wiederholung: Reihenfolge");
        String expl = I18n.pick(lang,
                "Thứ tự đúng: «" + String.join(" ", tokens) + "».",
                "Correct order: «" + String.join(" ", tokens) + "».",
                "Richtige Reihenfolge: „" + String.join(" ", tokens) + "“.");
        return item("gt", week, session, idx, title, "GRAMMAR", diff, min,
                q + "\n\n« " + String.join(" · ", labels) + " »",
                labels, "ORDER_DRAG", null, norm, p.text(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateMeaningMc(
            String lang, int week, int session, int idx, SourceVocab target, List<SourceVocab> pool, Random rnd,
            Set<String> used, int diff, int min
    ) {
        if (target.meaning().isBlank()) return null;
        String q = I18n.pick(lang,
                "Chọn cụm tiếng Đức khớp nghĩa:\n“" + target.meaning() + "”",
                "Pick the German that matches:\n“" + target.meaning() + "”",
                "Wähle das passende Deutsch zu:\n„" + target.meaning() + "“");
        if (!register(used, "gtmean:" + q)) return null;
        List<String> opts = new ArrayList<>();
        opts.add(target.german());
        List<SourceVocab> others = new ArrayList<>(pool);
        Collections.shuffle(others, rnd);
        for (SourceVocab o : others) {
            if (opts.size() >= 4) break;
            if (!o.german().equalsIgnoreCase(target.german())) {
                opts.add(o.german());
            }
        }
        while (opts.size() < 4) {
            opts.add("der Tisch");
        }
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(target.german());
        String title = I18n.pick(lang, "Ôn: Nghĩa", "Review: meaning", "Wiederholung: Bedeutung");
        String expl = I18n.pick(lang,
                "«" + target.german() + "» tương ứng với nghĩa đã cho.",
                "«" + target.german() + "» matches the given meaning.",
                "„" + target.german() + "“ passt zur Bedeutung.");
        return item("gt", week, session, idx, title, "VOCABULARY", diff, min, q, opts, "MC", ci, null, target.exampleDe(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateTrueFalseMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        boolean statementTrue = rnd.nextBoolean();
        String stmt = statementTrue ? p.text() : flipArticleOrWord(p.text(), rnd);
        String q = I18n.pick(lang,
                "Richtig oder falsch?\n" + stmt,
                "True or false?\n" + stmt,
                "Richtig oder falsch?\n" + stmt);
        if (!register(used, "gttf:" + stmt)) return null;
        List<String> opts = List.of(
                I18n.pick(lang, "Đúng", "True", "Richtig"),
                I18n.pick(lang, "Sai", "False", "Falsch")
        );
        int ci = statementTrue ? 0 : 1;
        String title = I18n.pick(lang, "Ôn: Richtig/Falsch", "Review: T/F", "Wiederholung: R/F");
        String expl = I18n.pick(lang,
                statementTrue ? "Câu phản ánh đúng nội dung lý thuyết." : "Câu đã bị đổi chi tiết nên là sai.",
                statementTrue ? "The statement matches the lesson." : "The statement was altered, so it is false.",
                statementTrue ? "Die Aussage stimmt mit der Lektion überein." : "Die Aussage wurde verändert und ist falsch.");
        return item("gt", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "TRUE_FALSE", ci, null, p.text(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateListenMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        if (p.meaning().isBlank()) return null;
        String q = I18n.pick(lang,
                "Nghe (nút loa) rồi chọn nghĩa phù hợp nhất.",
                "Listen, then pick the best meaning.",
                "Hör zu, dann wähle die beste Bedeutung.");
        if (!register(used, "gtlisten:" + p.text())) return null;
        List<String> meanings = new ArrayList<>();
        meanings.add(p.meaning());
        for (String d : List.of(
                "Etwas anderes passiert.",
                "Wir bestellen Kaffee.",
                "Der Zug hat Verspätung.",
                "Das Wetter ist schlecht.")) {
            if (meanings.size() >= 4) break;
            if (!d.equalsIgnoreCase(p.meaning())) {
                meanings.add(d);
            }
        }
        Collections.shuffle(meanings, rnd);
        int ci = meanings.indexOf(p.meaning());
        String title = I18n.pick(lang, "Ôn: Hören", "Review: listening", "Wiederholung: Hören");
        String expl = I18n.pick(lang,
                "Bản ghi là «" + shorten(p.text(), 72) + "» — nghĩa phù hợp nhất đã chọn.",
                "The audio is «" + shorten(p.text(), 72) + "» — the best meaning is selected.",
                "Der Satz ist „" + shorten(p.text(), 72) + "“ — die beste Bedeutung passt.");
        return item("gt", week, session, idx, title, "LISTENING", diff, min, q, meanings, "MC", ci, null, p.text(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateSpeakRepeat(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        if (p.text().length() > 72) return null;
        String norm = normalizeAnswer(p.text());
        String q = I18n.pick(lang,
                "Nghe (loa) và gõ lại câu tiếng Đức (chính tả gần đúng được chấp nhận).",
                "Listen and type the German sentence (minor typos allowed).",
                "Hör zu und tippe den deutschen Satz (kleine Tippfehler sind ok).");
        if (!register(used, "gtspeak:" + norm)) return null;
        String title = I18n.pick(lang, "Ôn: Nachsprechen", "Review: shadowing", "Wiederholung: Nachsprechen");
        String expl = I18n.pick(lang,
                "Mẫu đúng: «" + p.text() + "».",
                "Model answer: «" + p.text() + "».",
                "Muster: „" + p.text() + "“.");
        return item("gt", week, session, idx, title, "SPEAKING", diff, min, q + "\n\n« " + p.text() + " »", List.of(),
                "SPEAK_REPEAT", null, norm, p.text(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateTypeGermanForMeaning(
            String lang, int week, int session, int idx, SourceVocab v, Random rnd, Set<String> used, int diff, int min
    ) {
        if (v.meaning().isBlank() || v.german().length() > 48) return null;
        String norm = normalizeAnswer(v.german().trim());
        if (norm.isBlank()) return null;
        String q = I18n.pick(lang,
                "Gõ từ/cụm tiếng Đức cho nghĩa:\n«" + v.meaning() + "»",
                "Type the German word/phrase for:\n«" + v.meaning() + "»",
                "Tippe das deutsche Wort zu:\n„" + v.meaning() + "“");
        if (!register(used, "gttyp:" + q)) return null;
        String title = I18n.pick(lang, "Ôn: Gõ từ", "Review: typing", "Wiederholung: Tippen");
        String expl = I18n.pick(lang,
                "Mẫu: «" + v.german() + "».",
                "Expected: «" + v.german() + "».",
                "Erwartet: „" + v.german() + "“.");
        return item("gt", week, session, idx, title, "VOCABULARY", diff, min, q, List.of(), "TEXT", null, norm, v.exampleDe(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateOrderMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        List<String> tokens = tokenize(p.text());
        if (tokens.size() < 4 || tokens.size() > 10) return null;
        String correct = String.join(" ", tokens);
        String q = I18n.pick(lang,
                "Sắp xếp thành câu đúng (chọn một đáp án):\n" + String.join(" / ", shuffleCopy(tokens, rnd)),
                "Build the correct sentence (pick one):\n" + String.join(" / ", shuffleCopy(tokens, rnd)),
                "Bilde den richtigen Satz (eine Option wählen):\n" + String.join(" / ", shuffleCopy(tokens, rnd)));
        if (!register(used, "gtordmc:" + q)) return null;
        List<String> opts = new ArrayList<>();
        opts.add(correct);
        opts.add(wrongOrder(tokens, rnd, 1));
        opts.add(wrongOrder(tokens, rnd, 2));
        opts.add(wrongOrder(tokens, rnd, 3));
        dedupKeepFirst(opts);
        while (opts.size() < 4) {
            opts.add(correct + ".");
        }
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(correct);
        String title = I18n.pick(lang, "Ôn: Satzbau (MC)", "Review: word order", "Wiederholung: Satzbau");
        String expl = I18n.pick(lang,
                "Câu đúng: «" + correct + "».",
                "Correct sentence: «" + correct + "».",
                "Richtiger Satz: „" + correct + "“.");
        return item("gt", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "ORDER_MC", ci, null, p.text(), expl);
    }

    private static SessionDetailResponse.ExerciseItem gateInterestMc(
            String lang, int week, int session, int idx, List<String> tags, Random rnd, Set<String> used, int diff, int min
    ) {
        if (tags == null || tags.isEmpty()) return null;
        String tag = tags.get(rnd.nextInt(tags.size()));
        String q = I18n.pick(lang,
                "Chọn câu phù hợp sở thích / chủ đề: " + tag,
                "Pick a phrase that fits your interest: " + tag,
                "Wähle eine passende Phrase zu: " + tag);
        if (!register(used, "gtint:" + q)) return null;
        List<String> pool = interestPool(tag);
        String correct = pool.get(0);
        List<String> opts = new ArrayList<>(pool);
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(correct);
        String title = I18n.pick(lang, "Ôn: Interessen", "Review: interests", "Wiederholung: Interessen");
        String expl = I18n.pick(lang,
                "Câu «" + shorten(correct, 80) + "» phù hợp chủ đề đã nêu.",
                "«" + shorten(correct, 80) + "» fits the topic.",
                "„" + shorten(correct, 80) + "“ passt zum Thema.");
        return item("gt", week, session, idx, title, "VOCABULARY", diff, min, q, opts, "MC", ci, null, correct, expl);
    }

    public static List<String> parseInterestTags(String interestsJson, ObjectMapper objectMapper) {
        if (interestsJson == null || interestsJson.isBlank()) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(interestsJson, new TypeReference<>() {});
            return list == null ? List.of() : list.stream().filter(s -> s != null && !s.isBlank()).toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    private record SourcePhrase(String text, String meaning, String tag) {}

    private record SourceVocab(String german, String meaning, String exampleDe, String tag) {}

    private static void collect(SessionDetailResponse.TheoryLesson tl, List<SourcePhrase> phrases, List<SourceVocab> vocabs, String tag) {
        if (tl == null) return;
        for (var p : tl.phrases()) {
            if (p.german() != null && p.german().trim().length() >= 6) {
                phrases.add(new SourcePhrase(p.german().trim(), nz(p.meaning()), tag));
            }
        }
        for (var e : tl.examples()) {
            if (e.german() != null && e.german().trim().length() >= 8) {
                phrases.add(new SourcePhrase(e.german().trim(), nz(e.translation()), tag));
            }
        }
        for (var v : tl.vocabulary()) {
            if (v.german() != null && !v.german().isBlank()) {
                vocabs.add(new SourceVocab(v.german().trim(), nz(v.meaning()), nz(v.exampleDe()), tag));
            }
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s.trim();
    }

    private static List<SourceVocab> industryVocabs(String industry, Random rnd) {
        if (industry == null || industry.isBlank()) {
            return List.of();
        }
        String ind = industry.toLowerCase(Locale.ROOT);
        List<SourceVocab> list = new ArrayList<>();
        if (ind.contains("it") || ind.contains("code") || ind.contains("software") || ind.contains("java")) {
            list.add(new SourceVocab("der Server", "Server", "Der Server ist offline.", "job"));
            list.add(new SourceVocab("die Datenbank", "Datenbank", "Die Datenbank antwortet nicht.", "job"));
            list.add(new SourceVocab("der Fehler", "Fehler", "Wir finden den Fehler im Log.", "job"));
            list.add(new SourceVocab("die Schnittstelle", "Schnittstelle / API", "Die Schnittstelle liefert JSON.", "job"));
        } else if (ind.contains("pflege") || ind.contains("y tế") || ind.contains("health")) {
            list.add(new SourceVocab("die Schicht", "Schicht", "Heute habe ich Frühschicht.", "job"));
            list.add(new SourceVocab("der Patient", "Patient", "Der Patient wartet draußen.", "job"));
        } else {
            list.add(new SourceVocab("das Projekt", "Projekt", "Das Projekt startet nächste Woche.", "job"));
            list.add(new SourceVocab("das Team", "Team", "Unser Team arbeitet remote.", "job"));
        }
        Collections.shuffle(list, rnd);
        return list.subList(0, Math.min(2, list.size()));
    }

    private static <T> List<T> pickDistinct(List<T> all, Random rnd, int tries) {
        List<T> copy = new ArrayList<>(all);
        Collections.shuffle(copy, rnd);
        return copy.stream().distinct().limit(tries).toList();
    }

    private static boolean register(Set<String> used, String q) {
        String k = q.trim().toLowerCase(Locale.ROOT);
        if (k.length() < 12) {
            k = k + "::short";
        }
        return used.add(k);
    }

    private static SessionDetailResponse.ExerciseItem articleMc(
            String lang, int week, int session, int idx, SourceVocab v, Random rnd, Set<String> used, int diff, int min
    ) {
        String noun = stripLeadingArticle(v.german());
        if (noun.isBlank() || noun.equalsIgnoreCase(v.german())) {
            return null;
        }
        String q = I18n.pick(lang,
                "Chọn mạo từ đúng cho: " + noun + "\nNgữ cảnh: " + shorten(v.exampleDe(), 80),
                "Choose the correct article for: " + noun + "\nContext: " + shorten(v.exampleDe(), 80),
                "Wähle den richtigen Artikel für: " + noun + "\nKontext: " + shorten(v.exampleDe(), 80));
        if (!register(used, q)) return null;
        String correct = leadingArticleToken(v.german());
        if (correct == null) return null;
        List<String> pool = new ArrayList<>(List.of("der", "die", "das", "ein", "eine"));
        pool.removeIf(x -> x.equalsIgnoreCase(correct));
        Collections.shuffle(pool, rnd);
        List<String> opts = new ArrayList<>();
        opts.add(correct.toLowerCase(Locale.ROOT));
        for (String p : pool) {
            if (opts.size() >= 4) break;
            if (!opts.contains(p)) opts.add(p);
        }
        Collections.shuffle(opts, rnd);
        int correctIdx = opts.indexOf(correct.toLowerCase(Locale.ROOT));
        String title = I18n.pick(lang, "Lückenfüller / Artikel", "Gap — articles", "Lückentext — Artikel");
        return item("w", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "MC", correctIdx, null, v.exampleDe(), null);
    }

    private static SessionDetailResponse.ExerciseItem gapMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        List<String> tokens = tokenize(p.text());
        if (tokens.size() < 3) return null;
        String first = tokens.get(0);
        if (!Character.isUpperCase(first.charAt(0))) return null;
        String masked = "___ " + String.join(" ", tokens.subList(1, tokens.size()));
        String q = I18n.pick(lang,
                "Điền vào chỗ trống (chọn một từ):\n" + masked,
                "Fill the gap (pick one word):\n" + masked,
                "Ergänze (ein Wort wählen):\n" + masked);
        if (!register(used, q)) return null;
        List<String> distractors = List.of("Du", "Wir", "Sie", "Es", "Man", "Hier");
        List<String> opts = new ArrayList<>();
        opts.add(first);
        for (String d : distractors) {
            if (opts.size() >= 4) break;
            if (!d.equalsIgnoreCase(first)) opts.add(d);
        }
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(first);
        String title = I18n.pick(lang, "Lückenfüller / Satz", "Gap — sentence", "Lückentext — Satz");
        return item("w", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "MC", ci, first.toLowerCase(Locale.ROOT), p.text(), null);
    }

    private static SessionDetailResponse.ExerciseItem orderMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        List<String> tokens = tokenize(p.text());
        if (tokens.size() < 4 || tokens.size() > 10) return null;
        String correct = String.join(" ", tokens);
        String q = I18n.pick(lang,
                "Sắp xếp thành câu đúng (chọn một đáp án):\n" + String.join(" / ", shuffleCopy(tokens, rnd)),
                "Build the correct sentence (pick one):\n" + String.join(" / ", shuffleCopy(tokens, rnd)),
                "Bilde den richtigen Satz (eine Option wählen):\n" + String.join(" / ", shuffleCopy(tokens, rnd)));
        if (!register(used, q)) return null;
        List<String> opts = new ArrayList<>();
        opts.add(correct);
        opts.add(wrongOrder(tokens, rnd, 1));
        opts.add(wrongOrder(tokens, rnd, 2));
        opts.add(wrongOrder(tokens, rnd, 3));
        dedupKeepFirst(opts);
        while (opts.size() < 4) {
            opts.add(correct + ".");
        }
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(correct);
        String title = I18n.pick(lang, "Satzbau", "Word order", "Satzbau");
        return item("w", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "ORDER_MC", ci, null, p.text(), null);
    }

    private static SessionDetailResponse.ExerciseItem meaningMc(
            String lang, int week, int session, int idx, SourceVocab target, List<SourceVocab> pool, Random rnd,
            Set<String> used, int diff, int min
    ) {
        if (target.meaning().isBlank()) return null;
        String q = I18n.pick(lang,
                "Chọn cụm tiếng Đức khớp nghĩa:\n“" + target.meaning() + "”",
                "Pick the German that matches:\n“" + target.meaning() + "”",
                "Wähle das passende Deutsch zu:\n„" + target.meaning() + "“");
        if (!register(used, q)) return null;
        List<String> opts = new ArrayList<>();
        opts.add(target.german());
        List<SourceVocab> others = new ArrayList<>(pool);
        Collections.shuffle(others, rnd);
        for (SourceVocab o : others) {
            if (opts.size() >= 4) break;
            if (!o.german().equalsIgnoreCase(target.german())) {
                opts.add(o.german());
            }
        }
        while (opts.size() < 4) {
            opts.add("der Tisch");
        }
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(target.german());
        String title = I18n.pick(lang, "Zuordnung", "Matching", "Zuordnung");
        return item("w", week, session, idx, title, "VOCABULARY", diff, min, q, opts, "MC", ci, null, target.exampleDe(), null);
    }

    private static SessionDetailResponse.ExerciseItem trueFalseMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        boolean statementTrue = rnd.nextBoolean();
        String stmt = statementTrue
                ? p.text()
                : flipArticleOrWord(p.text(), rnd);
        String q = I18n.pick(lang,
                "Richtig oder falsch?\n" + stmt,
                "True or false?\n" + stmt,
                "Richtig oder falsch?\n" + stmt);
        if (!register(used, q)) return null;
        List<String> opts = List.of(
                I18n.pick(lang, "Đúng", "True", "Richtig"),
                I18n.pick(lang, "Sai", "False", "Falsch")
        );
        int ci = statementTrue ? 0 : 1;
        String title = I18n.pick(lang, "Richtig/Falsch", "True / False", "Richtig/Falsch");
        return item("w", week, session, idx, title, "GRAMMAR", diff, min, q, opts, "TRUE_FALSE", ci, null, p.text(), null);
    }

    private static SessionDetailResponse.ExerciseItem listenMc(
            String lang, int week, int session, int idx, SourcePhrase p, Random rnd, Set<String> used, int diff, int min
    ) {
        if (p.meaning().isBlank()) return null;
        String q = I18n.pick(lang,
                "Nghe (nút loa) rồi chọn nghĩa phù hợp nhất.",
                "Listen, then pick the best meaning.",
                "Hör zu, dann wähle die beste Bedeutung.");
        if (!register(used, q + p.text())) return null;
        List<String> meanings = new ArrayList<>();
        meanings.add(p.meaning());
        for (String d : List.of(
                "Etwas anderes passiert.",
                "Wir bestellen Kaffee.",
                "Der Zug hat Verspätung.",
                "Das Wetter ist schlecht.")) {
            if (meanings.size() >= 4) break;
            if (!d.equalsIgnoreCase(p.meaning())) {
                meanings.add(d);
            }
        }
        Collections.shuffle(meanings, rnd);
        int ci = meanings.indexOf(p.meaning());
        String title = I18n.pick(lang, "Hörverstehen", "Listening", "Hörverstehen");
        return item("w", week, session, idx, title, "LISTENING", diff, min, q, meanings, "MC", ci, null, p.text(), null);
    }

    private static SessionDetailResponse.ExerciseItem speakRepeat(
            String lang, int week, int session, int idx, SourcePhrase p, Set<String> used, int diff, int min
    ) {
        if (p.text().length() > 72) return null;
        String norm = normalizeAnswer(p.text());
        String q = I18n.pick(lang,
                "Nghe (loa) và gõ lại câu tiếng Đức (chính tả gần đúng được chấp nhận).",
                "Listen and type the German sentence (minor typos allowed).",
                "Hör zu und tippe den deutschen Satz (kleine Tippfehler sind ok).");
        if (!register(used, q + norm)) return null;
        String title = I18n.pick(lang, "Nachsprechen (Schreiben)", "Shadowing (typing)", "Nachsprechen (schreiben)");
        List<String> opts = List.of(); // no MC options
        return item("w", week, session, idx, title, "SPEAKING", diff, min, q + "\n\n« " + p.text() + " »", opts, "SPEAK_REPEAT", null, norm, p.text(), null);
    }

    private static SessionDetailResponse.ExerciseItem interestMc(
            String lang, int week, int session, int idx, List<String> tags, Random rnd, Set<String> used, int diff, int min
    ) {
        if (tags == null || tags.isEmpty()) return null;
        String tag = tags.get(rnd.nextInt(tags.size()));
        String q = I18n.pick(lang,
                "Chọn câu phù hợp sở thích / chủ đề: " + tag,
                "Pick a phrase that fits your interest: " + tag,
                "Wähle eine passende Phrase zu: " + tag);
        if (!register(used, q)) return null;
        List<String> pool = interestPool(tag);
        String correct = pool.get(0);
        List<String> opts = new ArrayList<>(pool);
        Collections.shuffle(opts, rnd);
        int ci = opts.indexOf(correct);
        String title = I18n.pick(lang, "Wortschatz (Interessen)", "Vocabulary (interests)", "Wortschatz (Interessen)");
        return item("w", week, session, idx, title, "VOCABULARY", diff, min, q, opts, "MC", ci, null, correct, null);
    }

    private static List<String> interestPool(String tag) {
        String t = tag.toUpperCase(Locale.ROOT);
        List<String> base = new ArrayList<>(List.of(
                "Ich trainiere nach der Arbeit.",
                "Ich buche ein Ticket online.",
                "Ich kaufe im Supermarkt ein.",
                "Ich lese abends ein Buch."
        ));
        if (t.contains("TRAVEL")) {
            base = new ArrayList<>(List.of(
                    "Ich reise gern mit dem Zug.",
                    "Wo ist der Check-in-Schalter?",
                    "Ich hätte gern ein Zimmer mit Meerblick.",
                    "Der Flug hat Verspätung."
            ));
        } else if (t.contains("TECH") || t.contains("BUSINESS")) {
            base = new ArrayList<>(List.of(
                    "Wir deployen heute Abend.",
                    "Die API liefert JSON.",
                    "Der Server ist nicht erreichbar.",
                    "Ich schreibe eine kurze E-Mail."
            ));
        }
        return base;
    }

    private static SessionDetailResponse.ExerciseItem memoryMc(
            String lang, int week, int session, int idx, SourceVocab v, List<SourceVocab> pool, Random rnd,
            Set<String> used, int diff, int min
    ) {
        if (v.meaning().isBlank()) return null;
        String q = I18n.pick(lang,
                "Ghép nghĩa với từ (Memory): chọn bản dịch đúng cho “" + v.german() + "”",
                "Memory match: pick the correct meaning for “" + v.german() + "”",
                "Memory: Wähle die richtige Bedeutung zu „" + v.german() + "“");
        if (!register(used, q)) return null;
        return meaningMc(lang, week, session, idx + 700, v, pool, rnd, used, diff, min);
    }

    private static SessionDetailResponse.ExerciseItem item(
            String idPrefix,
            int week, int session, int idx, String title, String skill, int diff, int min,
            String question, List<String> options, String format, Integer correctIdx, String expectedNorm, String audio,
            String explanation
    ) {
        String id = idPrefix + week + "s" + session + "_" + idx;
        return new SessionDetailResponse.ExerciseItem(
                id, title, skill, diff, min, question, options, format, correctIdx, expectedNorm, audio, explanation
        );
    }

    private static List<SessionDetailResponse.ExerciseItem> fallbackBank(String lang, int week, int session, int diff, int min, int salt) {
        String q1 = I18n.pick(lang, "Chọn mạo từ đúng cho „Haus“.", "Pick the article for „Haus“.", "Artikel für „Haus“?");
        var ex1 = new SessionDetailResponse.ExerciseItem(
                "w" + week + "s" + session + "_fb" + salt,
                I18n.pick(lang, "Artikel", "Articles", "Artikel"),
                "GRAMMAR", diff, min, q1, List.of("das", "der", "die", "den"), "MC", 0, null, "das Haus", null
        );
        String q2 = I18n.pick(lang, "Chọn câu đúng (Verb zweite Stelle).", "Pick the correct V2 sentence.", "Richtiger V2-Satz?");
        var ex2 = new SessionDetailResponse.ExerciseItem(
                "w" + week + "s" + session + "_fb" + (salt + 1),
                I18n.pick(lang, "Satzbau", "Word order", "Satzbau"),
                "GRAMMAR", diff, min, q2,
                List.of("Heute arbeite ich zu Hause.", "Ich heute arbeite zu Hause.", "Heute ich arbeite zu Hause.", "Arbeite heute ich zu Hause."),
                "ORDER_MC", 0, null,
                "Heute arbeite ich zu Hause.",
                null
        );
        return List.of(ex1, ex2);
    }

    private static List<String> tokenize(String s) {
        return Arrays.stream(WS.split(s.trim())).filter(x -> !x.isEmpty()).collect(Collectors.toList());
    }

    private static List<String> shuffleCopy(List<String> tokens, Random rnd) {
        List<String> c = new ArrayList<>(tokens);
        Collections.shuffle(c, rnd);
        return c;
    }

    private static String wrongOrder(List<String> tokens, Random rnd, int variant) {
        List<String> c = new ArrayList<>(tokens);
        if (c.size() < 2) return String.join(" ", c);
        int i = rnd.nextInt(c.size() - 1);
        if (variant % 2 == 0) {
            Collections.swap(c, i, i + 1);
        } else {
            String first = c.remove(0);
            c.add(first);
        }
        return String.join(" ", c);
    }

    private static void dedupKeepFirst(List<String> opts) {
        Set<String> seen = new LinkedHashSet<>();
        opts.removeIf(x -> !seen.add(x.toLowerCase(Locale.ROOT)));
    }

    private static String shorten(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() <= max ? t : t.substring(0, max - 1) + "…";
    }

    private static String stripLeadingArticle(String german) {
        String[] parts = german.trim().split("\\s+", 2);
        if (parts.length < 2) return german.trim();
        String a = parts[0].toLowerCase(Locale.ROOT);
        if (List.of("der", "die", "das", "ein", "eine", "einen", "einem", "einer").contains(a)) {
            return parts[1];
        }
        return german.trim();
    }

    private static String leadingArticleToken(String german) {
        String[] parts = german.trim().split("\\s+", 2);
        if (parts.length < 2) return null;
        String a = parts[0].toLowerCase(Locale.ROOT);
        if (List.of("der", "die", "das", "ein", "eine", "einen", "einem", "einer").contains(a)) {
            return a;
        }
        return null;
    }

    private static String flipArticleOrWord(String sentence, Random rnd) {
        String s = sentence;
        if (s.toLowerCase(Locale.ROOT).startsWith("der ")) {
            return "die " + s.substring(4);
        }
        if (s.toLowerCase(Locale.ROOT).startsWith("die ")) {
            return "das " + s.substring(4);
        }
        if (s.toLowerCase(Locale.ROOT).startsWith("das ")) {
            return "der " + s.substring(4);
        }
        return s.endsWith(".") ? s.substring(0, s.length() - 1) + " nicht." : s + " nicht.";
    }

    public static String normalizeAnswer(String s) {
        if (s == null) return "";
        return WS.matcher(s.trim().toLowerCase(Locale.ROOT)).replaceAll(" ").replace("„", "\"").replace("“", "\"");
    }

    /** Normalizes a pipe-separated token sequence for {@code ORDER_DRAG} answers. */
    public static String normalizeOrderDragAnswer(String raw) {
        if (raw == null) {
            return "";
        }
        String s = String.valueOf(raw).trim();
        return Arrays.stream(s.split("\\|"))
                .map(TheoryBasedExerciseGenerator::normalizeAnswer)
                .filter(x -> !x.isBlank())
                .collect(Collectors.joining("|"));
    }

    public static boolean textMatches(String expectedNorm, String userInput) {
        if (expectedNorm == null || expectedNorm.isBlank()) return false;
        String u = normalizeAnswer(userInput);
        if (u.isEmpty()) return false;
        if (u.equals(expectedNorm)) return true;
        // allow minor typo: containment for short answers
        if (expectedNorm.length() <= 32 && u.length() >= expectedNorm.length() - 4 && expectedNorm.length() > 6) {
            return u.contains(expectedNorm) || expectedNorm.contains(u);
        }
        return false;
    }
}
