package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Component
public class InterviewOrchestrator {

    private final InterviewAnswerAnalyzer analyzer;
    private final PersonaInterviewRegistry registry;
    @Nullable
    private final InterviewQuestionGenerator questionGenerator;

    /** Test constructor — no Groq question generation available. */
    public InterviewOrchestrator(InterviewAnswerAnalyzer analyzer, PersonaInterviewRegistry registry) {
        this(analyzer, registry, null);
    }

    @Autowired
    public InterviewOrchestrator(InterviewAnswerAnalyzer analyzer, PersonaInterviewRegistry registry,
                                  @Nullable InterviewQuestionGenerator questionGenerator) {
        this.analyzer = analyzer;
        this.registry = registry;
        this.questionGenerator = questionGenerator;
    }

    public InterviewSessionState ensureState(InterviewSessionState state, SpeakingPersona persona, String position) {
        if (state != null) {
            return state;
        }
        // Deterministic seed derived from persona+position so a session is reproducible
        // for debugging/tests (was System.nanoTime(), which made replays impossible).
        int seed = Math.floorMod(java.util.Objects.hash(persona, position), 1000);
        String focus = registry.topicFocusForSession(persona, position, seed);
        return InterviewSessionState.initial(seed, focus);
    }

    /**
     * Plans the next turn.
     *
     * @param cefrLevel    candidate's CEFR level, used when generating questions via Groq fallback
     * @param promptVariant experiment assignment ("control" | "variant_c")
     */
    public InterviewTurnPlan planTurn(
            InterviewSessionState state,
            SpeakingPersona persona,
            String position,
            String experienceLevel,
            int messageCount,
            String userMessage,
            String promptVariant,
            String cefrLevel) {

        int userTurn = messageCount / 2 + 1;
        // Content-aware phase: quality can advance a strong candidate early; the turn count is the
        // ceiling that forces a struggling one forward. goalMet uses the prior turn's LLM signal
        // (stored on state) with a conservative deterministic fallback.
        InterviewPhase currentPhase = PhaseProgressionPolicy.fromNumber(state.getPhase());
        boolean goalMet = state.isLastPhaseGoalMet()
                || PhaseProgressionPolicy.deterministicGoalMet(currentPhase, state);
        InterviewPhase phase = PhaseProgressionPolicy.resolve(state.getPhase(), userTurn, goalMet,
                state.getStarTurns());
        InterviewAnswerAnalysis analysis = analyzer.analyze(userMessage, phase, experienceLevel);

        boolean userAskedClosingQuestions = phase == InterviewPhase.CLOSING
                && userMessage != null
                && (userMessage.contains("?") || looksLikeCandidateQuestions(userMessage));

        // Detect farewell turn: any CLOSING turn after we already did CLOSING_ASK or CLOSING_ANSWER
        boolean lastWasClosingAskOrAnswer = state.getLastDirectiveType() != null
                && (state.getLastDirectiveType().equals("CLOSING_ASK")
                || state.getLastDirectiveType().equals("CLOSING_ANSWER"));

        InterviewDirectiveType directive = resolveDirective(phase, analysis, state, userAskedClosingQuestions);
        String directiveInstruction = directiveText(directive, analysis);
        // Đợt E2 (10/08): khen phải xứng với chất lượng — câu trả lời YẾU thì ack trung tính,
        // cấm cả cụm khen nhẹ ("guter Ansatz" cho "ich weiß nicht" là khen bịa).
        List<String> forbiddenPhrases = InterviewTurnPlan.DEFAULT_FORBIDDEN;
        if (analysis.weakAnswer()) {
            forbiddenPhrases = WEAK_ANSWER_FORBIDDEN;
            directiveInstruction = directiveInstruction
                    + " Die letzte Antwort war SCHWACH: KEIN Lob in der Bestätigung — neutral quittieren"
                    + " (z.B. 'Verstehe.') und konkret nachhaken.";
        }

        // Calibrate question difficulty to the candidate's chosen level (CEFR + experience).
        QuestionDifficulty targetDifficulty = LevelCalibrator.resolve(cefrLevel, experienceLevel);
        Optional<InterviewQuestionDef> question =
                registry.pickQuestion(persona, position, phase, targetDifficulty, state);

        // ── Groq fallback: bank exhausted ────────────────────────────────────
        boolean notClosingFixed = directive != InterviewDirectiveType.CLOSING_ASK
                && directive != InterviewDirectiveType.CLOSING_FAREWELL;
        if (question.isEmpty() && notClosingFixed && questionGenerator != null) {
            question = questionGenerator.generate(
                    persona, phase, position, cefrLevel,
                    state.getTopicsCovered(), state.getAskedQuestionIds());
        }

        // ── Variant C: adaptive follow-up ────────────────────────────────────
        boolean isVariantC = "variant_c".equalsIgnoreCase(promptVariant);
        if (isVariantC && analysis.weakAnswer()
                && directive != InterviewDirectiveType.CLOSING_ASK
                && directive != InterviewDirectiveType.CLOSING_ANSWER
                && !lastWasClosingAskOrAnswer) {
            String lastTopic = state.getTopicsCovered().isEmpty()
                    ? null
                    : state.getTopicsCovered().get(state.getTopicsCovered().size() - 1);
            Optional<InterviewQuestionDef> adaptiveQ = registry.pickChallengeFollowUp(
                    persona, phase, lastTopic, state.getAskedQuestionIds());
            if (adaptiveQ.isPresent()) {
                question = adaptiveQ;
                directive = InterviewDirectiveType.PROBE_SPECIFIC;
                directiveInstruction = directiveText(directive, analysis);
            }
        }

        String mandatoryQuestion = question
                .map(InterviewQuestionDef::questionDe)
                .orElse(fallbackQuestion(phase, position, userTurn));
        String questionId = question.map(InterviewQuestionDef::id).orElse("fallback_" + phase.name());
        String topicKey = question
                .map(InterviewQuestionDef::topicKey)
                .orElse(phase.name().toLowerCase(Locale.ROOT));

        // ── CLOSING phase overrides (checked in priority order) ───────────────
        // L4 (QA 10/08): câu hỏi của ứng viên PHẢI thắng farewell — "Wie geht es weiter?" từng bị lơ
        // vì nhánh farewell đứng trước. Và sau khi ĐÃ farewell thì lượt kế chào ngắn lại chứ không
        // quay về CLOSING_ASK ("chào rồi lại hỏi Haben Sie noch Fragen?").
        boolean alreadyFarewelled = "CLOSING_FAREWELL".equals(state.getLastDirectiveType());
        if (phase == InterviewPhase.CLOSING && userAskedClosingQuestions) {
            directive = InterviewDirectiveType.CLOSING_ANSWER;
            directiveInstruction = InterviewClosingTemplates.answerGuide(persona, position);
            mandatoryQuestion = "Beantworten Sie die Fragen des Kandidaten einzeln und konkret. Fragen Sie zum Schluss: 'Gibt es noch etwas?'";
            questionId = "close_answer";
            topicKey = "closing";
        } else if (phase == InterviewPhase.CLOSING && (lastWasClosingAskOrAnswer || alreadyFarewelled)) {
            directive = InterviewDirectiveType.CLOSING_FAREWELL;
            directiveInstruction = directiveText(InterviewDirectiveType.CLOSING_FAREWELL, analysis);
            mandatoryQuestion = alreadyFarewelled
                    ? "Vielen Dank, auf Wiedersehen!"
                    : buildFarewell(position);
            questionId = "close_farewell";
            topicKey = "farewell";
        } else if (phase == InterviewPhase.CLOSING) {
            mandatoryQuestion = "Haben Sie noch Fragen an uns?";
            directive = InterviewDirectiveType.CLOSING_ASK;
            directiveInstruction = directiveText(InterviewDirectiveType.CLOSING_ASK, analysis);
        }

        return new InterviewTurnPlan(
                userTurn,
                phase,
                directive,
                directiveInstruction,
                mandatoryQuestion,
                questionId,
                topicKey,
                15,
                forbiddenPhrases,
                userAskedClosingQuestions ? InterviewClosingTemplates.answerGuide(persona, position) : null,
                userAskedClosingQuestions
        );
    }

