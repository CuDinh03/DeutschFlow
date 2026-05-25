package com.deutschflow.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Safe auto-clean for vocabulary dtype/gender integrity based on Goethe-oriented sources.
 *
 * Rules:
 * 1) Convert lowercase nouns / functional words from dtype=Noun -> dtype=Word.
 * 2) Backfill missing rows in verbs table for dtype=Verb.
 * 3) Promote safe adjective candidates from dtype=Word -> dtype=Adjective.
 */
public class GoetheSafeAutoCleaner {
    private static final String A1_URL =
            "https://raw.githubusercontent.com/patsytau/anki_german_a1_vocab/main/Goethe%20Institute%20A1%20Wordlist.txt";
    private static final String SORTED_URL =
            "https://raw.githubusercontent.com/kennethsible/goethe-wortliste/main/sorted.txt";
    private static final String A2_REPO_CONTENTS_URL =
            "https://api.github.com/repos/langfield/A2_Wortliste_Goethe/contents/A2_Wortliste_Goethe?ref=main";

    private static final Pattern NOUN_PREFIX = Pattern.compile("^(der|die|das)\\s+([\\p{L}ÄÖÜäöüß-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern NOUN_SUFFIX = Pattern.compile("^([\\p{L}ÄÖÜäöüß-]+)\\s*,\\s*(der|die|das)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern VERB_CONJUGATION = Pattern.compile("^([\\p{L}ÄÖÜäöüß-]+),\\s+[^,]+,\\s+[^,]+,\\s+(hat|ist)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern FIRST_TOKEN = Pattern.compile("^([\\p{L}ÄÖÜäöüß-]+)");

    private static final Set<String> FUNCTIONAL_WHITELIST = new HashSet<>(Arrays.asList(
            "und", "in", "von", "nicht", "es", "mit", "auf", "für", "auch", "an", "dass", "zu", "als", "wie",
            "so", "bei", "aber", "man", "noch", "nach", "oder", "all", "aus", "was", "nur", "dann", "wenn",
            "um", "ja", "kein", "über", "da", "vor", "durch", "weil", "denn", "wo", "nichts", "nun", "sondern",
            "heute", "ohne", "ob", "dabei", "seit", "erst", "dort", "vielleicht", "wer", "hier", "jetzt",
            "viel", "wenig", "mehr", "am", "im", "vom", "zum", "zur", "beim", "ins", "ans", "bis", "gegen",
            "zwischen", "unter", "hinter", "neben"
    ));

    private static final Set<String> ADJECTIVE_BASE_WHITELIST = Set.of(
            "alt", "neu", "groß", "klein", "gut", "schlecht", "richtig", "falsch", "wichtig", "möglich",
            "klar", "teuer", "billig", "frei", "offen", "geschlossen", "schnell", "langsam", "kalt", "warm",
            "heiß", "jung", "stark", "schwach", "nett", "freundlich", "ruhig", "laut", "einfach", "schwer"
    );

    public static void main(String[] args) {
        String host = env("DB_HOST", "localhost");
        String port = env("DB_PORT", "5432");
        String db = env("DB_NAME", "deutschflow");
        String user = env("DB_USERNAME", "root");
        String pass = env("DB_PASSWORD", "Password.1");
        String url = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?stringtype=unspecified";

        try {
            Lexicon lexicon = buildLexicon();
            try (Connection conn = DriverManager.getConnection(url, user, pass)) {
                conn.setAutoCommit(false);

                Map<String, Long> before = snapshot(conn);

                int nounToWord = reclassifyLowercaseNounsToWord(conn, lexicon);
                int nounRowsDeleted = deleteNounRowsForNonNouns(conn);

                int verbsBackfilled = backfillMissingVerbRows(conn);
                int adjectivePromoted = promoteSafeAdjectives(conn, lexicon);
                int adjectiveRowsInserted = backfillMissingAdjectiveRows(conn);

                Map<String, Long> after = snapshot(conn);
                conn.commit();

                System.out.println("=== GOETHE SAFE AUTO-CLEAN ===");
                System.out.println("sources: A1 official + Goethe sorted + A2 repo tokens");
                System.out.println();
                System.out.println("applied_changes:");
                System.out.println("  noun_to_word=" + nounToWord);
                System.out.println("  noun_rows_deleted=" + nounRowsDeleted);
                System.out.println("  verbs_backfilled=" + verbsBackfilled);
                System.out.println("  adjective_promoted=" + adjectivePromoted);
                System.out.println("  adjective_rows_inserted=" + adjectiveRowsInserted);
                System.out.println();
                System.out.println("before_snapshot:");
                printSnapshot(before);
                System.out.println("after_snapshot:");
                printSnapshot(after);
                System.out.println();
                System.out.println("lexicon_stats:");
                System.out.println("  goethe_noun_gender_lemmas=" + lexicon.nounGenderByLemma.size());
                System.out.println("  goethe_verb_lemmas=" + lexicon.verbLemmas.size());
                System.out.println("  goethe_adjective_candidates=" + lexicon.adjectiveCandidates.size());
                System.out.println("  goethe_functional_words=" + lexicon.functionalWords.size());
                System.out.println("=== DONE ===");
            }
        } catch (Exception e) {
            System.err.println("AUTO-CLEAN FAILED: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static Lexicon buildLexicon() throws Exception {
        String a1 = fetch(A1_URL);
        String sorted = fetch(SORTED_URL);
        String a2Contents = fetch(A2_REPO_CONTENTS_URL);

        Map<String, String> nounGenderByLemma = new HashMap<>();
        Set<String> verbLemmas = new HashSet<>();
        Set<String> adjectiveCandidates = new HashSet<>();
        Set<String> functionalWords = new HashSet<>(FUNCTIONAL_WHITELIST);

        parseGoetheLikeSource(a1, nounGenderByLemma, verbLemmas, adjectiveCandidates, functionalWords);
        parseGoetheLikeSource(sorted, nounGenderByLemma, verbLemmas, adjectiveCandidates, functionalWords);
        parseA2RepoTokenNames(a2Contents, adjectiveCandidates, functionalWords, verbLemmas, nounGenderByLemma);

        adjectiveCandidates.removeAll(verbLemmas);
        adjectiveCandidates.removeAll(functionalWords);
        adjectiveCandidates.removeAll(nounGenderByLemma.keySet());

        return new Lexicon(nounGenderByLemma, verbLemmas, adjectiveCandidates, functionalWords);
    }

    private static void parseGoetheLikeSource(
            String source,
            Map<String, String> nounGenderByLemma,
            Set<String> verbLemmas,
            Set<String> adjectiveCandidates,
            Set<String> functionalWords
    ) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new java.io.ByteArrayInputStream(source.getBytes(StandardCharsets.UTF_8)),
                StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String normalized = normalizeLine(line);
                if (normalized.isBlank()) continue;

                normalized = normalized.replaceFirst("^\\d+\\s+", "");
                normalized = normalized.replaceAll("\\[sound:[^\\]]+\\]", "").trim();

                Matcher np = NOUN_PREFIX.matcher(normalized);
                if (np.find()) {
                    String article = np.group(1).toLowerCase(Locale.ROOT);
                    String lemma = normalizeLemma(np.group(2));
                    String gender = article.equals("der") ? "DER" : article.equals("die") ? "DIE" : "DAS";
                    if (!lemma.isBlank()) nounGenderByLemma.putIfAbsent(lemma, gender);
                }

                Matcher ns = NOUN_SUFFIX.matcher(normalized);
                if (ns.find()) {
                    String lemma = normalizeLemma(ns.group(1));
                    String article = ns.group(2).toLowerCase(Locale.ROOT);
                    String gender = article.equals("der") ? "DER" : article.equals("die") ? "DIE" : "DAS";
                    if (!lemma.isBlank()) nounGenderByLemma.putIfAbsent(lemma, gender);
                }

                Matcher vm = VERB_CONJUGATION.matcher(normalized);
                if (vm.find()) {
                    String lemma = normalizeLemma(vm.group(1));
                    if (!lemma.isBlank()) verbLemmas.add(lemma);
                }

                String firstToken = extractFirstToken(normalized);
                if (firstToken == null) continue;
                String lemma = normalizeLemma(firstToken);
                if (lemma.isBlank() || lemma.endsWith("-")) continue;

                if (!nounGenderByLemma.containsKey(lemma) && !verbLemmas.contains(lemma)) {
                    if (isLikelyFunctional(lemma)) {
                        functionalWords.add(lemma);
                    } else if (isLikelyAdjective(lemma)) {
                        adjectiveCandidates.add(lemma);
                    }
                }
            }
        } catch (Exception ignored) {
            // keep best-effort parsing
        }
    }

    private static void parseA2RepoTokenNames(
            String jsonListing,
            Set<String> adjectiveCandidates,
            Set<String> functionalWords,
            Set<String> verbLemmas,
            Map<String, String> nounGenderByLemma
    ) {
        Matcher nameMatcher = Pattern.compile("\"name\"\\s*:\\s*\"([^\"]+)\"").matcher(jsonListing);
        while (nameMatcher.find()) {
            String rawName = nameMatcher.group(1);
            if (!rawName.endsWith(".md")) continue;
            String token = rawName.substring(0, rawName.length() - 3).replace('-', ' ');
            String lemma = normalizeLemma(token);
            if (lemma.isBlank()) continue;
            if (verbLemmas.contains(lemma) || nounGenderByLemma.containsKey(lemma)) continue;
            if (isLikelyFunctional(lemma)) {
                functionalWords.add(lemma);
            } else if (isLikelyAdjective(lemma)) {
                adjectiveCandidates.add(lemma);
            }
        }
    }

    private static int reclassifyLowercaseNounsToWord(Connection conn, Lexicon lexicon) throws Exception {
        int changes = 0;
        try (PreparedStatement ps = conn.prepareStatement("""
                SELECT id, base_form
                FROM words
                WHERE dtype = 'Noun'
                """);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long id = rs.getLong("id");
                String base = rs.getString("base_form");
                if (base == null || base.isBlank()) continue;
                String lemma = normalizeLemma(base);
                if (lemma.isBlank()) continue;

                boolean firstLower = isFirstLowercase(base);
                boolean looksFunctional = lexicon.functionalWords.contains(lemma);
                if (firstLower || looksFunctional) {
                    try (PreparedStatement up = conn.prepareStatement("UPDATE words SET dtype='Word', updated_at=NOW() WHERE id=?")) {
                        up.setLong(1, id);
                        changes += up.executeUpdate();
                    }
                }
            }
        }
        return changes;
    }

