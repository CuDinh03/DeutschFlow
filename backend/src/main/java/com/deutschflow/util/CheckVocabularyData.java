package com.deutschflow.util;

import java.sql.*;

public class CheckVocabularyData {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/deutschflow?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC";
        String user = "root";
        String password = "Password.1";

        try (Connection conn = DriverManager.getConnection(url, user, password);
             Statement stmt = conn.createStatement()) {

            System.out.println("=== DEUTSCHFLOW VOCABULARY DATABASE ===\n");

            // Count statistics
            System.out.println("📊 STATISTICS:\n");
            ResultSet rs = stmt.executeQuery(
                "SELECT 'Total Words' as metric, COUNT(*) as count FROM words " +
                "UNION ALL SELECT 'Nouns (DER)', COUNT(*) FROM nouns WHERE gender = 'DER' " +
                "UNION ALL SELECT 'Nouns (DIE)', COUNT(*) FROM nouns WHERE gender = 'DIE' " +
                "UNION ALL SELECT 'Nouns (DAS)', COUNT(*) FROM nouns WHERE gender = 'DAS' " +
                "UNION ALL SELECT 'Verbs', COUNT(*) FROM verbs " +
                "UNION ALL SELECT 'Translations (VI)', COUNT(*) FROM word_translations WHERE locale = 'vi' " +
                "UNION ALL SELECT 'Translations (EN)', COUNT(*) FROM word_translations WHERE locale = 'en'"
            );
            
            while (rs.next()) {
                System.out.printf("  %-25s: %d\n", rs.getString("metric"), rs.getInt("count"));
            }

            // Sample nouns by gender
            System.out.println("\n📘 SAMPLE NOUNS (DER - Masculine):\n");
            rs = stmt.executeQuery(
                "SELECT w.base_form, n.plural_form, " +
                "(SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) as meaning_vi " +
                "FROM words w JOIN nouns n ON w.id = n.id WHERE n.gender = 'DER' LIMIT 5"
            );
            
            while (rs.next()) {
                System.out.printf("  der %-15s → %-15s (%s)\n",
                    rs.getString("base_form"),
                    rs.getString("plural_form"),
                    rs.getString("meaning_vi")
                );
            }

            System.out.println("\n📕 SAMPLE NOUNS (DIE - Feminine):\n");
            rs = stmt.executeQuery(
                "SELECT w.base_form, n.plural_form, " +
                "(SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) as meaning_vi " +
                "FROM words w JOIN nouns n ON w.id = n.id WHERE n.gender = 'DIE' LIMIT 5"
            );
            
            while (rs.next()) {
                System.out.printf("  die %-15s → %-15s (%s)\n",
                    rs.getString("base_form"),
                    rs.getString("plural_form"),
                    rs.getString("meaning_vi")
                );
            }

            System.out.println("\n📗 SAMPLE NOUNS (DAS - Neuter):\n");
            rs = stmt.executeQuery(
                "SELECT w.base_form, n.plural_form, " +
                "(SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) as meaning_vi " +
                "FROM words w JOIN nouns n ON w.id = n.id WHERE n.gender = 'DAS' LIMIT 5"
            );
            
            while (rs.next()) {
                System.out.printf("  das %-15s → %-15s (%s)\n",
                    rs.getString("base_form"),
                    rs.getString("plural_form"),
                    rs.getString("meaning_vi")
                );
            }

            // Sample verbs with conjugations
            System.out.println("\n🔵 SAMPLE VERBS:\n");
            rs = stmt.executeQuery(
                "SELECT w.base_form, v.partizip2, v.auxiliary_verb, " +
                "(SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) as meaning_vi, " +
                "(SELECT form FROM verb_conjugations WHERE verb_id = w.id AND tense = 'PRASENS' AND pronoun = 'ICH' LIMIT 1) as ich_form " +
                "FROM words w JOIN verbs v ON w.id = v.id LIMIT 8"
            );
            
            System.out.printf("  %-15s %-15s %-15s %s\n", "Infinitive", "ich-Form", "Partizip II", "Meaning");
            System.out.println("  " + "─".repeat(70));
            while (rs.next()) {
                System.out.printf("  %-15s %-15s %-15s %s\n",
                    rs.getString("base_form"),
                    rs.getString("ich_form"),
                    rs.getString("partizip2"),
                    rs.getString("meaning_vi")
                );
            }

            // Example with full translation
            System.out.println("\n💬 EXAMPLE WITH TRANSLATIONS:\n");
            rs = stmt.executeQuery(
                "SELECT w.base_form, n.gender, " +
                "(SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) as vi, " +
                "(SELECT meaning FROM word_translations WHERE word_id = w.id AND locale = 'en' LIMIT 1) as en, " +
                "(SELECT example FROM word_translations WHERE word_id = w.id AND locale = 'vi' LIMIT 1) as example " +
                "FROM words w JOIN nouns n ON w.id = n.id WHERE w.base_form = 'Tisch' LIMIT 1"
            );
            
            if (rs.next()) {
                System.out.println("  Word: " + rs.getString("gender") + " " + rs.getString("base_form"));
                System.out.println("  Vietnamese: " + rs.getString("vi"));
                System.out.println("  English: " + rs.getString("en"));
                System.out.println("  Example: " + rs.getString("example"));
            }

            System.out.println("\n✅ Vocabulary database check completed!");
            System.out.println("📚 Ready to use in DeutschFlow application\n");

        } catch (Exception e) {
            System.err.println("❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
