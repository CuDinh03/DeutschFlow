package com.deutschflow.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * One-off utility to enrich vocabulary classification using Goethe-based sources.
 *
 * Source data:
 * - A1 list (contains article for many nouns)
 * - B1 list (contains article and many verb paradigms)
 */
public class GoetheClassificationBackfill {
    private static final String A1_URL =
            "https://raw.githubusercontent.com/patsytau/anki_german_a1_vocab/main/Goethe%20Institute%20A1%20Wordlist.txt";
    private static final String B1_URL =
            "https://raw.githubusercontent.com/kennethsible/goethe-wortliste/main/sorted.txt";
    private static final String GERMAN_NOUNS_URL =
            "https://raw.githubusercontent.com/gambolputty/german-nouns/main/german_nouns/nouns.csv";

    public static void main(String[] args) throws Exception {
        String host = env("DB_HOST", "localhost");
        String port = env("DB_PORT", "5432");
        String db = env("DB_NAME", "deutschflow");
        String user = env("DB_USERNAME", "root");
        String pass = env("DB_PASSWORD", "Password.1");
        String url = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?stringtype=unspecified";

        Map<String, String> nounGenderByLemma = new HashMap<>();
        Set<String> verbLemmas = new HashSet<>();
        parseGoetheSource(fetch(A1_URL), nounGenderByLemma, verbLemmas);
        parseGoetheSource(fetch(B1_URL), nounGenderByLemma, verbLemmas);
        parseGermanNounsCsv(fetch(GERMAN_NOUNS_URL), nounGenderByLemma);

        try (Connection conn = DriverManager.getConnection(url, user, pass)) {
            conn.setAutoCommit(false);

            long tagId = resolveTagId(conn, "GOETHE_AUTO");
            if (tagId <= 0) {
                throw new IllegalStateException("Tag GOETHE_AUTO not found.");
            }

            int managedTotal = 0;
            int dtypeToVerb = 0;
            int dtypeToNoun = 0;
            int nounRowsInserted = 0;
            int nounRowsUpdated = 0;
            int verbRowsInserted = 0;
            int matchedVerb = 0;
            int matchedNounGender = 0;
            int dtypeToWord = 0;

            String managedSql = """
                    SELECT w.id, w.base_form, w.dtype
                    FROM words w
                    JOIN word_tags wt ON wt.word_id = w.id
                    WHERE wt.tag_id = ?
                    """;

            try (PreparedStatement ps = conn.prepareStatement(managedSql)) {
                ps.setLong(1, tagId);
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        managedTotal++;
                        long wordId = rs.getLong("id");
                        String baseForm = rs.getString("base_form");
                        String currentDtype = rs.getString("dtype");
                        String key = normalizeLemma(baseForm);

                        if (verbLemmas.contains(key)) {
                            matchedVerb++;
                            if (!"Verb".equals(currentDtype)) {
                                updateWordDtype(conn, wordId, "Verb");
                                dtypeToVerb++;
                            }
                            if (!verbRowExists(conn, wordId)) {
                                insertVerbRow(conn, wordId, baseForm);
                                verbRowsInserted++;
                            }
                            continue;
                        }

                        String gender = nounGenderByLemma.get(key);
                        if (gender != null) {
                            matchedNounGender++;
                            if (!"Noun".equals(currentDtype)) {
                                updateWordDtype(conn, wordId, "Noun");
                                dtypeToNoun++;
                            }
                            if (!nounRowExists(conn, wordId)) {
                                insertNounRow(conn, wordId, gender, baseForm);
                                nounRowsInserted++;
                            } else {
                                updateNounGender(conn, wordId, gender);
                                nounRowsUpdated++;
                            }
                        } else if ("Noun".equals(currentDtype)) {
                            if (looksVerbLemma(baseForm)) {
                                updateWordDtype(conn, wordId, "Verb");
                                dtypeToVerb++;
                                if (!verbRowExists(conn, wordId)) {
                                    insertVerbRow(conn, wordId, baseForm);
                                    verbRowsInserted++;
                                }
                            } else {
                                updateWordDtype(conn, wordId, "Word");
                                dtypeToWord++;
                            }
                        }
                    }
                }
            }

            conn.commit();

