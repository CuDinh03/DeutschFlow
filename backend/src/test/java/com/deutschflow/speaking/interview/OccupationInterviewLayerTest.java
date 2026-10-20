package com.deutschflow.speaking.interview;

import com.deutschflow.interview.entity.InterviewQuestion;
import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationQuestion;
import com.deutschflow.interview.repository.InterviewQuestionRepository;
import com.deutschflow.interview.repository.OccupationQuestionRepository;
import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Lớp câu hỏi theo nghề trong phiên phỏng vấn (đợt 2b A + B + E): lớp nghề đi trước trong
 * HARD_SKILLS, câu "Đã duyệt" trước câu "AI tạo", và mỗi phiên theo nghề có ít nhất 3 câu theo nghề.
 */
@ExtendWith(MockitoExtension.class)
class OccupationInterviewLayerTest {

    private static final String CODE = "pflegefachkraft";

    @Mock
    private OccupationQuestionRepository occupationRepo;
    @Mock
    private InterviewQuestionRepository personaRepo;

    private PersonaInterviewRegistry registry() {
        return new PersonaInterviewRegistry(null, null, occupationRepo);
    }

    private static InterviewSessionState occupationState() {
        InterviewSessionState s = InterviewSessionState.initial(1, "Pflege");
        s.setOccupationCode(CODE);
        return s;
    }

