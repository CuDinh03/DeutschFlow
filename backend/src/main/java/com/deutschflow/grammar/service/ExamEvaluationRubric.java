package com.deutschflow.grammar.service;

import java.util.*;

/**
 * Goethe Start Deutsch 1 (A1) Official Evaluation Rubrics
 * Used for consistent scoring across all evaluations
 */
public class ExamEvaluationRubric {

    /**
     * SCHREIBEN (Teil 2) - Email Writing Rubric
     * Total: 15 points across 4 criteria
     */
    public static class SchreibenEmailRubric {
        // Aufgabenerfüllung (Task Completion) - 5 points
        public static final Map<Integer, String> AUFGABENERFUELLUNG = Map.ofEntries(
            Map.entry(5, "Behandelt alle 3 erforderlichen Punkte klar und vollständig"),
            Map.entry(4, "Behandelt alle 3 Punkte, aber teilweise etwas kurz"),
            Map.entry(3, "Behandelt alle 3 Punkte, aber mit Lücken"),
            Map.entry(2, "Behandelt 2 der 3 Punkte ausreichend"),
            Map.entry(1, "Behandelt nur 1 Punkt oder sehr oberflächlich"),
            Map.entry(0, "Keine oder sehr minimale Aufgabenerfüllung")
        );

        // Kohärenz (Coherence/Flow) - 4 points
        public static final Map<Integer, String> KOHAERENZ = Map.ofEntries(
            Map.entry(4, "Text ist logisch aufgebaut, leicht zu folgen, gute Satzverbindungen"),
            Map.entry(3, "Text ist gut strukturiert, meiste Satzverbindungen vorhanden"),
            Map.entry(2, "Text hat Struktur, aber wenige Übergänge zwischen Sätzen"),
            Map.entry(1, "Text ist schwer zu folgen, mangelnde Struktur"),
            Map.entry(0, "Text ist unverständlich oder desorganisiert")
        );

        // Wortschatz (Vocabulary) - 3 points
        public static final Map<Integer, String> WORTSCHATZ = Map.ofEntries(
            Map.entry(3, "Umfangreicher, A1-angemessener Wortschatz, kaum Wiederholungen"),
            Map.entry(2, "Guter Wortschatz für A1, einige Wiederholungen aber verständlich"),
            Map.entry(1, "Grundwortschatz vorhanden, viele Wiederholungen"),
            Map.entry(0, "Unzureichender oder falscher Wortschatz")
        );

        // Strukturen (Grammar/Structures) - 3 points
        public static final Map<Integer, String> STRUKTUREN = Map.ofEntries(
            Map.entry(3, "Durchweg richtige Grammatik und Satzstrukturen, kaum Fehler"),
            Map.entry(2, "Meiste Grammatik richtig, einige kleinere Fehler"),
            Map.entry(1, "Einige grammatikalische Fehler, aber Verständnis möglich"),
            Map.entry(0, "Viele Grammatikfehler, Text kaum verständlich")
        );

        public static int getTotalPoints() {
            return 5 + 4 + 3 + 3; // = 15
        }

        public static Map<String, Integer> getMaxPerCriteria() {
            return Map.of(
                "aufgabenerfuellung", 5,
                "kohaerenz", 4,
                "wortschatz", 3,
                "strukturen", 3
            );
        }
    }

    /**
     * SPRECHEN - Speaking Evaluation Rubric
     * Total: 25 points across 3 Teile
     */
    public static class SprechenRubric {

        // Teil 1: Selbstvorstellung (Self-Introduction) - 9 points
        public static final Map<Integer, String> TEIL1_AUSSPRACHE = Map.ofEntries(
            Map.entry(3, "Klare, verständliche Aussprache"),
            Map.entry(2, "Meist verständlich mit kleinen Ausspracheschwierigkeiten"),
            Map.entry(1, "Einige Aussprachefehler, aber meistens verstanden"),
            Map.entry(0, "Schwer verständlich")
        );

        public static final Map<Integer, String> TEIL1_WORTSCHATZ = Map.ofEntries(
            Map.entry(2, "Angemessener Wortschatz für A1"),
            Map.entry(1, "Grundwortschatz, einige Lücken"),
            Map.entry(0, "Unzureichender Wortschatz")
        );

        public static final Map<Integer, String> TEIL1_GRAMMATIK = Map.ofEntries(
            Map.entry(2, "Weitgehend korrekt"),
            Map.entry(1, "Einige Fehler, aber verstanden"),
            Map.entry(0, "Viele Fehler")
        );

