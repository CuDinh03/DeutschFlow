package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.deutschflow.examspeaking.api.model.Utterance;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.ErrorCatalog;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Prompt chấm theo ĐÚNG tên tiêu chí + descriptor nguyên văn của hệ (Goethe A–E / telc A–D).
 * LLM chỉ trả band/trạng thái + bằng chứng + danh sách lỗi; điểm do {@link RubricScorer} tính.
 */
@Component
public class GradingPromptBuilder {

    static final Map<String, String> DESCRIPTORS = Map.ofEntries(
            Map.entry("ERFUELLUNG", "Erfüllung der Aufgabenstellung: Inhaltspunkte, Sprachfunktionen, Umfang"),
            Map.entry("INTERAKTION", "Interaktion: Gespräch beginnen/aufrechterhalten/beenden, auf den Partner eingehen, Register"),
            Map.entry("KOHAERENZ", "Kohärenz: Verknüpfungsmittel, Struktur, roter Faden"),
            Map.entry("KOHAERENZ_FLUESSIGKEIT", "Kohärenz und Flüssigkeit: Verknüpfungsmittel, Sprechtempo, Stockungen"),
            Map.entry("INTERAKTION_REGISTER", "Interaktion und Register: auf Argumente eingehen, angemessener Ton"),
            Map.entry("WORTSCHATZ", "Wortschatz: Spektrum (Bandbreite) und Beherrschung (Treffsicherheit)"),
            Map.entry("STRUKTUREN", "Strukturen: Spektrum und Beherrschung (Satzbau, Morphologie)"),
            Map.entry("FRAGEN_ANTWORTEN", "Fragen zum Vortrag stellen und beantworten"),
            Map.entry("AUSSPRACHE", "Aussprache: Satzmelodie, Wortakzent, einzelne Laute"),
            Map.entry("AUSDRUCKSFAEHIGKEIT", "Ausdrucksfähigkeit: Wortschatz, Ausdrucksvielfalt, Angemessenheit"),
            Map.entry("AUFGABENBEWAELTIGUNG", "Aufgabenbewältigung: Gesprächsbeteiligung, Strategien, Flüssigkeit"),
            Map.entry("FORMALE_RICHTIGKEIT", "Formale Richtigkeit: Morphologie und Syntax"),
            Map.entry("AUSSPRACHE_INTONATION", "Aussprache und Intonation")
    );

    static final Map<TaskArchetype, String> ARCHETYPE_DE = Map.of(
            TaskArchetype.SELF_INTRO, "Sich vorstellen (Name, Alter, Land, Wohnort, Sprachen, Beruf, Hobby; buchstabieren; Zahl nennen)",
            TaskArchetype.CARD_QA, "Mit Themenkarten Fragen stellen und Fragen beantworten",
            TaskArchetype.REQUEST_RESPOND, "Mit Bildkarten Bitten/Aufforderungen formulieren und darauf reagieren",
            TaskArchetype.ABOUT_ME, "Von sich erzählen (kurzer Monolog mit Leitpunkten)",
            TaskArchetype.PLAN_NEGOTIATE, "Gemeinsam etwas planen/aushandeln: Vorschläge machen, reagieren, sich einigen",
            TaskArchetype.TOPIC_EXCHANGE, "Kontaktaufnahme / Gespräch über ein Thema (ggf. mit Grafik)",
            TaskArchetype.PRESENT, "Ein Thema strukturiert präsentieren / Vortrag halten",
            TaskArchetype.FEEDBACK_FOLLOWUP, "Rückmeldung zur Präsentation des Partners geben und Fragen stellen",
            TaskArchetype.DISCUSS, "Diskussion: Standpunkt vertreten, auf Argumente eingehen, zusammenfassen",
            TaskArchetype.PICTURE, "Ein Bild beschreiben und dazu sprechen"
    );

