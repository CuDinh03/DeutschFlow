package com.deutschflow.speaking.interview;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** K4: mọi câu viết tay có bản dịch Việt/Anh, vị trí chèn đúng theo từng ngôn ngữ. */
class InterviewQuestionBankTranslationTest {

    @Test
    void everyQuestionOfEveryPersonaHasBothTranslations() {
        for (SpeakingPersona persona : SpeakingPersona.values()) {
            for (InterviewQuestionDef q : InterviewQuestionBank.forPersona(persona, "Kellner/in")) {
                assertThat(q.questionVi()).as("vi %s/%s", persona, q.id()).isNotBlank().isNotEqualTo(q.questionDe());
                assertThat(q.questionEn()).as("en %s/%s", persona, q.id()).isNotBlank().isNotEqualTo(q.questionDe());
            }
        }
    }

    @Test
    void positionIsWrappedPerLanguage() {
        InterviewQuestionDef intro = intro(InterviewQuestionBank.forPersona(SpeakingPersona.NIKLAS, "Kellner/in"));
        assertThat(intro.questionDe()).contains("relevante Erfahrung für Kellner/in,");
        assertThat(intro.questionVi()).contains("liên quan đến vị trí Kellner/in,");
        assertThat(intro.questionEn()).contains("relevant experience for the Kellner/in position,");

        InterviewQuestionDef blank = intro(InterviewQuestionBank.forPersona(SpeakingPersona.DEFAULT, " "));
        assertThat(blank.questionDe()).contains("für diese Position,");
        assertThat(blank.questionVi()).contains("liên quan đến vị trí này,");
        assertThat(blank.questionEn()).contains("for this position,");
    }

    private static InterviewQuestionDef intro(List<InterviewQuestionDef> bank) {
        return bank.stream().filter(q -> q.phase() == InterviewPhase.INTRO).findFirst().orElseThrow();
    }
}