    /** Backward-compatible overload without cefrLevel — defaults to "control" and null CEFR. */
    public InterviewTurnPlan planTurn(
            InterviewSessionState state,
            SpeakingPersona persona,
            String position,
            String experienceLevel,
            int messageCount,
            String userMessage,
            String promptVariant) {
        return planTurn(state, persona, position, experienceLevel, messageCount, userMessage, promptVariant, null);
    }

    /** Backward-compatible overload without variant or cefrLevel. */
    public InterviewTurnPlan planTurn(
            InterviewSessionState state,
            SpeakingPersona persona,
            String position,
            String experienceLevel,
            int messageCount,
            String userMessage) {
        return planTurn(state, persona, position, experienceLevel, messageCount, userMessage, "control", null);
    }

    private InterviewDirectiveType resolveDirective(
            InterviewPhase phase,
            InterviewAnswerAnalysis analysis,
            InterviewSessionState state,
            boolean closingQuestions) {
        if (closingQuestions)                      return InterviewDirectiveType.CLOSING_ANSWER;
        if (phase == InterviewPhase.CLOSING)       return InterviewDirectiveType.CLOSING_ASK;
        if (analysis.roleScopeCreep())             return InterviewDirectiveType.ROLE_BOUNDARY;
        if (analysis.monologue())                  return InterviewDirectiveType.INTERRUPT_HOOK;
        if (analysis.hypotheticalHeavy() || analysis.bulletListWithoutConcrete())
                                                   return InterviewDirectiveType.CHALLENGE_EXAMPLE;
        if (phase == InterviewPhase.STAR_SOFT && analysis.missingStar())
                                                   return InterviewDirectiveType.STAR_PROMPT;
        if (phase == InterviewPhase.HARD_SKILLS
                && state.getChallengeCount() < Math.max(1, state.getUserTurn() / 2)
                && !analysis.concreteExample())    return InterviewDirectiveType.CHALLENGE_EXAMPLE;
        if (analysis.concreteExample() && phase == InterviewPhase.HARD_SKILLS)
                                                   return InterviewDirectiveType.DEEPEN;
        return InterviewDirectiveType.STANDARD;
    }

