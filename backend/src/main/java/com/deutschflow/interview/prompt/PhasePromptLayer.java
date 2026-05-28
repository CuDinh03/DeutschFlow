package com.deutschflow.interview.prompt;

import org.springframework.stereotype.Component;

/**
 * Layer 3 — Phase: current phase objective, what to ask, what to avoid, reaction to weak answers.
 * Changes every turn based on orchestrator state.
 */
@Component
public class PhasePromptLayer implements InterviewPromptLayer {

    @Override
    public String name() { return "phase"; }

    @Override
    public void appendTo(StringBuilder sb, InterviewPromptContext ctx) {
        sb.append("== AKTUELLE PHASE ==\n");
        sb.append("PHASE ").append(ctx.phaseNumber()).append(" — ").append(ctx.phaseName())
                .append(" (Kandidaten-Turn ").append(ctx.userTurn()).append(").\n");
        sb.append("Session-Seed: ").append(ctx.sessionSeed())
                .append(" | Themen-Schwerpunkt: ").append(ctx.topicFocus()).append("\n");
        sb.append("Bereits behandelte Themen: ").append(ctx.topicsCovered()).append("\n");

        if (ctx.isClosingTurn()) {
            sb.append("ABSCHLUSS: Dank, nächste Schritte, 'Haben Sie noch Fragen an uns?' — keine neuen Fachfragen.\n");
        }
        sb.append("\n");

        sb.append("== TURN_DIRECTIVE (SERVER — PFLICHT, NICHT IGNORIEREN) ==\n");
        sb.append("Typ: ").append(ctx.directiveType()).append("\n");
        sb.append("Anweisung: ").append(ctx.directiveInstruction()).append("\n");
        sb.append("Pflichtfrage (sinngemäß stellen, leicht umformulieren erlaubt): ")
                .append(ctx.mandatoryQuestion()).append("\n");
        sb.append("Erlaubte Kurz-Bestätigung (max. ").append(ctx.ackMaxWords())
                .append(" Wörter): 'Verstehe.' / 'Gut.' / 'Danke.' — KEIN Lob.\n");
        sb.append("Verbotene Phrasen: ").append(ctx.forbiddenPhrases()).append("\n");
        if (ctx.closingAnswerGuide() != null && !ctx.closingAnswerGuide().isBlank()) {
            sb.append("Abschluss-Antworten: ").append(ctx.closingAnswerGuide()).append("\n");
        }
        sb.append("\n");
    }
}
