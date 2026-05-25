package com.deutschflow.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

public class VocabularyDataAudit {
    public static void main(String[] args) {
        String host = env("DB_HOST", "localhost");
        String port = env("DB_PORT", "5432");
        String db = env("DB_NAME", "deutschflow");
        String user = env("DB_USERNAME", "root");
        String pass = env("DB_PASSWORD", "Password.1");
        String url = "jdbc:postgresql://" + host + ":" + port + "/" + db + "?stringtype=unspecified";

        try (Connection conn = DriverManager.getConnection(url, user, pass);
             Statement stmt = conn.createStatement()) {
            System.out.println("=== DEUTSCHFLOW VOCAB AUDIT ===");
            System.out.println();

            printSection("1) OVERVIEW");
            printQuery(stmt, """
                    SELECT 'total_words' AS metric, COUNT(*) AS val FROM words
                    UNION ALL
                    SELECT CONCAT('dtype_', dtype), COUNT(*) FROM words GROUP BY dtype
                    """);

            printSection("2) CLASSIFICATION INTEGRITY");
            printQuery(stmt, """
                    SELECT 'noun_words_missing_noun_row' AS metric, COUNT(*) AS val
                    FROM words w LEFT JOIN nouns n ON n.id = w.id
                    WHERE w.dtype = 'Noun' AND n.id IS NULL
                    UNION ALL
                    SELECT 'noun_rows_wrong_dtype', COUNT(*)
                    FROM nouns n JOIN words w ON w.id = n.id
                    WHERE w.dtype <> 'Noun'
                    UNION ALL
                    SELECT 'verb_words_missing_verb_row', COUNT(*)
                    FROM words w LEFT JOIN verbs v ON v.id = w.id
                    WHERE w.dtype = 'Verb' AND v.id IS NULL
                    UNION ALL
                    SELECT 'verb_rows_wrong_dtype', COUNT(*)
                    FROM verbs v JOIN words w ON w.id = v.id
                    WHERE w.dtype <> 'Verb'
                    UNION ALL
                    SELECT 'adjective_words_missing_adjective_row', COUNT(*)
                    FROM words w LEFT JOIN adjectives a ON a.id = w.id
                    WHERE w.dtype = 'Adjective' AND a.id IS NULL
                    UNION ALL
                    SELECT 'adjective_rows_wrong_dtype', COUNT(*)
                    FROM adjectives a JOIN words w ON w.id = a.id
                    WHERE w.dtype <> 'Adjective'
                    """);

            printSection("3) GENDER COVERAGE (NOUNS)");
            printQuery(stmt, """
                    SELECT 'noun_rows_total' AS metric, COUNT(*) AS val FROM nouns
                    UNION ALL
                    SELECT 'noun_gender_DER', COUNT(*) FROM nouns WHERE gender = 'DER'
                    UNION ALL
                    SELECT 'noun_gender_DIE', COUNT(*) FROM nouns WHERE gender = 'DIE'
                    UNION ALL
                    SELECT 'noun_gender_DAS', COUNT(*) FROM nouns WHERE gender = 'DAS'
                    """);

            printSection("4) TRANSLATION COVERAGE");
            printQuery(stmt, """
                    SELECT 'words_with_de_meaning' AS metric, COUNT(DISTINCT w.id) AS val
                    FROM words w
                    JOIN word_translations wt ON wt.word_id = w.id
                    WHERE wt.locale = 'de' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                    UNION ALL
                    SELECT 'words_with_vi_meaning', COUNT(DISTINCT w.id)
                    FROM words w
                    JOIN word_translations wt ON wt.word_id = w.id
                    WHERE wt.locale = 'vi' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                    UNION ALL
                    SELECT 'words_with_en_meaning', COUNT(DISTINCT w.id)
                    FROM words w
                    JOIN word_translations wt ON wt.word_id = w.id
                    WHERE wt.locale = 'en' AND wt.meaning IS NOT NULL AND TRIM(wt.meaning) <> ''
                    """);

            printSection("5) GERMAN FORM HEURISTICS");
            printQuery(stmt, """
                    SELECT 'nouns_not_capitalized' AS metric, COUNT(*) AS val
                    FROM words w
                    WHERE w.dtype='Noun'
                      AND BINARY LEFT(w.base_form, 1) = BINARY LOWER(LEFT(w.base_form, 1))
                      AND BINARY LEFT(w.base_form, 1) <> BINARY UPPER(LEFT(w.base_form, 1))
                    UNION ALL
                    SELECT 'verbs_capitalized', COUNT(*)
                    FROM words w
                    WHERE w.dtype='Verb'
                      AND BINARY LEFT(w.base_form, 1) = BINARY UPPER(LEFT(w.base_form, 1))
                      AND BINARY LEFT(w.base_form, 1) <> BINARY LOWER(LEFT(w.base_form, 1))
                    UNION ALL
                    SELECT 'base_form_with_article_prefix', COUNT(*)
                    FROM words w
                    WHERE LOWER(w.base_form) REGEXP '^(der|die|das) '
                    UNION ALL
                    SELECT 'verb_not_infinitive_like', COUNT(*)
                    FROM words w
                    WHERE w.dtype='Verb'
                      AND LOWER(w.base_form) NOT REGEXP '(en|eln|ern|ieren)$'
                    UNION ALL
                    SELECT 'suspicious_chars_in_base_form', COUNT(*)
                    FROM words w
                    WHERE w.base_form REGEXP '[^[:alpha:]ÄÖÜäöüß -]'
                    """);

            printSection("6) DUPLICATES (same dtype + lemma)");
            try (ResultSet rs = stmt.executeQuery("""
                    SELECT dtype, base_form, COUNT(*) AS c
                    FROM words
                    GROUP BY dtype, base_form
                    HAVING COUNT(*) > 1
                    ORDER BY c DESC, dtype, base_form
                    LIMIT 20
                    """)) {
                int rows = 0;
                while (rs.next()) {
                    rows++;
                    System.out.printf("  - %-10s | %-30s | %d%n",
                            rs.getString("dtype"),
                            rs.getString("base_form"),
                            rs.getInt("c"));
                }
                if (rows == 0) {
                    System.out.println("  - none");
                }
            }

            printSection("7) SAMPLES TO REVIEW");
            printList(stmt, "nouns_not_capitalized_sample", """
                    SELECT w.id, w.dtype, w.base_form
                    FROM words w
                    WHERE w.dtype='Noun'
                      AND BINARY LEFT(w.base_form, 1) = BINARY LOWER(LEFT(w.base_form, 1))
                      AND BINARY LEFT(w.base_form, 1) <> BINARY UPPER(LEFT(w.base_form, 1))
                    ORDER BY w.id
                    LIMIT 15
                    """);
            printList(stmt, "verbs_capitalized_sample", """
                    SELECT w.id, w.dtype, w.base_form
                    FROM words w
                    WHERE w.dtype='Verb'
                      AND BINARY LEFT(w.base_form, 1) = BINARY UPPER(LEFT(w.base_form, 1))
                      AND BINARY LEFT(w.base_form, 1) <> BINARY LOWER(LEFT(w.base_form, 1))
                    ORDER BY w.id
                    LIMIT 15
                    """);
            printList(stmt, "verb_not_infinitive_like_sample", """
                    SELECT w.id, w.dtype, w.base_form
                    FROM words w
                    WHERE w.dtype='Verb'
                      AND LOWER(w.base_form) NOT REGEXP '(en|eln|ern|ieren)$'
                    ORDER BY w.id
                    LIMIT 15
                    """);
            printList(stmt, "base_form_with_article_prefix_sample", """
                    SELECT w.id, w.dtype, w.base_form
                    FROM words w
                    WHERE LOWER(w.base_form) REGEXP '^(der|die|das) '
                    ORDER BY w.id
                    LIMIT 15
                    """);

            printSection("8) NOUNS MISSING DE ARTICLE TRANSLATION CUE (OPTIONAL)");
            printQuery(stmt, """
                    SELECT 'nouns_without_de_translation' AS metric, COUNT(*) AS val
                    FROM words w
                    LEFT JOIN word_translations wt ON wt.word_id = w.id AND wt.locale='de'
                    WHERE w.dtype='Noun'
                      AND (wt.id IS NULL OR wt.meaning IS NULL OR TRIM(wt.meaning) = '')
                    """);

            System.out.println();
            System.out.println("=== AUDIT DONE ===");
        } catch (Exception e) {
            System.err.println("AUDIT FAILED: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void printSection(String title) {
        System.out.println();
        System.out.println(title);
    }

    private static void printQuery(Statement stmt, String sql) throws Exception {
        try (ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                System.out.printf("  - %-40s : %d%n",
                        rs.getString("metric"),
                        rs.getLong("val"));
            }
        }
    }

    private static void printList(Statement stmt, String title, String sql) throws Exception {
        System.out.println("  * " + title);
        try (ResultSet rs = stmt.executeQuery(sql)) {
            int rows = 0;
            while (rs.next()) {
                rows++;
                System.out.printf("    - #%d | %s | %s%n",
                        rs.getLong("id"),
                        rs.getString("dtype"),
                        rs.getString("base_form"));
            }
            if (rows == 0) {
                System.out.println("    - none");
            }
        }
    }

    @SuppressWarnings("unused")
    private static long scalar(Connection conn, String sql) throws Exception {
        try (PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            return rs.next() ? rs.getLong(1) : 0L;
        }
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) return fallback;
        return value;
    }
}

