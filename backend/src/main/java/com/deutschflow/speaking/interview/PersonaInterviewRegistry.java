package com.deutschflow.speaking.interview;

import com.deutschflow.interview.entity.InterviewQuestion;
import com.deutschflow.interview.repository.InterviewQuestionRepository;
import com.deutschflow.interview.service.PersonaRegistryService;
import com.deutschflow.speaking.persona.SpeakingPersona;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@Slf4j
public class PersonaInterviewRegistry {

    @Nullable
    private final InterviewQuestionRepository questionRepository;
    @Nullable
    private final PersonaRegistryService personaRegistryService;

    /** No-arg constructor — used in unit tests that construct this directly. */
    public PersonaInterviewRegistry() {
        this(null, null);
    }

    /** Question-bank-only constructor — used in unit tests of DB-backed question selection. */
    public PersonaInterviewRegistry(InterviewQuestionRepository questionRepository) {
        this(questionRepository, null);
    }

    /** Spring-managed constructor: DB-backed question selection and persona registry available. */
    @Autowired
    public PersonaInterviewRegistry(@Nullable InterviewQuestionRepository questionRepository,
                                    @Nullable PersonaRegistryService personaRegistryService) {
        this.questionRepository = questionRepository;
        this.personaRegistryService = personaRegistryService;
    }

    /**
     * Resolves the session topic-focus string. DB-first: reads {@code topic_pools_json} from the
     * persona registry; falls back to the in-memory {@link #topicPools} switch (transition release).
     * The fallback logs a warning when an interview-capable persona is missing DB pools, so the
     * switch can be safely removed once the warning stops appearing.
     */
    public String topicFocusForSession(SpeakingPersona persona, String position, int seed) {
        String personaCode = persona != null ? persona.name() : "DEFAULT";

        if (personaRegistryService != null) {
            Optional<List<List<String>>> dbPools = personaRegistryService.topicPoolsFor(personaCode);
            if (dbPools.isPresent()) {
                List<String> pools = dbPools.get().get(seed % dbPools.get().size());
                return String.join(" + ", pools);
            }
            if (personaRegistryService.isInterviewCapable(personaCode)) {
                log.warn("interview_persona '{}' has no topic_pools_json; using in-memory fallback "
                        + "(transition period — seed the DB before removing the switch)", personaCode);
            }
        }

        // In-memory fallback (kept for one release per R1 transition plan).
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
        // Backward-compatible overload — no level calibration (any difficulty).
        return pickQuestion(persona, position, phase, null, state);
    }

    /**
     * Pick the next question for a phase, calibrated to {@code target} difficulty when provided.
     * Queries the DB first; falls back to the hardcoded {@link InterviewQuestionBank}.
     *
     * <p>Difficulty calibration applies to DB-backed rows (which carry a {@code difficulty} column):
     * among un-asked rows, the one whose band is nearest {@code target} wins, so an A2 candidate
     * gets BEGINNER questions and a B2 candidate gets ADVANCED ones, widening gracefully when the
     * exact band is unavailable. When {@code target} is {@code null} the original "first un-asked"
     * behavior is preserved. The static bank (no difficulty metadata) is unaffected.
     */
    public Optional<InterviewQuestionDef> pickQuestion(
            SpeakingPersona persona,
            String position,
            InterviewPhase phase,
            QuestionDifficulty target,
            InterviewSessionState state) {
        List<String> asked = state.getAskedQuestionIds();

        // DB-backed path
        if (questionRepository != null) {
            List<InterviewQuestion> dbRows = questionRepository
                    .findByPersonaCodeAndPhaseAndActiveTrue(persona.name(), phase.name());
            if (!dbRows.isEmpty()) {
                Optional<InterviewQuestion> fresh = pickByDifficulty(dbRows, asked, target);
                if (fresh.isPresent()) {
                    return fresh.map(this::toQuestionDef);
                }
                // All DB questions exhausted — fall through to static bank
            }
        }

        // Hardcoded fallback (also used in test contexts)
        // Returns empty when all questions have been asked — caller should invoke generator
        return questions(persona, position).stream()
                .filter(q -> q.phase() == phase)
                .filter(q -> !asked.contains(q.id()))
                .findFirst();
    }

    /** Among un-asked rows, pick the one nearest the target band (or the first un-asked if no target). */
    private static Optional<InterviewQuestion> pickByDifficulty(
            List<InterviewQuestion> rows, List<String> asked, QuestionDifficulty target) {
        List<InterviewQuestion> unasked = rows.stream()
                .filter(q -> !asked.contains(q.getId()))
                .toList();
        if (unasked.isEmpty()) {
            return Optional.empty();
        }
        if (target == null) {
            return Optional.of(unasked.get(0));
        }
        return unasked.stream()
                .min(java.util.Comparator.comparingInt(q -> parseDifficulty(q.getDifficulty()).distanceTo(target)));
    }

    private static QuestionDifficulty parseDifficulty(String raw) {
        if (raw == null) {
            return QuestionDifficulty.INTERMEDIATE;
        }
        try {
            return QuestionDifficulty.valueOf(raw.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return QuestionDifficulty.INTERMEDIATE;
        }
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

    /**
     * In-memory topic pools. Source of truth for the {@code topic_pools_json} seed in
     * Flyway V187; kept as the fallback for one transition release. Remove this switch once
     * {@link #topicFocusForSession} no longer logs the "missing topic_pools_json" warning.
     * The {@code default} branch (with {@code position} interpolation) covers non-interview
     * personas (DEFAULT/TUAN/LAN/MINH) which are intentionally not stored in the DB.
     */
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
