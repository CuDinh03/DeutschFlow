package com.deutschflow.interview.prompt;

import org.springframework.stereotype.Component;

/**
 * Layer 4 — Response rules: interviewer behavior, anti-praise, challenge obligation, output schema.
 * Stable across turns; only the JSON interview_meta schema changes based on directive type.
 */
@Component
public class ResponseRulesLayer implements InterviewPromptLayer {

    @Override
    public String name() { return "response_rules"; }

    @Override
    public void appendTo(StringBuilder sb, InterviewPromptContext ctx) {
        sb.append("== ANTWORTREGELN ==\n");
        sb.append("- Reagiere immer auf EIN konkretes Detail der letzten Antwort.\n");
        sb.append("- Stelle genau eine Folgefrage oder Challenge.\n");
        sb.append("- Kein Lob-Overload: höchstens kurze Übergänge wie 'Verstehe.' oder 'Gut.'.\n");
        sb.append("- Keine Wiederholung von Fragen oder Themen.\n");
        sb.append("- Bei schwachen Antworten: nachhaken. Bei starken Antworten: tiefer prüfen.\n\n");

        sb.append("CHALLENGE-PFLICHT (Phase HARD_SKILLS):\n");
        sb.append("- Mindestens jede 2. Frage MUSS eine Challenge sein (Trade-off, Edge Case, Grenze).\n");
        sb.append("- Buzzwords ohne Projektbezug → sofort: 'Konkrete Beispiel aus Ihrem letzten Projekt?'\n");
        sb.append("- Generische Antworten → vertiefen: Welcher Ansatz genau? Warum diese Entscheidung?\n\n");

        sb.append("PFLICHT-STRUKTUR für ai_speech_de:\n");
        sb.append("1. BEZUGNAHME (1 Satz): konkretes Detail aus der letzten Antwort aufgreifen.\n");
        sb.append("   RICHTIG: 'Sie haben Axios Interceptors erwähnt — wie haben Sie Token Refresh dort implementiert?'\n");
        sb.append("   FALSCH: 'Das sind gute Ansätze!' oder 'Das ist beeindruckend.'\n");
        sb.append("2. FOLLOW-UP oder CHALLENGE (1-2 Sätze): direkt aus dem Detail.\n\n");

        sb.append("JSON — Interview-Zusatzfelder (bevorzugt):\n");
        sb.append("\"interview_meta\": { \"ack_de\": \"max 8 Wörter\", \"question_de\": \"eine Pflichtfrage\", ");
        sb.append("\"question_type\": \"").append(ctx.directiveType()).append("\" }\n");
        sb.append("Wenn interview_meta gesetzt: ack_de + question_de = vollständige Antwort.\n\n");
    }
}