        public static final Map<Integer, String> TEIL1_INHALT = Map.ofEntries(
            Map.entry(2, "Beantwortet alle geforderten Punkte vollständig"),
            Map.entry(1, "Beantwortet meiste Punkte"),
            Map.entry(0, "Lückenhafte oder fehlende Antworten")
        );

        // Teil 2: Q&A Alltag (Daily Life) - 8 points
        public static final Map<Integer, String> TEIL2_AUSSPRACHE = Map.ofEntries(
            Map.entry(2, "Klare, verständliche Aussprache"),
            Map.entry(1, "Einige Aussprachefehler"),
            Map.entry(0, "Schwer verständlich")
        );

        // Teil 3: Bitten/Reaktion (Request/Response) - 8 points
        public static final Map<Integer, String> TEIL3_KOMMUNIKATION = Map.ofEntries(
            Map.entry(2, "Antwortet angemessen auf Bitten"),
            Map.entry(1, "Versucht zu antworten, aber unvollständig"),
            Map.entry(0, "Unzureichende oder unangemessene Antwort")
        );

        public static int getTeilMaxPoints(int teil) {
            return switch (teil) {
                case 1 -> 9;  // 3+2+2+2
                case 2 -> 8;  // 2+2+2+2
                case 3 -> 8;  // 2+2+2+2
                default -> 0;
            };
        }

        public static int getTotalPoints() {
            return 9 + 8 + 8; // = 25
        }
    }

    /**
     * Grade scale interpretation for users
     */
    public enum GradeLevel {
        EXCELLENT("90-100", "Ausgezeichnet - Sehr gute Leistung"),
        GOOD("75-89", "Gut - Gute Leistung"),
        SATISFACTORY("60-74", "Befriedigend - Ausreichende Leistung"),
        INSUFFICIENT("0-59", "Unzureichend - Nicht bestanden");

        private final String range;
        private final String description;

        GradeLevel(String range, String description) {
            this.range = range;
            this.description = description;
        }

        public String getRange() {
            return range;
        }

        public String getDescription() {
            return description;
        }

        public static GradeLevel fromScore(int score) {
            return switch (score) {
                case 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100 -> EXCELLENT;
                case 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89 -> GOOD;
                case 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74 -> SATISFACTORY;
                default -> INSUFFICIENT;
            };
        }
    }

    /**
     * Minimum passing scores per section
     */
    public static final Map<String, Integer> PASS_THRESHOLD = Map.of(
        "LESEN", 15,        // 60% of 25
        "HOEREN", 15,       // 60% of 25
        "SCHREIBEN", 15,    // 60% of 25
        "SPRECHEN", 15      // 60% of 25
    );

    /**
     * Overall pass threshold
     */
    public static final int OVERALL_PASS_THRESHOLD = 60; // 60% of 100

    /**
     * Topic areas for weak area tagging (used for recommendations)
     */
    public static final List<String> VOCABULARY_TOPICS = List.of(
        "Begrüßung",      // Greetings
        "Familie",          // Family
        "Wohnung",          // Apartment/Housing
        "Berufe",           // Professions
        "Hobbys",           // Hobbies
        "Essen",            // Food
        "Einkaufen",        // Shopping
        "Freizeit",         // Leisure
        "Verkehr",          // Transportation
        "Gesundheit"        // Health
    );

    public static final List<String> GRAMMAR_TOPICS = List.of(
        "Nominativ",        // Nominative case
        "Akkusativ",        // Accusative case
        "Dativ",            // Dative case
        "Genitiv",          // Genitive case
        "Präsens",          // Present tense
        "Imperativ",        // Imperative
        "Verben",           // Verbs
        "Adjektive",        // Adjectives
        "Präpositionen",    // Prepositions
        "Satzstruktur"      // Sentence structure
    );

    /**
     * Get recommended topics to study based on weak areas
     */
    public static List<String> getRecommendedTopics(List<String> weakSections) {
        List<String> topics = new ArrayList<>();

        for (String section : weakSections) {
            if ("LESEN".equals(section) || "HOEREN".equals(section)) {
                topics.addAll(VOCABULARY_TOPICS);
            } else if ("SCHREIBEN".equals(section) || "SPRECHEN".equals(section)) {
                topics.addAll(GRAMMAR_TOPICS);
            }
        }

        return topics.stream().distinct().toList();
    }
}
