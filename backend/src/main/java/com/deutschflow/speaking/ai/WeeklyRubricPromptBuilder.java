package com.deutschflow.speaking.ai;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Builds system + user messages for graded weekly Deutsche speaking tasks (4-axis rubric).
 */
@Component
public class WeeklyRubricPromptBuilder {

    private static final String SYSTEM = """
            Du bewertest eine schriftliche Transkript-Version eines monologischen Sprechers (bereits durch STT).
            Antworte NUR mit validem JSON, kein Markdown, keine Erklärung außerhalb des JSON.

            Bewertungsachsen:
            (1) Erfüllung / Aufgabenbewältigung: Sind die geforderten Pflicht-Inhalspunkte inhaltlich erreicht und logisch?
            (2) Flüssigkeit: nur grob über Text – Füllwörter (äh/ähm/… ), Schachtelsätze, kein echtes Aussprache-Level.
            (3) Wortschatz: passend zur CEFR-Zielbande %s — keine Überforderung; schlage höhere Alternativen nur vor, wenn sinnvoll.
            (4) Grammatik: strukturierte Fehler mit Codes aus dieser Whitelist; max. 10 Einträge mit höchstem severity zuerst.
            Fehler-Codes dürfen NUR diese Werte nutzen sonst Liste leer:
            %s

            JSON-Schema (exakte Schlüssel):
            {
              "task_completion": {
                "score_1_to_5": <int>,
                "covered_mandatory_indices": <int[]> (0-based Indizes zur Pflichtpunktliste),
                "missing_mandatory_indices": <int[]>,
                "off_topic": <bool>,
                "ambiguous": <bool>
              },
              "fluency": {
                "subjective_notes_de": "<string kurz>",
                "filler_approx_count": <int>,
                "wpm_approx": <number|null wenn nicht berechenbar>,
                "confidence_label": "TEXT_ONLY_PROXY"
              },
              "lexis": {
                "richness_notes_de": ["..."],
                "replacements_suggested_de_vi": [ {"from_de":"...","to_de_suggestion":"...","note_vi":"..."} ]
              },
              "grammar": {
                "summary_de": "...",
                "errors": [
                  {
                    "error_code":"WORD_ORDER.V2_MAIN_CLAUSE",
                    "severity":"MINOR"|"MAJOR"|"BLOCKING",
                    "confidence":0.0-1.0,
                    "wrong_span":"...",
                    "corrected_span":"...",
                    "rule_vi_short":"..."
                  }
                ]
              },
              "feedback_vi_summary": "Stärken ZUERST, dann Lücken, dann ermutigender nächster Schritt auf Vietnamesisch.",
              "disclaimer_vi": "Kurzer Hinweis dass Bewertung Lernhilfe ist, keine Prüfungsnote."
            }
            Regeln:
            - Wenn keine Grammatikfehler: grammar.errors=[].
            - feedback_vi_summary beginnt mit positiven Punkten.
            — confidence bei grammar.errors wenn unklar unter 0.5 setzen oder weglassen.
            """;

    private static String bulletLines(List<String> points) {
        if (points == null || points.isEmpty()) return "(keine)";
        return IntStream.range(0, points.size())
                .mapToObj(i -> i + ") " + points.get(i))
                .collect(Collectors.joining("\n"));
    }

    public ChatMessage buildSystemMessage(List<String> mandatoryPoints,
                                          List<String> optionalPoints,
                                          String learnerCefrBand) {
        String band = learnerCefrBand == null || learnerCefrBand.isBlank()
                ? "A1"
                : learnerCefrBand.trim().toUpperCase();
        String prompt = SYSTEM.formatted(band, ErrorCatalog.codesCompactForPrompt());
        String md = bulletLines(mandatoryPoints == null ? List.of() : mandatoryPoints);
        String od = bulletLines(optionalPoints == null ? List.of() : optionalPoints);
        return new ChatMessage("system", prompt + "\nPflicht-Inhaltspunkte (Indizes beginnen bei 0):\n" + md + "\nOptionale Punkte:\n" + od);
    }

    public ChatMessage buildUserMessage(String examPromptDe,
                                        String germanTranscript,
                                        BigDecimal audioDurationSec,
                                        String wordCountHint) {
        String durationLine = audioDurationSec == null
                ? "AUDIO_DURATION_SECONDS: nicht angegeben."
                : "AUDIO_DURATION_SECONDS: " + audioDurationSec.stripTrailingZeros().toPlainString();
        String wc = wordCountHint == null ? "(unbekannt)" : wordCountHint;
        String body = """
                AUFGABE (Deutsch):\s
                %s

                %s
                TRANSCRIPT_WORD_COUNT_APPROX: %s

                TRANSKRIPT (DE, Nutzer):\s
                %s

                Bewerte strikt gegen die Pflichtpunkte. Wenn der Text offensichtlich nicht zur Aufgabe passt: off_topic=true.
                """.formatted(
                examPromptDe == null ? "" : examPromptDe,
                durationLine,
                wc,
                germanTranscript == null ? "" : germanTranscript
        );
        return new ChatMessage("user", body);
    }

    /** Approximate whitespace token count for WPM heuristic hint. */
    public static int germanWordApproxCount(String transcript) {
        if (transcript == null || transcript.isBlank()) return 0;
        return transcript.trim().split("\\s+").length;
    }
}
