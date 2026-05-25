package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;

/**
 * Structured answers when the candidate asks closing questions (onboarding, systems, growth).
 */
public final class InterviewClosingTemplates {

    private InterviewClosingTemplates() {}

    public static String answerGuide(SpeakingPersona persona, String position) {
        String pos = position == null || position.isBlank() ? "der Stelle" : position;
        String domain = switch (persona) {
            case LUKAS -> "Onboarding: Pairing mit Senior, Code-Review-Pflicht, interne Tech-Talks. Systeme: nennen Sie realistisch Git/Jira/CI — fragen Sie nach Stack der Firma. Entwicklung: Spezialisierung Backend/Architektur.";
            case EMMA -> "Onboarding: CRM-Einführung, Shadowing bei Kundenterminen. Systeme: CRM/ERP nennen. Entwicklung: Key-Account, Vertriebsleitung.";
            case KLAUS -> "Onboarding: Stationsplan, HACCP-Schulung, Probe-Schicht. Systeme: Küchenorganisation, kein Marketing-Sprech. Entwicklung: Chef de Partie, Küchenleitung.";
            case WEBER, SARAH, SCHNEIDER -> "Onboarding: strukturierte Einarbeitung mit Mentor, Hygiene-Schulungen, Beobachtung in Praxis/Labor. Systeme: konkret KIS/Labor-Workflow — fragen Sie nach Name des Systems. Entwicklung: Spezialisierung, Fortbildungen mit Zertifikat.";
            case MAX, OLIVER -> "Onboarding: Sicherheitsunterweisung, Maschinenfreigabe, Mentor in Schicht. Systeme: Wartungspläne, Störungsprotokolle. Entwicklung: Schichtleiter, Techniker.";
            case NIKLAS, NINA -> "Onboarding: Service-Training, Schichtplan, Reklamationsprozess. Systeme: Kasse/Reservierung — konkret benennen wenn bekannt. Entwicklung: Serviceleitung, Event.";
            case LENA, THOMAS, PETRA -> "Onboarding: Verkaufstraining, Hygiene, Kassenprozess. Entwicklung: Filialverantwortung, Fachverkauf.";
            case HANNIE -> "Onboarding: Probe-Moderation, Skript-Review. Entwicklung: feste Sendungen, Coaching.";
            default -> "Onboarding: feste Checkliste erste Woche, Buddy-System. Systeme: ehrlich benennen was Sie kennen. Entwicklung: Weiterbildung passend zu " + pos + ".";
        };
        return "Der Kandidat stellte Abschlussfragen. Beantworten Sie JEDE Frage einzeln, konkret (2–3 Sätze pro Punkt), ohne Floskeln wie 'state-of-the-art'. "
                + domain;
    }
}
