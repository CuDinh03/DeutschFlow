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

        sb.append("== TURN_DIRECTIVE (SERVER — Leitplanke, kein starres Skript) ==\n");
        sb.append("Typ: ").append(ctx.directiveType()).append("\n");
        sb.append("Anweisung: ").append(ctx.directiveInstruction()).append("\n");
        sb.append("Abdeckungsziel (Coverage-Frage — stelle sie NUR, wenn die Antwort des Kandidaten keinen ");
        sb.append("besseren, natürlichen Anknüpfungspunkt bietet; sonst folge dem Gesprächsfluss): ")
                .append(ctx.mandatoryQuestion()).append("\n");
        sb.append("Kurze Reaktion (max. ").append(ctx.ackMaxWords())
                .append(" Wörter): knapp und echt; würdige nur, wenn wirklich verdient — kein Dauerlob.\n");
        sb.append("Verbotene Phrasen: ").append(ctx.forbiddenPhrases()).append("\n");
        if (ctx.closingAnswerGuide() != null && !ctx.closingAnswerGuide().isBlank()) {
            sb.append("Abschluss-Antworten: ").append(ctx.closingAnswerGuide()).append("\n");
        }
        sb.append("\n");
    }
}
