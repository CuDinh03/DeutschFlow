package com.deutschflow.speaking.interview;

import com.deutschflow.interview.entity.InterviewQuestion;
import com.deutschflow.interview.repository.InterviewQuestionRepository;
import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PersonaInterviewRegistryDbTest {

    @Mock
    private InterviewQuestionRepository questionRepository;

    // ── Gap 1: DB-backed question selection ───────────────────────────────────

    @Test
    void pickQuestion_usesDbRow_whenRepositoryReturnsResult() {
        InterviewQuestion dbQuestion = dbQuestion("db-weber-1", "WEBER", "HARD_SKILLS", "hygiene",
                "Nennen Sie einen Hygienevorfall aus der Praxis.");
        when(questionRepository.findByPersonaCodeAndPhaseAndActiveTrue("WEBER", "HARD_SKILLS"))
                .thenReturn(List.of(dbQuestion));

        PersonaInterviewRegistry registry = new PersonaInterviewRegistry(questionRepository);
        InterviewSessionState state = InterviewSessionState.initial(1, "Labor");

        Optional<InterviewQuestionDef> result = registry.pickQuestion(
                SpeakingPersona.WEBER, "MTA", InterviewPhase.HARD_SKILLS, state);

        assertThat(result).isPresent();
        assertThat(result.get().id()).isEqualTo("db-weber-1");
        assertThat(result.get().questionDe()).contains("Hygienevorfall");
    }

    @Test
    void pickQuestion_fallsBackToHardcoded_whenDbEmpty() {
        when(questionRepository.findByPersonaCodeAndPhaseAndActiveTrue("WEBER", "HARD_SKILLS"))
                .thenReturn(List.of());

        PersonaInterviewRegistry registry = new PersonaInterviewRegistry(questionRepository);
        InterviewSessionState state = InterviewSessionState.initial(1, "Labor");

        Optional<InterviewQuestionDef> result = registry.pickQuestion(
                SpeakingPersona.WEBER, "MTA", InterviewPhase.HARD_SKILLS, state);

        assertThat(result).isPresent();
        // Hardcoded WEBER questions start with "web_"
        assertThat(result.get().id()).startsWith("web_");
    }

    @Test
    void pickQuestion_skipsAlreadyAskedDbRows() {
        InterviewQuestion q1 = dbQuestion("db-1", "WEBER", "HARD_SKILLS", "hygiene", "Frage 1");
        InterviewQuestion q2 = dbQuestion("db-2", "WEBER", "HARD_SKILLS", "labor",  "Frage 2");
        when(questionRepository.findByPersonaCodeAndPhaseAndActiveTrue("WEBER", "HARD_SKILLS"))
                .thenReturn(List.of(q1, q2));

        PersonaInterviewRegistry registry = new PersonaInterviewRegistry(questionRepository);
        InterviewSessionState state = InterviewSessionState.initial(1, "Labor");
        state.getAskedQuestionIds().add("db-1");

        Optional<InterviewQuestionDef> result = registry.pickQuestion(
                SpeakingPersona.WEBER, "MTA", InterviewPhase.HARD_SKILLS, state);

        assertThat(result).isPresent();
        assertThat(result.get().id()).isEqualTo("db-2");
    }

    @Test
    void pickQuestion_noArgRegistry_fallsBackWithoutCrash() {
        // No-arg registry (used in tests without Spring) — must not NPE
        PersonaInterviewRegistry registry = new PersonaInterviewRegistry();
        InterviewSessionState state = InterviewSessionState.initial(1, "test");

        Optional<InterviewQuestionDef> result = registry.pickQuestion(
                SpeakingPersona.LUKAS, "Backend Dev", InterviewPhase.HARD_SKILLS, state);

        assertThat(result).isPresent();
    }

    // ── Gap 2: Adaptive follow-up (pickChallengeFollowUp) ────────────────────

    @Test
    void pickChallengeFollowUp_returnsSameTopicQuestion_whenAvailable() {
        InterviewQuestion sameTopic = dbQuestion("q-hygiene-2", "SARAH", "HARD_SKILLS", "hygiene",
                "Nennen Sie ein konkretes Hygieneproblem und Ihre Maßnahmen.");
        InterviewQuestion otherTopic = dbQuestion("q-termin-1", "SARAH", "HARD_SKILLS", "termin",
                "Wie organisieren Sie Termine?");
        when(questionRepository.findByPersonaCodeAndPhaseAndActiveTrue("SARAH", "HARD_SKILLS"))
                .thenReturn(List.of(sameTopic, otherTopic));

        PersonaInterviewRegistry registry = new PersonaInterviewRegistry(questionRepository);
        Optional<InterviewQuestionDef> followUp = registry.pickChallengeFollowUp(
                SpeakingPersona.SARAH, InterviewPhase.HARD_SKILLS, "hygiene", List.of());

        assertThat(followUp).isPresent();
        assertThat(followUp.get().topicKey()).isEqualTo("hygiene");
    }

    @Test
    void pickChallengeFollowUp_fallsBackToAnyUnasked_whenNoTopicMatch() {
        InterviewQuestion q = dbQuestion("q-termin-1", "SARAH", "HARD_SKILLS", "termin",
                "Wie organisieren Sie Termine?");
        when(questionRepository.findByPersonaCodeAndPhaseAndActiveTrue("SARAH", "HARD_SKILLS"))
                .thenReturn(List.of(q));

        PersonaInterviewRegistry registry = new PersonaInterviewRegistry(questionRepository);
        Optional<InterviewQuestionDef> followUp = registry.pickChallengeFollowUp(
                SpeakingPersona.SARAH, InterviewPhase.HARD_SKILLS, "hygiene", List.of());

        assertThat(followUp).isPresent();
        assertThat(followUp.get().id()).isEqualTo("q-termin-1");
    }

    @Test
    void pickChallengeFollowUp_emptyWhenNoRepoAvailable() {
        PersonaInterviewRegistry registry = new PersonaInterviewRegistry();
        Optional<InterviewQuestionDef> result = registry.pickChallengeFollowUp(
                SpeakingPersona.SARAH, InterviewPhase.HARD_SKILLS, "hygiene", List.of());
        assertThat(result).isEmpty();
    }

    // ── helper ────────────────────────────────────────────────────────────────

    private static InterviewQuestion dbQuestion(String id, String code, String phase,
                                                 String topic, String questionDe) {
        InterviewQuestion q = new InterviewQuestion();
        q.setId(id);
        q.setPersonaCode(code);
        q.setPhase(phase);
        q.setTopicKey(topic);
        q.setQuestionDe(questionDe);
        q.setActive(true);
        q.setVersion(1);
        return q;
    }
}
