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
        assertThat(intro.questionDe()).isEqualTo(
                "Bitte stellen Sie sich kurz vor: Ihr Werdegang, Ihre Erfahrung als Kellner/in und Ihr nächster Schritt.");
        assertThat(intro.questionVi()).contains("kinh nghiệm ở vị trí Kellner/in và");
        assertThat(intro.questionEn()).contains("your experience in the Kellner/in position and");

        // Chưa có vị trí: "als diese Position" sai ngữ pháp nên câu đổi sang "für diese Position".
        InterviewQuestionDef blank = intro(InterviewQuestionBank.forPersona(SpeakingPersona.DEFAULT, " "));
        assertThat(blank.questionDe()).isEqualTo(
                "Bitte stellen Sie sich kurz vor: Ihr Werdegang, Ihre Erfahrung für diese Position und Ihr nächster Schritt.");
        assertThat(blank.questionVi()).contains("kinh nghiệm ở vị trí này và");
        assertThat(blank.questionEn()).contains("your experience in this position and");
    }

    private static InterviewQuestionDef intro(List<InterviewQuestionDef> bank) {
        return bank.stream().filter(q -> q.phase() == InterviewPhase.INTRO).findFirst().orElseThrow();
    }
}
