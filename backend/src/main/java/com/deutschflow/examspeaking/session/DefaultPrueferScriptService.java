package com.deutschflow.examspeaking.session;

import com.deutschflow.examspeaking.api.PrueferScriptService;
import com.deutschflow.examspeaking.api.model.BlueprintPart;
import com.deutschflow.examspeaking.api.model.ExamBlueprint;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Lời dẫn giám khảo theo MẪU (deterministic, 0 token) — đúng nghi thức phòng thi: chào, giới thiệu Teil,
 * nhắc chất liệu, chuyển phần, kết. Giọng: {@code VOICE_PRUEFER} (client gọi TTS).
 */
@Service
public class DefaultPrueferScriptService implements PrueferScriptService {

    static final String VOICE_PRUEFER = "PRUEFER";

    @Override
    public PrueferLine line(ExamBlueprint bp, BlueprintPart part, Moment moment, Map<String, Object> stimulus) {
        String exam = bp.provider() == ExamProvider.GOETHE ? "Goethe-Zertifikat " : "telc Deutsch ";
        String text = switch (moment) {
            case SESSION_OPENING -> "Guten Tag und herzlich willkommen zur mündlichen Prüfung " + exam + bp.level()
                    + ". Ich bin Ihre Prüferin. Wir machen jetzt " + bp.parts().size() + " Teile. Bitte sprechen Sie deutlich. Fangen wir an.";
            case PART_INTRO -> partIntro(part, stimulus);
            case PART_TRANSITION -> "Vielen Dank. Das war Teil " + part.teilNo() + ". Wir kommen jetzt zum nächsten Teil.";
            case SESSION_CLOSING -> "Vielen Dank, das war die Prüfung. Sie bekommen gleich Ihre Auswertung. Auf Wiedersehen!";
        };
        return new PrueferLine(text, VOICE_PRUEFER);
    }

    private static String partIntro(BlueprintPart part, Map<String, Object> stimulus) {
        String s = stimulus == null ? Map.<String, Object>of().toString() : "";
        return switch (part.archetype()) {
            case SELF_INTRO -> "Teil " + part.teilNo() + ": Sich vorstellen. Bitte stellen Sie sich vor. Auf der Karte sehen Sie Stichwörter: "
                    + join(stimulus, "keywords") + ". Sprechen Sie bitte zu jedem Punkt.";
            case CARD_QA -> "Teil " + part.teilNo() + ": Um Informationen bitten und Informationen geben. Sie bekommen Karten mit einem Thema und einem Wort. "
                    + "Bitte stellen Sie Ihrem Partner eine Frage zu dem Wort, und beantworten Sie die Frage Ihres Partners. Ihre erste Karte: Thema "
                    + str(stimulus, "thema") + ", Wort " + str(stimulus, "wort") + ".";
            case REQUEST_RESPOND -> "Teil " + part.teilNo() + ": Bitten formulieren und darauf reagieren. Sie sehen ein Bild und formulieren eine Bitte oder eine Aufforderung; "
                    + "Ihr Partner reagiert darauf. Ihr erstes Bild zeigt: " + str(stimulus, "article") + " " + str(stimulus, "object") + ".";
            case ABOUT_ME -> "Teil " + part.teilNo() + ": Von sich erzählen. Auf Ihrer Karte steht: " + str(stimulus, "prompt")
                    + ". Erzählen Sie bitte etwas darüber. Sie haben etwa eine Minute.";
            case PLAN_NEGOTIATE -> "Teil " + part.teilNo() + ": Gemeinsam etwas planen. Die Situation: " + str(stimulus, "situation")
                    + ". Machen Sie Vorschläge, reagieren Sie auf die Vorschläge Ihres Partners und einigen Sie sich.";
            case TOPIC_EXCHANGE -> "Teil " + part.teilNo() + ": " + part.title() + ". " + str(stimulus, "instruction");
            case PRESENT -> "Teil " + part.teilNo() + ": " + part.title() + ". Bitte präsentieren Sie Ihr Thema: " + str(stimulus, "topic")
                    + ". Achten Sie auf Einleitung, Hauptteil und Schluss.";
            case FEEDBACK_FOLLOWUP -> "Teil " + part.teilNo() + ": Über ein Thema sprechen. Ihr Partner hat gerade präsentiert. Geben Sie bitte eine Rückmeldung und stellen Sie eine Frage.";
            case DISCUSS -> "Teil " + part.teilNo() + ": Diskussion. Die Frage lautet: " + str(stimulus, "question")
                    + ". Tauschen Sie Ihren Standpunkt und Ihre Argumente aus und fassen Sie am Ende zusammen: dafür oder dagegen?";
            case PICTURE -> "Teil " + part.teilNo() + ": Bitte beschreiben Sie das Bild und erzählen Sie, was Sie damit verbinden.";
        } + s;
    }

    private static String str(Map<String, Object> stimulus, String key) {
        if (stimulus == null) {
            return "…";
        }
        Object v = stimulus.get(key);
        return v == null ? "…" : String.valueOf(v);
    }

    @SuppressWarnings("unchecked")
    private static String join(Map<String, Object> stimulus, String key) {
        if (stimulus == null || !(stimulus.get(key) instanceof java.util.List<?> list)) {
            return "…";
        }
        return String.join(", ", ((java.util.List<Object>) list).stream().map(String::valueOf).toList());
    }
}
