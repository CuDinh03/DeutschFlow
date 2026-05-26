package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;

import java.util.ArrayList;
import java.util.List;

/**
 * Curated interview questions per persona and shared phases.
 */
public final class InterviewQuestionBank {

    private InterviewQuestionBank() {}

    public static List<InterviewQuestionDef> forPersona(SpeakingPersona persona, String position) {
        String pos = position == null || position.isBlank() ? "diese Position" : position;
        List<InterviewQuestionDef> all = new ArrayList<>();
        all.addAll(commonQuestions(pos));
        all.addAll(switch (persona) {
            case LUKAS -> techQuestions(pos);
            case EMMA -> businessQuestions(pos);
            case ANNA -> educationQuestions(pos);
            case KLAUS -> gastroQuestions(pos);
            case WEBER -> dermatologyQuestions(pos);
            case SARAH -> medicalAssistantQuestions(pos);
            case SCHNEIDER -> ophthalmologyQuestions(pos);
            case LENA, THOMAS, PETRA -> retailFoodQuestions(persona, pos);
            case MAX, OLIVER -> operationsQuestions(persona, pos);
            case NIKLAS, NINA -> serviceQuestions(persona, pos);
            case HANNIE -> mediaQuestions(pos);
            default -> generalQuestions(pos);
        });
        return all;
    }

    private static List<InterviewQuestionDef> commonQuestions(String pos) {
        return List.of(
                q("ice_motivation", InterviewPhase.ICE_BREAKER, "motivation",
                        "Was hat Sie besonders an der Position " + pos + " interessiert?"),
                q("ice_typical_day", InterviewPhase.ICE_BREAKER, "routine",
                        "Beschreiben Sie einen typischen Arbeitstag in Ihrer letzten Stelle — konkret und chronologisch."),
                q("ice_found_role", InterviewPhase.ICE_BREAKER, "motivation",
                        "Wie sind Sie auf diese Stelle aufmerksam geworden, und was erwarten Sie vom Team?"),
                q("star_conflict", InterviewPhase.STAR_SOFT, "team",
                        "Nennen Sie einen Konflikt im Team: Situation, Ihre Aufgabe, Ihre Handlung und das Ergebnis."),
                q("star_stress", InterviewPhase.STAR_SOFT, "stress",
                        "Beschreiben Sie eine stressige Situation mit Zeitdruck — was genau haben Sie getan und was war das Ergebnis?"),
                q("star_mistake", InterviewPhase.STAR_SOFT, "fehler",
                        "Erzählen Sie von einem Fehler bei der Arbeit: wie entdeckt, wie behoben, was haben Sie daraus gelernt?"),
                q("close_ask", InterviewPhase.CLOSING, "closing",
                        "Haben Sie noch Fragen an uns?"),
                q("intro_self", InterviewPhase.INTRO, "intro",
                        "Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung für " + pos + ", und Ihr nächster Schritt.")
        );
    }

