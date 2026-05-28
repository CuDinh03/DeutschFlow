package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;

@Component
public class InterviewOrchestrator {

    private final InterviewAnswerAnalyzer analyzer;
    private final PersonaInterviewRegistry registry;

    public InterviewOrchestrator(InterviewAnswerAnalyzer analyzer, PersonaInterviewRegistry registry) {
        this.analyzer = analyzer;
        this.registry = registry;
    }

    public InterviewSessionState ensureState(InterviewSessionState state, SpeakingPersona persona, String position) {
        if (state != null) {
            return state;
        }
        int seed = (int) (System.nanoTime() % 1000);
        String focus = registry.topicFocusForSession(persona, position, seed);
        return InterviewSessionState.initial(seed, focus);
    }

    /**
     * Plans the next turn. Pass {@code promptVariant} from the session's experiment
     * assignment so that Variant C adaptive follow-up can be applied.
     */
    public InterviewTurnPlan planTurn(
            InterviewSessionState state,
            SpeakingPersona persona,
            String position,
            String experienceLevel,
            int messageCount,
            String userMessage,
            String promptVariant) {

        int userTurn = messageCount / 2 + 1;
        InterviewPhase phase = InterviewPhase.fromUserTurn(userTurn);
        InterviewAnswerAnalysis analysis = analyzer.analyze(userMessage, phase, experienceLevel);

        boolean userAskedClosingQuestions = phase == InterviewPhase.CLOSING
                && userMessage != null
                && (userMessage.contains("?") || looksLikeCandidateQuestions(userMessage));

        InterviewDirectiveType directive = resolveDirective(phase, analysis, state, userAskedClosingQuestions);
        String directiveInstruction = directiveText(directive, analysis);

        Optional<InterviewQuestionDef> question = registry.pickQuestion(persona, position, phase, state);

        // ── Variant C: adaptive follow-up ────────────────────────────────────
        // When the answer is weak, replace the standard question with a DB-backed
        // challenge question targeting the same topic the candidate struggled with.
        boolean isVariantC = "variant_c".equalsIgnoreCase(promptVariant);
        if (isVariantC && analysis.weakAnswer()
                && directive != InterviewDirectiveType.CLOSING_ASK
                && directive != InterviewDirectiveType.CLOSING_ANSWER) {
            String lastTopic = state.getTopicsCovered().isEmpty()
                    ? null
                    : state.getTopicsCovered().get(state.getTopicsCovered().size() - 1);
            Optional<InterviewQuestionDef> adaptiveQ = registry.pickChallengeFollowUp(
                    persona, phase, lastTopic, state.getAskedQuestionIds());
            if (adaptiveQ.isPresent()) {
                question = adaptiveQ;
                // Override directive to a deeper probe when we have a specific follow-up
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

        if (userAskedClosingQuestions) {
            directive = InterviewDirectiveType.CLOSING_ANSWER;
            directiveInstruction = InterviewClosingTemplates.answerGuide(persona, position);
            mandatoryQuestion = "Beantworten Sie die Fragen des Kandidaten einzeln und konkret. Fragen Sie zum Schluss: 'Gibt es noch etwas?'";
        } else if (phase == InterviewPhase.CLOSING && userTurn >= 12) {
            mandatoryQuestion = "Haben Sie noch Fragen an uns?";
            directive = InterviewDirectiveType.CLOSING_ASK;
        }

        if (directive == InterviewDirectiveType.CHALLENGE_EXAMPLE
                || directive == InterviewDirectiveType.PROBE_SPECIFIC
                || directive == InterviewDirectiveType.INTERRUPT_HOOK) {
            mandatoryQuestion = prependDirective(mandatoryQuestion, directiveInstruction);
        }

        return new InterviewTurnPlan(
                userTurn,
                phase,
                directive,
                directiveInstruction,
                mandatoryQuestion,
                questionId,
                topicKey,
                8,
                InterviewTurnPlan.DEFAULT_FORBIDDEN,
                userAskedClosingQuestions ? InterviewClosingTemplates.answerGuide(persona, position) : null,
                userAskedClosingQuestions
        );
    }

    /**
     * Overload without variant — defaults to "control" behaviour for backward compatibility
     * (greeting turn, tests, other callers that have no variant context yet).
     */
    public InterviewTurnPlan planTurn(
            InterviewSessionState state,
            SpeakingPersona persona,
            String position,
            String experienceLevel,
            int messageCount,
            String userMessage) {
        return planTurn(state, persona, position, experienceLevel, messageCount, userMessage, "control");
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
            case FOLLOW_UP, STANDARD -> "Beziehen Sie sich auf ein konkretes Detail der Antwort, dann stellen Sie die Pflichtfrage.";
        };
    }

    private static String prependDirective(String question, String instruction) {
        return instruction + " Pflichtfrage (sinngemäß): " + question;
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