    private static String directiveText(InterviewDirectiveType type, InterviewAnswerAnalysis analysis) {
        return switch (type) {
            case CHALLENGE_EXAMPLE -> "Der Kandidat antwortete überwiegend hypothetisch oder allgemein. "
                    + "Fordern Sie EIN konkretes Beispiel aus der letzten Stelle (Situation, Handlung, Ergebnis). Kein Lob.";
            case PROBE_SPECIFIC -> "Fordern Sie Zahlen, Namen, Systeme oder einen zeitlichen Ablauf — keine Aufzählung ohne Kontext.";
            case INTERRUPT_HOOK -> "Unterbrechen Sie höflich den langen Monolog: 'Lassen Sie uns kurz einhaken…' "
                    + "und fragen Sie nur zu EINEM Detail nach.";
            case STAR_PROMPT -> "Bitten Sie um STAR: Situation, Task, Action, Result — ein echtes Ereignis.";
            case ROLE_BOUNDARY -> "Lenken Sie auf die MTA/Fachkraft-Rolle: Diagnose/Entscheidung durch Arzt/Leitung; "
                    + "was haben SIE konkret vorbereitet/dokumentiert/eskaliert?";
            case DEEPEN -> "Vertiefen Sie ein genanntes Detail mit einer kritischen Nachfrage (Trade-off oder Grenze).";
            case CLOSING_ASK -> "Fragen Sie: 'Haben Sie noch Fragen an uns?' Kurz, ohne Lob.";
            case CLOSING_ANSWER -> "Beantworten Sie jede Kandidatenfrage einzeln, sachlich, ohne Marketing-Floskeln.";
            case CLOSING_FAREWELL -> "Beenden Sie das Interview professionell: Danken Sie kurz für das Gespräch "
                    + "(1 Satz), nennen Sie den nächsten Schritt (z.B. 'Wir melden uns in den nächsten Tagen'), "
                    + "und verabschieden Sie sich persönlich. Maximal 3 Sätze, kein Lob, keine leeren Phrasen.";
            case FOLLOW_UP, STANDARD -> "Beziehen Sie sich auf ein konkretes Detail der Antwort, dann stellen Sie die Pflichtfrage.";
        };
    }