            try (Statement st = conn.createStatement()) {
                ResultSet stats = st.executeQuery(
                        "SELECT dtype, COUNT(*) c FROM words GROUP BY dtype ORDER BY c DESC");
                System.out.println("=== DTYPE AFTER BACKFILL ===");
                while (stats.next()) {
                    System.out.println(stats.getString(1) + ": " + stats.getInt(2));
                }

                ResultSet nounCoverage = st.executeQuery("""
                        SELECT
                          (SELECT COUNT(*) FROM words WHERE dtype='Noun') AS noun_words,
                          (SELECT COUNT(*) FROM nouns) AS noun_rows,
                          (SELECT COUNT(*) FROM words WHERE dtype='Verb') AS verb_words,
                          (SELECT COUNT(*) FROM verbs) AS verb_rows
                        """);
                nounCoverage.next();
                System.out.println("noun_words=" + nounCoverage.getInt("noun_words"));
                System.out.println("noun_rows=" + nounCoverage.getInt("noun_rows"));
                System.out.println("verb_words=" + nounCoverage.getInt("verb_words"));
                System.out.println("verb_rows=" + nounCoverage.getInt("verb_rows"));
            }

            System.out.println("=== BACKFILL SUMMARY ===");
            System.out.println("managed_total=" + managedTotal);
            System.out.println("matched_verb=" + matchedVerb);
            System.out.println("matched_noun_gender=" + matchedNounGender);
            System.out.println("dtype_to_verb=" + dtypeToVerb);
            System.out.println("dtype_to_noun=" + dtypeToNoun);
            System.out.println("dtype_to_word=" + dtypeToWord);
            System.out.println("verb_rows_inserted=" + verbRowsInserted);
            System.out.println("noun_rows_inserted=" + nounRowsInserted);
            System.out.println("noun_rows_updated=" + nounRowsUpdated);
        }
    }

    private static String fetch(String url) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .header("User-Agent", "DeutschFlow/1.0")
                .GET()
                .build();
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            throw new IllegalStateException("Failed to fetch " + url + " status " + res.statusCode());
        }
        return res.body();
    }

    private static void parseGoetheSource(String text,
                                          Map<String, String> nounGenderByLemma,
                                          Set<String> verbLemmas) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new java.io.ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)),
                StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String normalized = normalizeLine(line);
                if (normalized.isBlank()) continue;

                // Remove numeric id prefixes seen in A1 source.
                normalized = normalized.replaceFirst("^\\d+\\s+", "");

                // Nouns with explicit article prefix: der/die/das + lemma
                java.util.regex.Matcher nounPrefixMatcher = java.util.regex.Pattern
                        .compile("^(der|die|das)\\s+([\\p{L}ÄÖÜäöüß-]+)", java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(normalized);
                if (nounPrefixMatcher.find()) {
                    String article = nounPrefixMatcher.group(1).toLowerCase(Locale.ROOT);
                    String lemma = nounPrefixMatcher.group(2);
                    String gender = switch (article) {
                        case "der" -> "DER";
                        case "die" -> "DIE";
                        default -> "DAS";
                    };
                    String key = normalizeLemma(lemma);
                    if (!key.isBlank() && !key.endsWith("-")) {
                        nounGenderByLemma.putIfAbsent(key, gender);
                    }
                }

                // Nouns with article suffix: lemma, der|die|das
                java.util.regex.Matcher nounSuffixMatcher = java.util.regex.Pattern
                        .compile("^([\\p{L}ÄÖÜäöüß-]+)\\s*,\\s*(der|die|das)\\b", java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(normalized);
                if (nounSuffixMatcher.find()) {
                    String lemma = nounSuffixMatcher.group(1);
                    String article = nounSuffixMatcher.group(2).toLowerCase(Locale.ROOT);
                    String gender = switch (article) {
                        case "der" -> "DER";
                        case "die" -> "DIE";
                        default -> "DAS";
                    };
                    String key = normalizeLemma(lemma);
                    if (!key.isBlank() && !key.endsWith("-")) {
                        nounGenderByLemma.putIfAbsent(key, gender);
                    }
                }

                // Verb pattern in B1 source: lemma, ... hat/ist ...
                java.util.regex.Matcher verbMatcher = java.util.regex.Pattern
                        .compile("^([\\p{L}ÄÖÜäöüß-]+),\\s+[^,]+,\\s+[^,]+,\\s+(hat|ist)\\b",
                                java.util.regex.Pattern.CASE_INSENSITIVE)
                        .matcher(normalized);
                if (verbMatcher.find()) {
                    String key = normalizeLemma(verbMatcher.group(1));
                    if (!key.isBlank() && !key.endsWith("-")) {
                        verbLemmas.add(key);
                    }
                }
            }
        } catch (Exception ignore) {
            // Keep utility resilient; partial parsing is acceptable.
        }
    }

    private static void parseGermanNounsCsv(String csv, Map<String, String> nounGenderByLemma) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new java.io.ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)),
                StandardCharsets.UTF_8))) {
            String line;
            boolean header = true;
            while ((line = reader.readLine()) != null) {
                if (header) {
                    header = false;
                    continue;
                }
                java.util.List<String> cols = parseCsvLine(line);
                if (cols.size() < 4) continue;
                String lemma = cols.get(0);
                if (lemma == null || lemma.isBlank() || lemma.startsWith("-")) continue;

                // genus columns: genus, genus1..4
                String g = firstNonBlank(
                        cols.size() > 2 ? cols.get(2) : null,
                        cols.size() > 3 ? cols.get(3) : null,
                        cols.size() > 4 ? cols.get(4) : null,
                        cols.size() > 5 ? cols.get(5) : null,
                        cols.size() > 6 ? cols.get(6) : null
                );
                String gender = mapGenusToGender(g);
                if (gender == null) continue;
                String key = normalizeLemma(lemma);
                if (!key.isBlank() && !key.endsWith("-")) {
                    nounGenderByLemma.putIfAbsent(key, gender);
                }
            }
        } catch (Exception ignore) {
            // Keep utility resilient; partial parsing is acceptable.
        }
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String mapGenusToGender(String genus) {
        if (genus == null) return null;
        String g = genus.trim().toLowerCase(Locale.ROOT);
        if (g.contains("m")) return "DER";
        if (g.contains("f")) return "DIE";
        if (g.contains("n")) return "DAS";
        return null;
    }

    private static java.util.List<String> parseCsvLine(String line) {
        java.util.ArrayList<String> out = new java.util.ArrayList<>();
        if (line == null) return out;
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (c == ',' && !inQuotes) {
                out.add(cur.toString());
                cur.setLength(0);
                continue;
            }
            cur.append(c);
        }
        out.add(cur.toString());
        return out;
    }

    private static long resolveTagId(Connection conn, String tagName) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("SELECT id FROM tags WHERE name = ? LIMIT 1")) {
            ps.setString(1, tagName);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : -1;
            }
        }
    }

    private static void updateWordDtype(Connection conn, long wordId, String dtype) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("UPDATE words SET dtype = ?, updated_at = NOW() WHERE id = ?")) {
            ps.setString(1, dtype);
            ps.setLong(2, wordId);
            ps.executeUpdate();
        }
    }

    private static boolean nounRowExists(Connection conn, long wordId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM nouns WHERE id = ?")) {
            ps.setLong(1, wordId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1) > 0;
            }
        }
    }

    private static boolean verbRowExists(Connection conn, long wordId) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("SELECT COUNT(*) FROM verbs WHERE id = ?")) {
            ps.setLong(1, wordId);
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getInt(1) > 0;
            }
        }
    }

    private static void insertNounRow(Connection conn, long wordId, String gender, String baseForm) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("""
                INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type)
                VALUES (?, ?, ?, ?, 'STARK')
                """)) {
            ps.setLong(1, wordId);
            ps.setString(2, gender);
            ps.setString(3, baseForm);
            ps.setString(4, baseForm);
            ps.executeUpdate();
        }
    }

    private static void updateNounGender(Connection conn, long wordId, String gender) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("UPDATE nouns SET gender = ? WHERE id = ?")) {
            ps.setString(1, gender);
            ps.setLong(2, wordId);
            ps.executeUpdate();
        }
    }

    private static void insertVerbRow(Connection conn, long wordId, String baseForm) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement("""
                INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, prefix, is_irregular)
                VALUES (?, 'HABEN', ?, FALSE, NULL, FALSE)
                """)) {
            ps.setLong(1, wordId);
            ps.setString(2, baseForm);
            ps.executeUpdate();
        }
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

    private static boolean looksVerbLemma(String token) {
        String s = normalizeLemma(token);
        return s.endsWith("en") || s.endsWith("eln") || s.endsWith("ern") || s.endsWith("ieren");
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) return fallback;
        return value;
    }
}

