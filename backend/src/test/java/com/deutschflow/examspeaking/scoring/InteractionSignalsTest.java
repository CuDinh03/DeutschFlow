package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.deutschflow.examspeaking.api.model.Utterance;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tín hiệu tương tác đưa vào prompt chấm. Ca quan trọng nhất: thí sinh đọc thuộc bài chuẩn bị,
 * không hỏi lại câu nào — trước đợt này không có gì kéo `AUFGABENBEWAELTIGUNG` xuống.
 */
@DisplayName("InteractionSignals")
class InteractionSignalsTest {

    private static Utterance say(String role, String text) {
        return new Utterance(role, text, List.of(), null, null);
    }

    private static ParticipantBundle.PartTranscript teil(List<Utterance> candidate, List<Utterance> others) {
        return new ParticipantBundle.PartTranscript(2, TaskArchetype.TOPIC_EXCHANGE, "Gespräch", candidate, others);
    }

    @Test
    @DisplayName("đếm đúng lượt, số từ và số câu hỏi lại")
    void countsTurnsWordsAndQuestions() {
        var s = InteractionSignals.of(teil(
                List.of(say("CANDIDATE", "Ich fahre gern ans Meer."),
                        say("CANDIDATE", "Und du? Wohin fährst du?")),
                List.of(say("PARTNER", "Ich bleibe lieber zu Hause."))));

        assertThat(s.candidateTurns()).isEqualTo(2);
        assertThat(s.partnerTurns()).isEqualTo(1);
        assertThat(s.candidateQuestions()).isEqualTo(2);
        assertThat(s.candidateWords()).isEqualTo(10);
        assertThat(s.partnerWords()).isEqualTo(5);
    }

    @Test
    @DisplayName("giám khảo điều phối KHÔNG tính là bạn hội thoại")
    void examinerTurnsAreNotPartnerTurns() {
        var s = InteractionSignals.of(teil(
                List.of(say("CANDIDATE", "Guten Tag.")),
                List.of(say("PRUEFER", "Bitte beginnen Sie."), say("PARTNER", "Hallo!"))));

        assertThat(s.partnerTurns()).as("chỉ đếm bạn thi").isEqualTo(1);
        assertThat(s.partnerWords()).isEqualTo(1);
    }

    @Test
    @DisplayName("nói một chiều: không hỏi lại câu nào dù có bạn thi")
    void monologue_isFlagged() {
        var s = InteractionSignals.of(teil(
                List.of(say("CANDIDATE", "Meine Vorlage zeigt drei Zahlen. Ich finde das interessant.")),
                List.of(say("PARTNER", "Meine auch."))));

        assertThat(s.noQuestionToPartner()).isTrue();
        assertThat(s.promptBlock())
                .contains("Rückfragen des Kandidaten: 0")
                .contains("erfüllt die Aufgabe NICHT vollständig");
    }

    @Test
    @DisplayName("tỉ lệ lời nói tính theo số từ, không theo số lượt")
    void sharePct_isByWords() {
        var s = InteractionSignals.of(teil(
                List.of(say("CANDIDATE", "a b c d e f g h")),
                List.of(say("PARTNER", "x b"))));

        assertThat(s.candidateSharePct()).isEqualTo(80);
        assertThat(s.promptBlock()).contains("Redeanteil Kandidat: 80 %");
    }

    @Test
    @DisplayName("Teil không có bạn thi thì KHÔNG thêm gì vào prompt")
    void soloPart_addsNothing() {
        var s = InteractionSignals.of(teil(List.of(say("CANDIDATE", "Ich halte einen Vortrag.")), List.of()));

        assertThat(s.noQuestionToPartner()).as("độc thoại không phải là lỗi tương tác").isFalse();
        assertThat(s.promptBlock()).isEmpty();
    }

    @Test
    @DisplayName("lượt trống và dấu hỏi lặp không làm sai con số")
    void blankTurnsAndRepeatedMarks() {
        var s = InteractionSignals.of(teil(
                List.of(say("CANDIDATE", "   "), say("CANDIDATE", "Wirklich???")),
                List.of(say("PARTNER", ""), say("PARTNER", "Ja."))));

        assertThat(s.candidateTurns()).isEqualTo(1);
        assertThat(s.partnerTurns()).isEqualTo(1);
        assertThat(s.candidateQuestions()).as("??? vẫn là một câu hỏi").isEqualTo(1);
    }

    @Test
    @DisplayName("không ai nói gì thì tỉ lệ là 0, không chia cho 0")
    void emptyTranscript_doesNotDivideByZero() {
        var s = InteractionSignals.of(teil(List.of(), List.of()));
        assertThat(s.candidateSharePct()).isZero();
        assertThat(s.promptBlock()).isEmpty();
    }


    // ── Thời lượng nói (Gói D, 17/09/2026): „Flüssigkeit der Rede" trong Kriterium 2 của telc ──

    @Test
    @DisplayName("lượt qua STT có thời lượng ⇒ prompt in Sprechzeit và tốc độ nói; giám khảo không tính")
    void timedTurns_reportSpeakingTimeAndTempo() {
        var s = InteractionSignals.of(teil(
                List.of(new Utterance("CANDIDATE", "Ich fahre gern ans Meer und bleibe dort zwei Wochen.", List.of(), null, 20.0),
                        new Utterance("CANDIDATE", "Und du? Wohin fährst du im Sommer?", List.of(), null, 10.0)),
                List.of(new Utterance("PRUEFER", "Bitte beginnen Sie.", List.of(), null, 5.0),
                        new Utterance("PARTNER", "Ich bleibe lieber zu Hause.", List.of(), null, 12.0))));

        assertThat(s.hasTiming()).isTrue();
        assertThat(s.candidateSeconds()).isEqualTo(30.0);
        assertThat(s.partnerSeconds()).as("giám khảo không phải bạn thi").isEqualTo(12.0);
        assertThat(s.candidateWordsPerMinute()).as("17 từ trong 30 s ⇒ 34 từ/phút").isEqualTo(34);
        assertThat(s.promptBlock()).contains("Sprechzeit: Kandidat 30 s, Partner 12 s").contains("34 Wörter/Minute");
    }

    @Test
    @DisplayName("lượt text-only (không thời lượng) ⇒ KHÔNG in dòng Sprechzeit — không bịa số")
    void textOnlyTurns_omitSpeakingTime() {
        var s = InteractionSignals.of(teil(
                List.of(say("CANDIDATE", "Ich fahre gern ans Meer.")),
                List.of(say("PARTNER", "Ich auch."))));

        assertThat(s.hasTiming()).isFalse();
        assertThat(s.candidateWordsPerMinute()).isZero();
        assertThat(s.promptBlock()).doesNotContain("Sprechzeit");
    }
}