    public List<ChatMessage> partPrompt(ExamProvider scheme, String level, RubricDefinition rubric,
                                        RubricDefinition.RubricPart rp, ParticipantBundle.PartTranscript pt,
                                        String partnerKind) {
        StringBuilder sb = new StringBuilder();
        sb.append("Prüfung: ").append(schemeName(scheme)).append(' ').append(level)
                .append(" — Sprechen, Teil ").append(rp.teilNo()).append('\n');
        sb.append("Aufgabentyp: ").append(ARCHETYPE_DE.getOrDefault(pt.archetype(), pt.archetype().name())).append('\n');
        if (pt.taskDescription() != null && !pt.taskDescription().isBlank()) {
            sb.append("Aufgabe/Material: ").append(pt.taskDescription()).append('\n');
        }
        sb.append("\nTRANSKRIPT (nur Zeilen mit CANDIDATE werden bewertet):\n");
        appendTranscript(sb, pt);

        sb.append("\nBEWERTE NUR DEN KANDIDATEN. Partner ist ").append("HUMAN".equalsIgnoreCase(partnerKind)
                ? "ein gleichstufiger Lerner — nicht abwerten, wenn der Partner schwach ist; Hilfe für den Partner positiv werten."
                : "eine KI — ignoriere deren Qualität.").append('\n');
        sb.append("Bei Unsicherheit zwischen zwei Stufen: die NIEDRIGERE Stufe wählen. Nur Belege aus dem Transkript zitieren.\n");

        if (rubric.scale() == RubricDefinition.BandScale.VHN) {
            sb.append("\nAUFGABENPUNKTE (Status: VOLL = vollständig erfüllt und verständlich, HALB = teilweise, NULL = nicht erfüllt):\n");
            for (RubricDefinition.RubricItem it : rp.items()) {
                sb.append("- ").append(it.code()).append(": ").append(it.label()).append('\n');
            }
        } else {
            sb.append("\nKRITERIEN (Stufen ").append(String.join(", ", BandScales.bands(rubric.scale())))
                    .append(" — ").append(bandLegend(rubric.scale())).append("):\n");
            for (RubricDefinition.RubricCriterion c : rp.criteria()) {
                sb.append("- ").append(c.code()).append(": ").append(DESCRIPTORS.getOrDefault(c.code(), c.label())).append('\n');
            }
        }
        sb.append("\nFEHLERCODES (nur diese verwenden): ").append(String.join(", ", ErrorCatalog.ORDERED_CODES)).append('\n');
        sb.append("\nAntworte NUR mit JSON:\n")
                .append("{\"items\":[{\"code\":\"...\",\"status\":\"VOLL|HALB|NULL\",\"quote\":\"...\"}],")
                .append("\"criteria\":[{\"code\":\"...\",\"band\":\"A\",\"evidence\":[\"Zitat 1\",\"Zitat 2\"]}],")
                .append("\"errors\":[{\"code\":\"...\",\"original\":\"...\",\"correction\":\"...\",\"severity\":\"MAJOR|MINOR\"}],")
                .append("\"summary_vi\":\"2 câu nhận xét tiếng Việt\"}\n")
                .append("items nur bei Aufgabenpunkten, criteria nur bei Kriterien; leere Listen sonst.");
        return List.of(new ChatMessage("system", systemPrompt(scheme, level)), new ChatMessage("user", sb.toString()));
    }

    public List<ChatMessage> globalPrompt(ExamProvider scheme, String level, RubricDefinition rubric,
                                          List<RubricDefinition.RubricCriterion> criteria, ParticipantBundle bundle) {
        StringBuilder sb = new StringBuilder();
        sb.append("Prüfung: ").append(schemeName(scheme)).append(' ').append(level)
                .append(" — Sprechen, GESAMTBEWERTUNG über alle Teile.\n\nTRANSKRIPT:\n");
        for (ParticipantBundle.PartTranscript pt : bundle.parts()) {
            sb.append("[Teil ").append(pt.teilNo()).append("]\n");
            appendTranscript(sb, pt);
        }
        sb.append("\nKRITERIEN (Stufen ").append(String.join(", ", BandScales.bands(rubric.scale())))
                .append(" — ").append(bandLegend(rubric.scale())).append("):\n");
        for (RubricDefinition.RubricCriterion c : criteria) {
            sb.append("- ").append(c.code()).append(": ").append(DESCRIPTORS.getOrDefault(c.code(), c.label())).append('\n');
        }
        sb.append("Bei Unsicherheit: die NIEDRIGERE Stufe. Antworte NUR mit JSON: ")
                .append("{\"criteria\":[{\"code\":\"...\",\"band\":\"A\",\"evidence\":[\"...\"]}]}");
        return List.of(new ChatMessage("system", systemPrompt(scheme, level)), new ChatMessage("user", sb.toString()));
    }

    private static void appendTranscript(StringBuilder sb, ParticipantBundle.PartTranscript pt) {
        // Giữ thứ tự lượt nếu có: others và candidate được nối xen kẽ bởi session service (role có sẵn trên Utterance).
        List<Utterance> all = new java.util.ArrayList<>(pt.others());
        all.addAll(pt.candidate());
        for (Utterance u : all) {
            sb.append(u.role()).append(": ").append(u.text() == null ? "" : u.text().trim()).append('\n');
        }
    }

    static String systemPrompt(ExamProvider scheme, String level) {
        return "Du bist erfahrene/r Prüfer/in für die mündliche Prüfung " + schemeName(scheme) + " " + level
                + ". Du bewertest streng, fair und ausschließlich nach den offiziellen Kriterien der Prüfung. "
                + "Du bewertest, was gesagt wurde — nicht, was gemeint sein könnte. Antworte ausschließlich mit gültigem JSON.";
    }

    static String schemeName(ExamProvider scheme) {
        return scheme == ExamProvider.GOETHE ? "Goethe-Zertifikat" : "telc Deutsch";
    }

    static String bandLegend(RubricDefinition.BandScale scale) {
        return switch (scale) {
            case A_E -> "A = voll erfüllt/sehr gut, B = weitgehend, C = teilweise, D = kaum, E = nicht erfüllt";
            case A_D -> "A = erfüllt, B = größtenteils, C = teilweise, D = nicht erfüllt";
            case VHN -> "VOLL, HALB, NULL";
        };
    }
}
