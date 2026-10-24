package com.deutschflow.speaking.interview;

import com.deutschflow.interview.entity.InterviewQuestion;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.repository.InterviewQuestionRepository;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
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
    @Nullable
    private final OccupationQuestionRepository occupationQuestionRepository;

    /** No-arg constructor — used in unit tests that construct this directly. */
    public PersonaInterviewRegistry() {
        this(null, null, null);
    }

    /** Question-bank-only constructor — used in unit tests of DB-backed question selection. */
    public PersonaInterviewRegistry(InterviewQuestionRepository questionRepository) {
        this(questionRepository, null, null);
    }

    public PersonaInterviewRegistry(@Nullable InterviewQuestionRepository questionRepository,
                                    @Nullable PersonaRegistryService personaRegistryService) {
        this(questionRepository, personaRegistryService, null);
    }

    /** Spring-managed constructor: DB-backed question selection, persona registry and occupation layer. */
    @Autowired
    public PersonaInterviewRegistry(@Nullable InterviewQuestionRepository questionRepository,
                                    @Nullable PersonaRegistryService personaRegistryService,
                                    @Nullable OccupationQuestionRepository occupationQuestionRepository) {
        this.questionRepository = questionRepository;
        this.personaRegistryService = personaRegistryService;
        this.occupationQuestionRepository = occupationQuestionRepository;
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
                List<List<String>> poolGroups = dbPools.get();
                List<String> picked = poolGroups.get(seed % poolGroups.size());
                return String.join(" + ", picked);
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

        // Đợt 2b: phiên theo nghề — lớp nghề đi trước trong HARD_SKILLS, hết thì rơi về lớp chung.
        if (phase == InterviewPhase.HARD_SKILLS && state.getOccupationCode() != null) {
            Optional<InterviewQuestionDef> occupational =
                    pickOccupationQuestion(state.getOccupationCode(), phase, target, asked, position);
            if (occupational.isPresent()) {
                return occupational;
            }
        }

        // DB-backed path
        if (questionRepository != null) {
            List<InterviewQuestion> dbRows = questionRepository
                    .findByPersonaCodeAndPhaseAndActiveTrue(persona.name(), phase.name());
            if (!dbRows.isEmpty()) {
                Optional<InterviewQuestion> fresh = pickByDifficulty(dbRows, asked, target);
                if (fresh.isPresent()) {
                    return fresh.map(q -> toQuestionDef(q, position));
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

    private static final List<OccupationContentStatus> USABLE_OCCUPATION_STATUSES =
            List.of(OccupationContentStatus.APPROVED, OccupationContentStatus.AI_GENERATED);

    /**
     * Câu lớp nghề chưa hỏi: câu "Đã duyệt" trước câu "AI tạo", rồi độ khó gần {@code target} nhất,
     * rồi theo thứ tự sinh. REJECTED không bao giờ được chọn.
     */
    Optional<InterviewQuestionDef> pickOccupationQuestion(
            String occupationCode, InterviewPhase phase, QuestionDifficulty target,
            List<String> asked, String position) {
        if (occupationQuestionRepository == null) {
            return Optional.empty();
        }
        java.util.Comparator<OccupationQuestion> order = java.util.Comparator.comparingInt(
                q -> q.getStatus() == OccupationContentStatus.APPROVED ? 0 : 1);
        if (target != null) {
            order = order.thenComparingInt(q -> parseDifficulty(q.getDifficulty()).distanceTo(target));
        }
        order = order.thenComparing(OccupationQuestion::getCreatedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                .thenComparing(OccupationQuestion::getId);
        return occupationQuestionRepository
                .findByOccupationCodeAndPhaseAndStatusIn(occupationCode, phase.name(), USABLE_OCCUPATION_STATUSES)
                .stream()
                .filter(q -> !asked.contains(q.getId()))
                .min(order)
                .map(q -> new InterviewQuestionDef(q.getId(), phase, q.getTopicKey(),
                        withPosition(q.getQuestionDe(), position)));
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
        return pickChallengeFollowUp(persona, null, phase, lastTopicKey, askedIds);
    }

    /** Như trên, kèm vị trí để thay cụm "für diese Position" trong câu lấy từ DB. */
    public Optional<InterviewQuestionDef> pickChallengeFollowUp(
            SpeakingPersona persona,
            String position,
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
                .map(q -> toQuestionDef(q, position));
    }

    /**
     * Câu seed trong DB (V187, V271) được render với vị trí mặc định nên chứa nguyên cụm
     * "für diese Position". Bank trong bộ nhớ thì ghép thẳng vị trí ("für Kellner/in"). Trước
     * 19/10/2026 nhánh DB trả nguyên văn, nên ứng viên Kellner/in nghe "für diese Position" trong
     * khi trang chủ hiện "für Kellner/in". Thay ở đây để hai nhánh nói cùng một câu.
     */
    static String withPosition(String questionDe, String position) {
        if (questionDe == null || position == null || position.isBlank()) {
            return questionDe;
        }
        return questionDe.replace(SEEDED_POSITION_PHRASE, "für " + position.trim());
    }

    private static final String SEEDED_POSITION_PHRASE = "für diese Position";

    private InterviewQuestionDef toQuestionDef(InterviewQuestion q, String position) {
        InterviewPhase phase;
        try {
            phase = InterviewPhase.valueOf(q.getPhase());
        } catch (IllegalArgumentException e) {
            phase = InterviewPhase.HARD_SKILLS;
        }
        return new InterviewQuestionDef(q.getId(), phase, q.getTopicKey(), withPosition(q.getQuestionDe(), position));
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
            // Người tuyển dụng theo nơi làm việc (đợt 2c) — seed DB ở V336.
            case HOFFMANN -> new String[][] {
                    {"Gästeorientierung", "Hygiene und HACCP"},
                    {"Stoßzeiten und Tempo", "Zusammenarbeit Küche und Service"},
                    {"Schicht- und Wochenendarbeit", "Beschwerden von Gästen"},
            };
            case KRUEGER -> new String[][] {
                    {"Umgang mit Patienten und Angehörigen", "Hygiene und Infektionsschutz"},
                    {"Dokumentation und Übergabe", "Notfälle und Prioritäten"},
                    {"Schichtdienst und Belastung", "Anerkennung und Weiterbildung"},
            };
            case BRANDT -> new String[][] {
                    {"Arbeitssicherheit und Schutzausrüstung", "Werkzeuge und Material"},
                    {"Pläne und Aufträge", "Qualität und Abnahme"},
                    {"Termindruck und Wetter", "Umgang mit Kunden"},
            };
            case WAGNER -> new String[][] {
                    {"Arbeitssicherheit", "Maschinen und Anlagen"},
                    {"Qualitätskontrolle", "Störungen und Fehlersuche"},
                    {"Schichtarbeit", "Technische Unterlagen"},
            };
            case YILMAZ -> new String[][] {
                    {"Sicherheit und Vorschriften", "Lager- und Lieferprozesse"},
                    {"Pünktlichkeit und Planung", "Fahrzeuge und Berechtigungen"},
                    {"Kontakt mit Kunden", "Schichtarbeit und Belastung"},
            };
            case SCHULZ -> new String[][] {
                    {"Kundenberatung", "Kasse und Genauigkeit"},
                    {"Reklamation", "Warenpflege und Inventur"},
                    {"Teamarbeit", "Stoßzeiten im Laden"},
            };
            case BECKER -> new String[][] {
                    {"Fachkenntnisse für die Position", "Arbeitsorganisation"},
                    {"Kommunikation mit Kunden und Kollegen", "Digitale Werkzeuge"},
                    {"Teamarbeit im Büro", "Lernbereitschaft und Weiterbildung"},
            };
            case RICHTER -> new String[][] {
                    {"Pädagogische Haltung", "Umgang mit Eltern"},
                    {"Kinderschutz", "Teamarbeit im Kollegium"},
                    {"Konflikte in der Gruppe", "Dokumentation und Beobachtung"},
            };
            default -> new String[][] {
                    {"Teamarbeit für " + pos, "Problemlösung und Verantwortung"},
                    {"Kommunikation", "Organisation und Weiterentwicklung"},
            };
        };
    }
}
