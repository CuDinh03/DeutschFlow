package com.deutschflow.interview.prompt;

import org.springframework.stereotype.Component;

/**
 * Layer 2 — Persona: interviewer personality, industry context, seniority, follow-up style.
 * Changes per session based on the selected persona.
 */
@Component
public class PersonaPromptLayer implements InterviewPromptLayer {

    @Override
    public String name() { return "persona"; }

    @Override
    public void appendTo(StringBuilder sb, InterviewPromptContext ctx) {
        sb.append("== ROLE ==\n");
        sb.append("Du bist ").append(ctx.personaDisplayName()).append(", ").append(ctx.personaRole()).append(".\n");
        sb.append("Branche: ").append(ctx.industry()).append(".\n");
        sb.append("Handle wie ein professioneller Interviewer. Kein Tutor-Ton, kein Smalltalk.\n");
        sb.append("Position geprüft: \"").append(ctx.position()).append("\". Prüfe die Eignung dafür konsequent.\n\n");

        sb.append("== EXPERIENCE STRATEGY ==\n");
        appendExperienceRules(sb, ctx.experienceLevel(), ctx.position(), ctx.personaCode());
        sb.append("\n");

        sb.append("== PERSONA / DOMAIN FOCUS ==\n");
        appendPersonaDomainFocus(sb, ctx.personaCode(), ctx.cefrLevel(), ctx.position(), ctx.industry());
        sb.append("\n\n");
    }

    private void appendExperienceRules(StringBuilder sb, String exp, String pos, String personaCode) {
        String expLabel = exp != null ? exp : "unbekannt";
        sb.append("Erfahrungslevel des Kandidaten: ").append(expLabel).append(".\n");
        switch (expLabel) {
            case "0-6M", "6-12M" -> sb.append(
                    "Erwartung: grundlegende Kenntnisse, Lernbereitschaft, echte (wenn auch begrenzte) Erfahrung. " +
                    "Stelle einfachere Follow-ups; bei vagen Antworten freundlich nachfragen statt aggressiv challengen.\n");
            case "1-2Y" -> sb.append(
                    "Erwartung: praktische Erfahrung in konkreten Projekten. " +
                    "Challengen Sie bei generischen Antworten; erwarten Sie 1-2 konkrete Beispiele pro Phase.\n");
            case "3Y", "5Y" -> sb.append(
                    "Erwartung: tiefe Fachkompetenz, Entscheidungsverantwortung, Führungserfahrung. " +
                    "Prüfen Sie Trade-offs, Architekturentscheidungen, Konfliktmanagement aggressiv. " +
                    "Oberflächliche Antworten MÜSSEN sofort challengen werden.\n");
            default -> sb.append("Erfahrungslevel unbekannt — Erwartungsniveau moderat setzen.\n");
        }
    }

    private void appendPersonaDomainFocus(StringBuilder sb, String code, String level, String pos, String industry) {
        if (code == null) {
            sb.append("Fokus: allgemeine Interviewfragen zur Position \"").append(pos).append("\".\n");
            return;
        }
        switch (code.toUpperCase()) {
            case "LUKAS" -> sb.append(
                    "Fokus (IT): Systemdesign, Code-Qualität, Architektur-Trade-offs, konkrete Projektbeispiele, " +
                    "Debugging-Vorgehen, Teamkollaboration in agilen Umgebungen. " +
                    "Technische Buzzwords ohne Kontext sofort challengen.\n");
            case "EMMA" -> sb.append(
                    "Fokus (Business): Verhandlungsführung, KPI-Tracking, Stakeholder-Management, " +
                    "Motivation und strategisches Denken. Soft Skills kritisch prüfen.\n");
            case "ANNA" -> sb.append(
                    "Fokus (Education): Unterrichtsmethodik, Umgang mit schwierigen Schülern, " +
                    "Lernzielplanung, Reflexionsfähigkeit und Motivation.\n");
            case "KLAUS" -> sb.append(
                    "Fokus (Gastronomy): Mise en place, HACCP, Teamführung unter Druck, " +
                    "Qualitätskontrolle, Rush-Hour-Management. Fachbegriffe der Gastronomie einsetzen.\n");
            case "WEBER", "SARAH", "SCHNEIDER" -> sb.append(
                    "Fokus (Healthcare): Patientenumgang, Hygiene/HACCP, Dokumentation, " +
                    "Notfallsituationen, Empathie und professionelle Distanz. Klare fachliche Grenzen setzen.\n");
            case "LENA", "THOMAS", "PETRA" -> sb.append(
                    "Fokus (Retail): Kundenkontakt, Beschwerdehandling, Tempo und Genauigkeit, " +
                    "Teamarbeit, Hygienestandards. Alltagsszenarien konkret abfragen.\n");
            case "MAX", "OLIVER" -> sb.append(
                    "Fokus (Operations): Maschinensicherheit, Wartungsroutinen, Störungsanalyse, " +
                    "Qualitätskontrolle, Schichtarbeit. Technische Präzision und Sicherheitsbewusstsein prüfen.\n");
            case "NIKLAS", "NINA" -> sb.append(
                    "Fokus (Service): Gastorientierung, Stresssituationen, Beschwerdemanagement, " +
                    "Reservierungen, professionelles Auftreten. Serviceszenarien real simulieren.\n");
            case "HANNIE" -> sb.append(
                    "Fokus (Media): Live-Druck, Improvisation, Publikumsführung, Bühnenroutine, " +
                    "Spontanität und Markenbewusstsein. Edge Cases und Ausnahmesituationen aktiv einbauen.\n");
            default -> sb.append("Fokus: ").append(industry).append(" — branchenspezifische Fachkompetenz und Soft Skills prüfen.\n");
        }
    }
}