    @Test
    void hardSkillsPrefersOccupationLayerAndNeverAsksForRejected() {
        when(occupationRepo.findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), any()))
                .thenReturn(List.of(occ("occ_pflegefachkraft_a", OccupationContentStatus.AI_GENERATED, "INTERMEDIATE", 1,
                        "Wie dokumentieren Sie eine Wundversorgung?")));

        Optional<InterviewQuestionDef> q = registry().pickQuestion(SpeakingPersona.DEFAULT,
                "Pflegefachmann/-frau", InterviewPhase.HARD_SKILLS, occupationState());

        assertThat(q).map(InterviewQuestionDef::id).contains("occ_pflegefachkraft_a");
        assertThat(q).map(InterviewQuestionDef::questionDe).contains("Wie dokumentieren Sie eine Wundversorgung?");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<OccupationContentStatus>> statuses = ArgumentCaptor.forClass(Collection.class);
        verify(occupationRepo).findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), statuses.capture());
        assertThat(statuses.getValue()).containsExactlyInAnyOrder(
                OccupationContentStatus.APPROVED, OccupationContentStatus.AI_GENERATED);
    }

    @Test
    void approvedComesBeforeAiGeneratedThenNearestDifficulty() {
        when(occupationRepo.findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), any()))
                .thenReturn(List.of(
                        occ("occ_ai_beginner", OccupationContentStatus.AI_GENERATED, "BEGINNER", 1, "A?"),
                        occ("occ_ok_advanced", OccupationContentStatus.APPROVED, "ADVANCED", 2, "B?"),
                        occ("occ_ok_beginner", OccupationContentStatus.APPROVED, "BEGINNER", 3, "C?")));

        Optional<InterviewQuestionDef> q = registry().pickQuestion(SpeakingPersona.DEFAULT, "Pflege",
                InterviewPhase.HARD_SKILLS, QuestionDifficulty.BEGINNER, occupationState());

        assertThat(q).map(InterviewQuestionDef::id).contains("occ_ok_beginner");
    }

    @Test
    void exhaustedLayerFallsBackToGeneralQuestions() {
        when(occupationRepo.findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), any()))
                .thenReturn(List.of(occ("occ_only", OccupationContentStatus.APPROVED, "INTERMEDIATE", 1, "A?")));
        InterviewSessionState state = occupationState();
        state.getAskedQuestionIds().add("occ_only");

        Optional<InterviewQuestionDef> q = registry().pickQuestion(SpeakingPersona.DEFAULT, "Pflege",
                InterviewPhase.HARD_SKILLS, state);

        assertThat(q).isPresent();
        assertThat(q.get().id()).doesNotStartWith(OccupationQuestion.ID_PREFIX);
    }

    @Test
    void layerIsOnlyForHardSkillsOfOccupationSessions() {
        PersonaInterviewRegistry registry = registry();
        registry.pickQuestion(SpeakingPersona.DEFAULT, "Pflege", InterviewPhase.STAR_SOFT, occupationState());
        registry.pickQuestion(SpeakingPersona.DEFAULT, "Pflege", InterviewPhase.HARD_SKILLS,
                InterviewSessionState.initial(1, "x"));
        verifyNoInteractions(occupationRepo);
    }

    @Test
    void earlyGoalMetCannotLeaveHardSkillsBeforeThreeOccupationTurns() {
        lenient().when(occupationRepo.findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), any()))
                .thenReturn(sixQuestions());
        InterviewOrchestrator orchestrator = new InterviewOrchestrator(new InterviewAnswerAnalyzer(), registry());

        InterviewSessionState occ = hardSkillsStateAfterOneTurn(CODE);
        InterviewTurnPlan held = orchestrator.planTurn(occ, SpeakingPersona.DEFAULT, "Pflege", "1-2Y", 8,
                STRONG_ANSWER, "control", "B1");
        assertThat(held.phase()).isEqualTo(InterviewPhase.HARD_SKILLS);
        assertThat(held.questionId()).startsWith(OccupationQuestion.ID_PREFIX);

        // Cùng trạng thái nhưng không theo nghề: người giỏi được sang STAR sớm như trước.
        InterviewTurnPlan general = orchestrator.planTurn(hardSkillsStateAfterOneTurn(null),
                SpeakingPersona.DEFAULT, "Pflege", "1-2Y", 8, STRONG_ANSWER, "control", "B1");
        assertThat(general.phase()).isEqualTo(InterviewPhase.STAR_SOFT);
    }

    @Test
    void wholeSessionAsksAtLeastThreeOccupationQuestionsEvenForAStrongCandidate() {
        when(occupationRepo.findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), any()))
                .thenReturn(sixQuestions());
        InterviewAnswerAnalyzer analyzer = new InterviewAnswerAnalyzer();
        InterviewOrchestrator orchestrator = new InterviewOrchestrator(analyzer, registry());
        InterviewSessionState state = occupationState();

        List<String> asked = new ArrayList<>();
        for (int userTurn = 1; userTurn <= 13; userTurn++) {
            // Mỗi lượt LLM báo "đạt mục tiêu" → nếu không có luật giữ, HARD_SKILLS chỉ kéo một lượt.
            state.setLastPhaseGoalMet(true);
            InterviewTurnPlan plan = orchestrator.planTurn(state, SpeakingPersona.DEFAULT, "Pflege", "1-2Y",
                    (userTurn - 1) * 2, STRONG_ANSWER, "control", "B1");
            asked.add(plan.questionId());
            state.applyAfterTurn(plan, analyzer.analyze(STRONG_ANSWER, plan.phase(), "1-2Y"));
        }

        assertThat(asked.stream().filter(id -> id.startsWith(OccupationQuestion.ID_PREFIX)).count())
                .isGreaterThanOrEqualTo(3);
        assertThat(state.getHardSkillsTurns()).isGreaterThanOrEqualTo(3);
    }

    @Test
    void variantCFollowUpDoesNotReplaceAnOccupationQuestion() {
        when(occupationRepo.findByOccupationCodeAndPhaseAndStatusIn(eq(CODE), eq("HARD_SKILLS"), any()))
                .thenReturn(sixQuestions());
        InterviewQuestion personaFollowUp = new InterviewQuestion();
        personaFollowUp.setId("db-default-1");
        personaFollowUp.setPersonaCode("DEFAULT");
        personaFollowUp.setPhase("HARD_SKILLS");
        personaFollowUp.setTopicKey("x");
        personaFollowUp.setQuestionDe("Nennen Sie ein Beispiel.");
        lenient().when(personaRepo.findByPersonaCodeAndPhaseAndActiveTrue(anyString(), anyString()))
                .thenReturn(List.of(personaFollowUp));
        InterviewOrchestrator orchestrator = new InterviewOrchestrator(new InterviewAnswerAnalyzer(),
                new PersonaInterviewRegistry(personaRepo, null, occupationRepo));

        InterviewSessionState state = occupationState();
        state.setPhase(InterviewPhase.HARD_SKILLS.number());
        InterviewTurnPlan plan = orchestrator.planTurn(state, SpeakingPersona.DEFAULT, "Pflege", "1-2Y", 6,
                "Ich würde Handschuhe tragen und würde dokumentieren.", "variant_c", "B1");

        assertThat(plan.questionId()).startsWith(OccupationQuestion.ID_PREFIX);
    }

    @Test
    void holdPolicyOnlyAppliesInsideHardSkillsBeforeThreeTurns() {
        InterviewPhase star = InterviewPhase.STAR_SOFT;
        assertThat(PhaseProgressionPolicy.holdOccupationHardSkills(star, 3, 5, 1)).isEqualTo(InterviewPhase.HARD_SKILLS);
        assertThat(PhaseProgressionPolicy.holdOccupationHardSkills(star, 3, 6, 3)).isEqualTo(star);
        // Trần theo lượt (lượt 10 = STAR) vẫn thắng.
        assertThat(PhaseProgressionPolicy.holdOccupationHardSkills(star, 3, 10, 1)).isEqualTo(star);
        // Đang ở ICE_BREAKER → HARD_SKILLS: không đụng.
        assertThat(PhaseProgressionPolicy.holdOccupationHardSkills(InterviewPhase.HARD_SKILLS, 2, 3, 0))
                .isEqualTo(InterviewPhase.HARD_SKILLS);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static final String STRONG_ANSWER = "Letztes Jahr habe ich auf der Station einen Patienten mit "
            + "Dekubitus versorgt. Ich habe die Wunde dokumentiert, den Arzt informiert und dadurch hat "
            + "sich die Heilung in zwei Wochen deutlich verbessert.";

    private static InterviewSessionState hardSkillsStateAfterOneTurn(String occupationCode) {
        InterviewSessionState s = InterviewSessionState.initial(1, "Pflege");
        s.setOccupationCode(occupationCode);
        s.setPhase(InterviewPhase.HARD_SKILLS.number());
        s.setHardSkillsTurns(1);
        s.setLastPhaseGoalMet(true);
        return s;
    }

    private static List<OccupationQuestion> sixQuestions() {
        List<OccupationQuestion> out = new ArrayList<>();
        for (int i = 1; i <= 6; i++) {
            out.add(occ("occ_pflegefachkraft_" + i, OccupationContentStatus.AI_GENERATED, "INTERMEDIATE", i,
                    "Fachfrage " + i + "?"));
        }
        return out;
    }

    private static OccupationQuestion occ(String id, OccupationContentStatus status, String difficulty,
                                          int minute, String text) {
        return OccupationQuestion.builder()
                .id(id)
                .occupationCode(CODE)
                .topicKey("t" + minute)
                .questionDe(text)
                .difficulty(difficulty)
                .status(status)
                .createdAt(LocalDateTime.of(2026, 10, 19, 10, minute))
                .build();
    }
}
