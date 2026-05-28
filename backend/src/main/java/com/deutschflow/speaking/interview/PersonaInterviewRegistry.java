package com.deutschflow.speaking.interview;

import com.deutschflow.interview.entity.InterviewQuestion;
import com.deutschflow.interview.repository.InterviewQuestionRepository;
import com.deutschflow.speaking.persona.SpeakingPersona;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class PersonaInterviewRegistry {

    private final InterviewQuestionRepository questionRepository;

    /** No-arg constructor — used in unit tests that construct this directly. */
    public PersonaInterviewRegistry() {
        this.questionRepository = null;
    }

    /** Spring-managed constructor: DB-backed question selection is available. */
    @Autowired
    public PersonaInterviewRegistry(InterviewQuestionRepository questionRepository) {
        this.questionRepository = questionRepository;
    }

    public String topicFocusForSession(SpeakingPersona persona, String position, int seed) {
        String[][] pools = topicPools(persona, position);
        String[] picked = pools[seed % pools.length];
        return String.join(" + ", picked);
    }

    public List<InterviewQuestionDef> questions(SpeakingPersona persona, String position) {
        return InterviewQuestionBank.forPersona(persona, position);
    }

    /**
     * Pick the next question for a phase. Queries the DB first; falls back to the
     * hardcoded {@link InterviewQuestionBank} if the DB has no rows for this persona+phase.
     */
    public Optional<InterviewQuestionDef> pickQuestion(
            SpeakingPersona persona,
            String position,
            InterviewPhase phase,
            InterviewSessionState state) {
        List<String> asked = state.getAskedQuestionIds();

        // DB-backed path
        if (questionRepository != null) {
            List<InterviewQuestion> dbRows = questionRepository
                    .findByPersonaCodeAndPhaseAndActiveTrue(persona.name(), phase.name());
            if (!dbRows.isEmpty()) {
                return dbRows.stream()
                        .filter(q -> !asked.contains(q.getId()))
                        .findFirst()
                        .or(() -> Optional.of(dbRows.get(0)))
                        .map(this::toQuestionDef);
            }
        }

        // Hardcoded fallback (also used in test contexts)
        return questions(persona, position).stream()
                .filter(q -> q.phase() == phase)
                .filter(q -> !asked.contains(q.id()))
                .findFirst()
                .or(() -> questions(persona, position).stream()
                        .filter(q -> q.phase() == phase)
                        .findFirst());
    }

    /**
     * Variant C: pick a targeted challenge follow-up question for the current phase
     * and topic. Returns empty if the DB has no un-asked question for this combination.
     */
    public Optional<InterviewQuestionDef> pickChallengeFollowUp(
            SpeakingPersona persona,
            InterviewPhase phase,
            String lastTopicKey,
            List<String> askedIds) {
        if (questionRepository == null) return Optional.empty();
        // Prefer same topic if available, else any un-asked question for this phase
        List<InterviewQuestion> candidates = questionRepository
                .findByPersonaCodeAndPhaseAndActiveTrue(persona.name(), phase.name());
        return candidates.stream()
                .filter(q -> !askedIds.contains(q.getId()))
                .filter(q -> lastTopicKey != null && lastTopicKey.equals(q.getTopicKey()))
                .findFirst()
                .or(() -> candidates.stream()
                        .filter(q -> !askedIds.contains(q.getId()))
                        .findFirst())
                .map(this::toQuestionDef);
    }

    private InterviewQuestionDef toQuestionDef(InterviewQuestion q) {
        InterviewPhase phase;
        try {
            phase = InterviewPhase.valueOf(q.getPhase());
        } catch (IllegalArgumentException e) {
            phase = InterviewPhase.HARD_SKILLS;
        }
        return new InterviewQuestionDef(q.getId(), phase, q.getTopicKey(), q.getQuestionDe());
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
            case ANNA -> new String[][] {
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
