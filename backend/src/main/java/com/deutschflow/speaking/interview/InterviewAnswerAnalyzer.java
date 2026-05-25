package com.deutschflow.speaking.interview;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class InterviewAnswerAnalyzer {

    private static final Pattern HYPOTHETICAL = Pattern.compile(
            "\\b(würde|würden|wäre|könnte|könnten|sollte|sollten)\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PAST_CONCRETE = Pattern.compile(
            "\\b(habe|hatte|bin|war|haben|hatten|wurde|wurden|konnte|konnten)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern PROPER_OR_METRIC = Pattern.compile(
            "\\b([A-ZÄÖÜ][a-zäöüß]{2,}|\\d{1,4}|%|SOP|KIS|LIS|HACCP|CRM|CNC|API)\\b");
    private static final Pattern STAR_HINT = Pattern.compile(
            "\\b(situation|aufgabe|task|maßnahme|ergebnis|result|danach|anschließend)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    public InterviewAnswerAnalysis analyze(String userMessage, InterviewPhase phase, String experienceLevel) {
        if (userMessage == null || userMessage.isBlank()) {
            return new InterviewAnswerAnalysis(true, true, false, true, false, false, true);
        }
        String text = userMessage.trim();
        int words = text.split("\\s+").length;
        int bullets = countBullets(text);
        boolean hypotheticalHeavy = count(HYPOTHETICAL, text) >= 2 && count(PAST_CONCRETE, text) < 2;
        boolean hasConcreteMarker = PROPER_OR_METRIC.matcher(text).find() || count(PAST_CONCRETE, text) >= 2;
        boolean bulletListWithoutConcrete = bullets >= 3 && !hasConcreteMarker;
        boolean monologue = words > 120 || (text.split("[.!?]+").length > 6 && words > 80);
        boolean missingStar = phase == InterviewPhase.STAR_SOFT && !STAR_HINT.matcher(text).find() && !hasConcreteMarker;
        boolean roleScopeCreep = detectsDiagnosisWithoutCollaboration(text);
        boolean concreteExample = hasConcreteMarker && count(PAST_CONCRETE, text) >= 1;
        boolean weakAnswer = hypotheticalHeavy || bulletListWithoutConcrete || (missingStar && phase == InterviewPhase.STAR_SOFT);
        return new InterviewAnswerAnalysis(
                hypotheticalHeavy, bulletListWithoutConcrete, monologue, missingStar, roleScopeCreep,
                concreteExample, weakAnswer);
    }

    private static boolean detectsDiagnosisWithoutCollaboration(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        boolean claimsDiagnosis = lower.contains("diagnose stell") || lower.contains("diagnose erst")
                || lower.contains("genaue diagnose") && lower.contains("ich ");
        boolean collaborates = lower.contains("arzt") || lower.contains("ärzt") || lower.contains("zusammenarbeit");
        return claimsDiagnosis && !collaborates;
    }

    private static int countBullets(String text) {
        int n = 0;
        for (String line : text.split("\n")) {
            String t = line.trim();
            if (t.startsWith("*") || t.startsWith("-") || t.startsWith("•")) {
                n++;
            }
        }
        return n;
    }

    private static int count(Pattern p, String text) {
        int c = 0;
        var m = p.matcher(text);
        while (m.find()) {
            c++;
        }
        return c;
    }
}