    /** E2: danh sách cấm mở rộng cho lượt sau câu trả lời yếu — chặn cả khen nhẹ. */
    private static final java.util.List<String> WEAK_ANSWER_FORBIDDEN;
    static {
        java.util.List<String> extended = new java.util.ArrayList<>(InterviewTurnPlan.DEFAULT_FORBIDDEN);
        extended.addAll(java.util.List.of(
                "gute idee", "guter ansatz", "gute lösung", "guter anfang", "guter schritt",
                "das ist gut", "klingt gut", "klingt solide", "super", "toll", "prima"));
        WEAK_ANSWER_FORBIDDEN = java.util.List.copyOf(extended);
    }

    private static String buildFarewell(String position) {
        String pos = (position == null || position.isBlank()) ? "diese Position" : position;
        return "Vielen Dank für das Gespräch und Ihr Interesse an " + pos
                + ". Wir werden uns in den nächsten Tagen bei Ihnen melden. Auf Wiedersehen!";
    }

    private static String fallbackQuestion(InterviewPhase phase, String position) {
        return fallbackQuestion(phase, position, 0);
    }

    /**
     * Đợt E1 (10/08): fallback INTRO không lặp lại "stellen Sie sich vor" (greeting vừa hỏi xong —
     * lượt 1 luôn rơi fallback vì bank INTRO chỉ có 1 câu); HARD_SKILLS xoay biến thể theo lượt
     * để phiên dài không nghe cùng một câu 3 lần (harness S3 lượt 7–9).
     */
    private static String fallbackQuestion(InterviewPhase phase, String position, int variantSeed) {
        String pos = position == null || position.isBlank() ? "der Position" : position;
        return switch (phase) {
            case INTRO -> "Danke für die Vorstellung. Was in Ihrem Werdegang bereitet Sie am besten auf " + pos + " vor?";
            case ICE_BREAKER -> "Was reizt Sie an " + pos + ", und wie sieht ein typischer Arbeitstag aus?";
            case HARD_SKILLS -> switch (Math.floorMod(variantSeed, 3)) {
                case 1 -> "Welche Aufgabe für " + pos + " fällt Ihnen am schwersten, und wie gehen Sie damit um? Ein Beispiel.";
                case 2 -> "Was war Ihr größter messbarer Erfolg in Ihrer letzten Stelle — und Ihr Anteil daran?";
                default -> "Nennen Sie eine konkrete Arbeitssituation, die zeigt, dass Sie für " + pos + " geeignet sind.";
            };
            case STAR_SOFT -> "Beschreiben Sie ein Teamproblem und wie Sie es gelöst haben — mit Ergebnis.";
            case CLOSING -> "Haben Sie noch Fragen an uns?";
        };
    }

    private static boolean looksLikeCandidateQuestions(String userMessage) {
        String lower = userMessage.toLowerCase(Locale.ROOT);
        // "Nein, ich habe keine Fragen" chứa substring "frage" — không phải câu hỏi (lộ ra khi
        // L4 đưa nhánh CLOSING_ANSWER lên trước farewell, 10/08).
        if (lower.contains("keine frage") || lower.contains("keine weiteren fragen")) {
            return false;
        }
        return lower.contains("frage") || lower.contains("würde gerne wissen")
                || lower.contains("interessiert") || lower.contains("wie ist")
                || lower.contains("gibt es") || lower.contains("welche");
    }
}