    private static List<InterviewQuestionDef> dermatologyQuestions(String pos) {
        return List.of(
                q("web_hygiene_case", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Nennen Sie einen konkreten Vorfall in der Klinik/Praxis, bei dem Hygiene oder Qualität gefährdet war — Ihre Maßnahmen und das Ergebnis."),
                q("web_sample_prep", InterviewPhase.HARD_SKILLS, "labor",
                        "Wie bereiten Sie Hautproben für mikrobiologische oder histologische Untersuchungen vor? Bitte mit einem echten Ablauf aus Ihrer Erfahrung."),
                q("web_patient_comm", InterviewPhase.HARD_SKILLS, "patient",
                        "Wie sprechen Sie mit einem Patienten, der sich wegen sichtbarer Hautveränderungen schämt? Ein konkretes Beispiel."),
                q("web_emergency", InterviewPhase.HARD_SKILLS, "notfall",
                        "Beschreiben Sie, wie Sie bei einer allergischen Reaktion im Labor/Praxis vorgegangen sind — Schritte und Eskalation."),
                q("web_anamnese", InterviewPhase.HARD_SKILLS, "anamnese",
                        "Wie führen Sie eine Hautanamnese strukturiert durch, bevor der Arzt die Untersuchung übernimmt?"),
                q("web_documentation", InterviewPhase.HARD_SKILLS, "doku",
                        "Welches KIS/LIS haben Sie genutzt, und wie vermeiden Sie Verwechslungen bei Proben und Befunden?")
        );
    }

    private static List<InterviewQuestionDef> ophthalmologyQuestions(String pos) {
        return List.of(
                q("oph_sehtest", InterviewPhase.HARD_SKILLS, "sehtest",
                        "Welche Sehtests führen Sie selbstständig durch, und wie dokumentieren Sie die Werte für " + pos + "?"),
                q("oph_contact_lens", InterviewPhase.HARD_SKILLS, "linsen",
                        "Beschreiben Sie die Anpassung oder Beratung zu Kontaktlinsen — ein konkreter Patientenfall."),
                q("oph_accuracy", InterviewPhase.HARD_SKILLS, "genauigkeit",
                        "Nennen Sie einen Fehler bei Messung oder Dokumentation und wie Sie ihn behoben haben."),
                q("oph_patient_calm", InterviewPhase.HARD_SKILLS, "patient",
                        "Wie beruhigen Sie einen ängstlichen Patienten vor einer Untersuchung? Konkretes Beispiel.")
        );
    }

    private static List<InterviewQuestionDef> medicalAssistantQuestions(String pos) {
        return List.of(
                q("ma_appointment", InterviewPhase.HARD_SKILLS, "termin",
                        "Wie organisieren Sie Termine und Patientenaufnahme unter Zeitdruck? Ein Beispiel aus der Praxis."),
                q("ma_hygiene", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Welche Hygienemaßnahmen sind für " + pos + " kritisch — und wann haben Sie sie verletzt gesehen und reagiert?"),
                q("ma_documentation", InterviewPhase.HARD_SKILLS, "doku",
                        "Wie dokumentieren Sie Befunde und Datenschutz im Alltag? Nennen Sie System und einen Ablauf.")
        );
    }

    private static List<InterviewQuestionDef> techQuestions(String pos) {
        return List.of(
                q("tech_project", InterviewPhase.HARD_SKILLS, "projekt",
                        "Welches technische Projekt für " + pos + " war Ihr wichtigster Beitrag — Architektur, Ihre Rolle, Trade-off?"),
                q("tech_debug", InterviewPhase.HARD_SKILLS, "debug",
                        "Beschreiben Sie einen schweren Produktionsfehler: Ursache, Debugging-Schritte, Fix und Prävention."),
                q("tech_api", InterviewPhase.HARD_SKILLS, "api",
                        "Wie haben Sie API-Design und Fehlerbehandlung in einem echten System umgesetzt?"),
                q("tech_test", InterviewPhase.HARD_SKILLS, "test",
                        "Welche Testing-Strategie nutzen Sie, und wo hat sie versagt — konkretes Beispiel.")
        );
    }

    private static List<InterviewQuestionDef> businessQuestions(String pos) {
        return List.of(
                q("biz_pipeline", InterviewPhase.HARD_SKILLS, "crm",
                        "Beschreiben Sie einen Deal oder Kunden, den Sie für " + pos + " gewonnen haben — KPI und Vorgehen."),
                q("biz_negotiation", InterviewPhase.HARD_SKILLS, "verhandlung",
                        "Nennen Sie eine schwierige Verhandlung mit messbarem Ergebnis."),
                q("biz_kpi", InterviewPhase.HARD_SKILLS, "kpi",
                        "Welche KPIs haben Sie verbessert, und welche Entscheidung hat das ausgelöst?")
        );
    }

    private static List<InterviewQuestionDef> educationQuestions(String pos) {
        return List.of(
                q("edu_planning", InterviewPhase.HARD_SKILLS, "planung",
                        "Wie planen Sie Lern- oder Studienziele für " + pos + " — konkretes Beispiel mit Zeitrahmen."),
                q("edu_conflict", InterviewPhase.HARD_SKILLS, "team",
                        "Wie moderieren Sie Konflikte in einer Gruppe? STAR-Beispiel.")
        );
    }

    private static List<InterviewQuestionDef> gastroQuestions(String pos) {
        return List.of(
                q("gas_haccp", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Nennen Sie einen HACCP-/Hygiene-Vorfall in der Küche und Ihre sofortigen Maßnahmen."),
                q("gas_rush", InterviewPhase.HARD_SKILLS, "stress",
                        "Wie organisieren Sie die Station in der Rush Hour für " + pos + "? Konkretes Beispiel."),
                q("gas_menu", InterviewPhase.HARD_SKILLS, "kalkulation",
                        "Beschreiben Sie Menüplanung oder Kalkulation, die Sie selbst durchgeführt haben.")
        );
    }

    private static List<InterviewQuestionDef> retailFoodQuestions(SpeakingPersona p, String pos) {
        return List.of(
                q(p.name().toLowerCase() + "_customer", InterviewPhase.HARD_SKILLS, "kunde",
                        "Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für " + pos + "."),
                q(p.name().toLowerCase() + "_hygiene", InterviewPhase.HARD_SKILLS, "hygiene",
                        "Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel."),
                q(p.name().toLowerCase() + "_team", InterviewPhase.HARD_SKILLS, "team",
                        "Beschreiben Sie Teamarbeit in Stoßzeiten und Ihre Verantwortung.")
        );
    }

    private static List<InterviewQuestionDef> operationsQuestions(SpeakingPersona p, String pos) {
        return List.of(
                q(p.name().toLowerCase() + "_safety", InterviewPhase.HARD_SKILLS, "sicherheit",
                        "Nennen Sie einen Sicherheitsvorfall oder Beinahe-Unfall und Ihre Maßnahmen für " + pos + "."),
                q(p.name().toLowerCase() + "_maintenance", InterviewPhase.HARD_SKILLS, "wartung",
                        "Wie führen Sie Wartung oder Störungssuche an einer Maschine durch — konkreter Ablauf."),
                q(p.name().toLowerCase() + "_quality", InterviewPhase.HARD_SKILLS, "qualitaet",
                        "Beschreiben Sie Qualitätskontrolle mit Toleranzen oder Messwerten aus Ihrer Erfahrung.")
        );
    }

    private static List<InterviewQuestionDef> serviceQuestions(SpeakingPersona p, String pos) {
        return List.of(
                q(p.name().toLowerCase() + "_guest", InterviewPhase.HARD_SKILLS, "gast",
                        "Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für " + pos + "."),
                q(p.name().toLowerCase() + "_rush", InterviewPhase.HARD_SKILLS, "tempo",
                        "Beschreiben Sie einen Abend mit hohem Gästeaufkommen — Priorisierung und Team."),
                q(p.name().toLowerCase() + "_cash", InterviewPhase.HARD_SKILLS, "kasse",
                        "Nennen Sie einen Fehler an Kasse/Reservierung und wie Sie ihn korrigiert haben.")
        );
    }

    private static List<InterviewQuestionDef> mediaQuestions(String pos) {
        return List.of(
                q("mc_live", InterviewPhase.HARD_SKILLS, "live",
                        "Beschreiben Sie eine Live-Situation oder Moderation für " + pos + " — was lief schief und wie reagierten Sie?"),
                q("mc_prep", InterviewPhase.HARD_SKILLS, "vorbereitung",
                        "Wie bereiten Sie Skript und Improvisation vor? Konkretes Event.")
        );
    }

    private static List<InterviewQuestionDef> generalQuestions(String pos) {
        return List.of(
                q("gen_responsibility", InterviewPhase.HARD_SKILLS, "verantwortung",
                        "Welche Verantwortung hatten Sie zuletzt für " + pos + " — messbares Ergebnis?"),
                q("gen_quality", InterviewPhase.HARD_SKILLS, "qualitaet",
                        "Wie sichern Sie Qualität im Alltag? Ein konkreter Ablauf, kein Theorieblock."),
                q("gen_team", InterviewPhase.HARD_SKILLS, "team",
                        "Wie arbeiten Sie mit anderen Rollen zusammen? Nennen Sie Namen/Rollen und einen Konflikt oder Erfolg.")
        );
    }

    private static InterviewQuestionDef q(String id, InterviewPhase phase, String topic, String questionDe) {
        return new InterviewQuestionDef(id, phase, topic, questionDe);
    }
}
