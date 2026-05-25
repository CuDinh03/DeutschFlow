package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class PersonaInterviewRegistry {

    public String topicFocusForSession(SpeakingPersona persona, String position, int seed) {
        String[][] pools = topicPools(persona, position);
        String[] picked = pools[seed % pools.length];
        return String.join(" + ", picked);
    }

    public List<InterviewQuestionDef> questions(SpeakingPersona persona, String position) {
        return InterviewQuestionBank.forPersona(persona, position);
    }

    public Optional<InterviewQuestionDef> pickQuestion(
            SpeakingPersona persona,
            String position,
            InterviewPhase phase,
            InterviewSessionState state) {
        List<String> asked = state.getAskedQuestionIds();
        return questions(persona, position).stream()
                .filter(q -> q.phase() == phase)
                .filter(q -> !asked.contains(q.id()))
                .findFirst()
                .or(() -> questions(persona, position).stream()
                        .filter(q -> q.phase() == phase)
                        .findFirst());
    }

    private String[][] topicPools(SpeakingPersona persona, String position) {
        String pos = position == null || position.isBlank() ? "diese Position" : position;
        return switch (persona) {
            case KLAUS -> new String[][] {
                    {"Kochtechniken und Garstufen", "Mise en Place"},
                    {"HACCP und Allergenmanagement", "Rush-Hour-Organisation"},
                    {"Menükalkulation", "Brigade und Qualität"},
                    {"Saisonale Küche", "Food-Waste"},
            };
            case LUKAS -> new String[][] {
                    {"Systemdesign und Architektur", "API und Microservices"},
                    {"Testing und CI/CD", "Performance und Monitoring"},
                    {"Debugging Produktion", "Datenbank und Skalierung"},
                    {"Security", "Cloud und Migration"},
            };
            case EMMA -> new String[][] {
                    {"Akquise und Pitch", "CRM und Pipeline"},
                    {"Verhandlung und Abschluss", "KPI und Reporting"},
                    {"Stakeholder-Kommunikation", "Account Management"},
            };
            case HANNA -> new String[][] {
                    {"Zeitmanagement", "Studien- und Karriereplanung"},
                    {"Interkulturelle Kompetenz", "Teamdynamik"},
                    {"Stress und Work-Life-Balance", "Peer-Learning"},
            };
            case WEBER -> new String[][] {
                    {"Hautanamnese und Proben", "Hygiene und SOP im Labor"},
                    {"Patientenkommunikation Dermatologie", "Notfall und Allergie"},
                    {"Dokumentation KIS/LIS", "Unklare Diagnose und Befundweitergabe"},
            };
            case SARAH, SCHNEIDER -> new String[][] {
                    {"Patientenaufnahme und Termine", "Hygiene und Genauigkeit"},
                    {"Dokumentation und Datenschutz", "Kommunikation mit ängstlichen Patienten"},
            };
            case MAX, OLIVER -> new String[][] {
                    {"Maschinensicherheit", "Wartung und Störungssuche"},
                    {"Qualitätskontrolle", "Schichtarbeit und Zuverlässigkeit"},
            };
            case NIKLAS, NINA -> new String[][] {
                    {"Gast- und Beschwerdemanagement", "Tempo und Teamkoordination"},
                    {"Kasse/Reservierung", "Upselling und Servicequalität"},
            };
            case LENA, THOMAS, PETRA -> new String[][] {
                    {"Kundenberatung", "Hygiene und Warenpflege"},
                    {"Reklamation", "Inventar und Teamarbeit"},
            };
            case HANNIE -> new String[][] {
                    {"Live-Moderation", "Skript und Improvisation"},
                    {"Publikumsreaktion", "Professionelles Auftreten"},
            };
            default -> new String[][] {
                    {"Teamarbeit für " + pos, "Problemlösung und Verantwortung"},
                    {"Kommunikation", "Organisation und Weiterentwicklung"},
            };
        };
    }
}