    private static int deleteNounRowsForNonNouns(Connection conn) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("""
                DELETE FROM nouns n
                USING words w
                WHERE w.id = n.id AND w.dtype <> 'Noun'
                """)) {
            return ps.executeUpdate();
        }
    }

    private static int backfillMissingVerbRows(Connection conn) throws Exception {
        int inserted = 0;
        try (PreparedStatement ps = conn.prepareStatement("""
                SELECT w.id, w.base_form
                FROM words w
                LEFT JOIN verbs v ON v.id = w.id
                WHERE w.dtype='Verb' AND v.id IS NULL
                """);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long id = rs.getLong("id");
                String base = rs.getString("base_form");
                String partizip2 = inferPartizip2(base);
                String aux = usesSeinAuxiliary(base) ? "SEIN" : "HABEN";
                try (PreparedStatement ins = conn.prepareStatement("""
                        INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, prefix, is_irregular)
                        VALUES (?, ?, ?, FALSE, NULL, FALSE)
                        """)) {
                    ins.setLong(1, id);
                    ins.setString(2, aux);
                    ins.setString(3, partizip2);
                    inserted += ins.executeUpdate();
                }
            }
        }
        return inserted;
    }

    private static int promoteSafeAdjectives(Connection conn, Lexicon lexicon) throws Exception {
        int promoted = 0;
        try (PreparedStatement ps = conn.prepareStatement("""
                SELECT id, base_form
                FROM words
                WHERE dtype='Word'
                """);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long id = rs.getLong("id");
                String base = rs.getString("base_form");
                if (base == null || base.isBlank()) continue;
                String lemma = normalizeLemma(base);
                if (lemma.isBlank()) continue;
                if (!isFirstLowercase(base)) continue;
                if (lexicon.functionalWords.contains(lemma)) continue;
                if (lexicon.verbLemmas.contains(lemma)) continue;
                if (lexicon.nounGenderByLemma.containsKey(lemma)) continue;

                boolean matchGoetheAdj = lexicon.adjectiveCandidates.contains(lemma);
                boolean suffixAdj = hasAdjectiveSuffix(lemma);
                boolean baseAdj = ADJECTIVE_BASE_WHITELIST.contains(lemma);

                if (matchGoetheAdj && (suffixAdj || baseAdj)) {
                    try (PreparedStatement up = conn.prepareStatement("UPDATE words SET dtype='Adjective', updated_at=NOW() WHERE id=?")) {
                        up.setLong(1, id);
                        promoted += up.executeUpdate();
                    }
                }
            }
        }
        return promoted;
    }

    private static int backfillMissingAdjectiveRows(Connection conn) throws Exception {
        int inserted = 0;
        try (PreparedStatement ps = conn.prepareStatement("""
                SELECT w.id
                FROM words w
                LEFT JOIN adjectives a ON a.id = w.id
                WHERE w.dtype='Adjective' AND a.id IS NULL
                """);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                long id = rs.getLong("id");
                try (PreparedStatement ins = conn.prepareStatement("""
                        INSERT INTO adjectives (id, comparative, superlative, is_irregular)
                        VALUES (?, NULL, NULL, FALSE)
                        """)) {
                    ins.setLong(1, id);
                    inserted += ins.executeUpdate();
                }
            }
        }
        return inserted;
    }

    private static Map<String, Long> snapshot(Connection conn) throws Exception {
        Map<String, Long> m = new LinkedHashMap<>();
        m.put("total_words", scalar(conn, "SELECT COUNT(*) FROM words"));
        m.put("dtype_noun", scalar(conn, "SELECT COUNT(*) FROM words WHERE dtype='Noun'"));
        m.put("dtype_verb", scalar(conn, "SELECT COUNT(*) FROM words WHERE dtype='Verb'"));
        m.put("dtype_adjective", scalar(conn, "SELECT COUNT(*) FROM words WHERE dtype='Adjective'"));
        m.put("dtype_word", scalar(conn, "SELECT COUNT(*) FROM words WHERE dtype='Word'"));
        m.put("noun_rows", scalar(conn, "SELECT COUNT(*) FROM nouns"));
        m.put("verb_rows", scalar(conn, "SELECT COUNT(*) FROM verbs"));
        m.put("adjective_rows", scalar(conn, "SELECT COUNT(*) FROM adjectives"));
        m.put("verb_words_missing_row", scalar(conn, """
                SELECT COUNT(*)
                FROM words w LEFT JOIN verbs v ON v.id=w.id
                WHERE w.dtype='Verb' AND v.id IS NULL
                """));
        m.put("adjective_words_missing_row", scalar(conn, """
                SELECT COUNT(*)
                FROM words w LEFT JOIN adjectives a ON a.id=w.id
                WHERE w.dtype='Adjective' AND a.id IS NULL
                """));
        return m;
    }

    private static void printSnapshot(Map<String, Long> snapshot) {
        for (Map.Entry<String, Long> e : snapshot.entrySet()) {
            System.out.println("  " + e.getKey() + "=" + e.getValue());
        }
    }

    private static long scalar(Connection conn, String sql) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 0L;
        }
    }

    private static String inferPartizip2(String base) {
        if (base == null || base.isBlank()) return "";
        String b = base.trim().toLowerCase(Locale.ROOT);
        if (b.startsWith("ge")) return b;
        if (b.endsWith("ieren")) return b.substring(0, b.length() - 2) + "t";
        if (b.endsWith("en")) return "ge" + b;
        return "ge" + b;
    }

    private static boolean usesSeinAuxiliary(String base) {
        String b = normalizeLemma(base);
        return Set.of("gehen", "kommen", "fahren", "laufen", "bleiben", "werden", "sein", "aufstehen", "einsteigen", "aussteigen")
                .contains(b);
    }

    private static boolean isFirstLowercase(String s) {
        if (s == null || s.isBlank()) return false;
        String first = s.trim().substring(0, 1);
        return first.equals(first.toLowerCase(Locale.ROOT)) && !first.equals(first.toUpperCase(Locale.ROOT));
    }

    private static String extractFirstToken(String line) {
        Matcher m = FIRST_TOKEN.matcher(line);
        return m.find() ? m.group(1) : null;
    }

    private static boolean isLikelyFunctional(String lemma) {
        return FUNCTIONAL_WHITELIST.contains(lemma) || lemma.length() <= 3;
    }

    private static boolean isLikelyAdjective(String lemma) {
        return hasAdjectiveSuffix(lemma) || ADJECTIVE_BASE_WHITELIST.contains(lemma);
    }

    private static boolean hasAdjectiveSuffix(String lemma) {
        return lemma.endsWith("ig")
                || lemma.endsWith("lich")
                || lemma.endsWith("isch")
                || lemma.endsWith("bar")
                || lemma.endsWith("los")
                || lemma.endsWith("sam")
                || lemma.endsWith("haft")
                || lemma.endsWith("end")
                || lemma.endsWith("frei")
                || lemma.endsWith("voll")
                || lemma.endsWith("arm")
                || lemma.endsWith("reich")
                || lemma.endsWith("iv")
                || lemma.endsWith("al")
                || lemma.endsWith("ell")
                || lemma.endsWith("ant")
                || lemma.endsWith("ent")
                || lemma.endsWith("ös");
    }

    private static String normalizeLine(String line) {
        if (line == null) return "";
        return Normalizer.normalize(line.trim(), Normalizer.Form.NFKC);
    }

    private static String normalizeLemma(String token) {
        if (token == null) return "";
        String s = token.trim().toLowerCase(Locale.ROOT);
        s = s.replaceAll("[^\\p{L}äöüß-]", "");
        return s;
    }

    private static String fetch(String url) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .header("User-Agent", "DeutschFlow/1.0")
                .GET()
                .build();
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IllegalStateException("Failed to fetch " + url + " status=" + res.statusCode());
        }
        return res.body();
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : v;
    }

    private record Lexicon(
            Map<String, String> nounGenderByLemma,
            Set<String> verbLemmas,
            Set<String> adjectiveCandidates,
            Set<String> functionalWords
    ) {}
}

