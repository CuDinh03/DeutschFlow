package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

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
        InterviewPhase phase = PhaseProgressionPolicy.resolve(state.getPhase(), userTurn, goalMet);
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
                .orElse(fallbackQuestion(phase, position));
        String questionId = question.map(InterviewQuestionDef::id).orElse("fallback_" + phase.name());
        String topicKey = question
                .map(InterviewQuestionDef::topicKey)
                .orElse(phase.name().toLowerCase(Locale.ROOT));

        // ── CLOSING phase overrides (checked in priority order) ───────────────
        if (phase == InterviewPhase.CLOSING && lastWasClosingAskOrAnswer) {
            // Second CLOSING turn: say farewell and end the interview
            directive = InterviewDirectiveType.CLOSING_FAREWELL;
            directiveInstruction = directiveText(InterviewDirectiveType.CLOSING_FAREWELL, analysis);
            mandatoryQuestion = buildFarewell(position);
            questionId = "close_farewell";
            topicKey = "farewell";
        } else if (userAskedClosingQuestions) {
            directive = InterviewDirectiveType.CLOSING_ANSWER;
            directiveInstruction = InterviewClosingTemplates.answerGuide(persona, position);
            mandatoryQuestion = "Beantworten Sie die Fragen des Kandidaten einzeln und konkret. Fragen Sie zum Schluss: 'Gibt es noch etwas?'";
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
                InterviewTurnPlan.DEFAULT_FORBIDDEN,
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

    private static String buildFarewell(String position) {
        String pos = (position == null || position.isBlank()) ? "diese Position" : position;
        return "Vielen Dank für das Gespräch und Ihr Interesse an " + pos
                + ". Wir werden uns in den nächsten Tagen bei Ihnen melden. Auf Wiedersehen!";
    }

    private static String fallbackQuestion(InterviewPhase phase, String position) {
        String pos = position == null || position.isBlank() ? "der Position" : position;
        return switch (phase) {
            case INTRO -> "Bitte stellen Sie sich kurz vor — relevant für " + pos + ".";
            case ICE_BREAKER -> "Was reizt Sie an " + pos + ", und wie sieht ein typischer Arbeitstag aus?";
            case HARD_SKILLS -> "Nennen Sie eine konkrete Arbeitssituation, die zeigt, dass Sie für " + pos + " geeignet sind.";
            case STAR_SOFT -> "Beschreiben Sie ein Teamproblem und wie Sie es gelöst haben — mit Ergebnis.";
            case CLOSING -> "Haben Sie noch Fragen an uns?";
        };
    }

    private static boolean looksLikeCandidateQuestions(String userMessage) {
        String lower = userMessage.toLowerCase(Locale.ROOT);
        return lower.contains("frage") || lower.contains("würde gerne wissen")
                || lower.contains("interessiert") || lower.contains("wie ist")
                || lower.contains("gibt es") || lower.contains("welche");
    }
}
