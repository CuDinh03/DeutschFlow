package com.deutschflow.interview.prompt;

import org.springframework.stereotype.Component;

/**
 * Layer 5 — Scoring: rubric criteria and weights injected from DB-backed templates.
 * Only appended when rubric data is available; omitted for sessions without a template match.
 *
 * <p>This layer is intentionally separate from the orchestration layers (Base, Persona, Phase,
 * ResponseRules) so rubric changes can be A/B-tested independently without touching turn flow.
 */
@Component
public class ScoringPromptLayer implements InterviewPromptLayer {

    @Override
    public String name() { return "scoring"; }

    @Override
    public void appendTo(StringBuilder sb, InterviewPromptContext ctx) {
        if (ctx.rubricCriteriaJson() == null || ctx.rubricCriteriaJson().isBlank()) {
            return;
        }
        sb.append("== BEWERTUNGSKRITERIEN (SERVER — für interne score_draft Orientierung) ==\n");
        sb.append("Kriterien: ").append(ctx.rubricCriteriaJson()).append("\n");
        sb.append("Gewichtung: ").append(ctx.rubricWeightJson()).append("\n");
        sb.append("Nutze diese Kriterien als Orientierung für deine Folgefragen und Challenge-Tiefe. ");
        sb.append("Gib sie NICHT wortwörtlich in der Antwort aus.\n\n");
    }
}
