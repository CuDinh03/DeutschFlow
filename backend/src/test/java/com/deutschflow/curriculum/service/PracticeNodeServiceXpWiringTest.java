package com.deutschflow.curriculum.service;

import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Verifies that submitPracticeSession awards XP via XpService when score >= 60%
 * and skips the award otherwise. This protects the wiring added when the
 * xp_earned column was being persisted but the gamification side-effects
 * (leaderboard cache evict, level-up, achievement check) were silently skipped.
 */
@ExtendWith(MockitoExtension.class)
class PracticeNodeServiceXpWiringTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock GroqChatClient groqChatClient;
    @Mock AiUsageLedgerService aiUsageLedgerService;
    @Mock AsyncJobService asyncJobService;
    @Mock XpService xpService;
    @Mock com.deutschflow.srs.service.SrsVocabScheduler srsVocabScheduler;

    ObjectMapper objectMapper = new ObjectMapper();

    PracticeNodeService service;

    @BeforeEach
    void setUp() {
        service = new PracticeNodeService(
                jdbcTemplate,
                groqChatClient,
                aiUsageLedgerService,
                objectMapper,
                asyncJobService,
                xpService,
                srsVocabScheduler
        );
    }

    private Map<String, Object> openSession(String skillType) {
        Map<String, Object> session = new HashMap<>();
        session.put("id", 42L);
        session.put("user_id", 7L);
        session.put("status", "IN_PROGRESS");
        session.put("skill_type", skillType);
        session.put("source_node_id", 100L);
        return session;
    }

    @Test
    void awardsXpWhenScoreMeetsThreshold() {
        long userId = 7L;
        long sessionId = 42L;

        when(jdbcTemplate.queryForList(anyString(), eq(sessionId), eq(userId)))
                .thenReturn(List.of(openSession("HOEREN")));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyLong(), anyLong(), anyString()))
                .thenReturn(3);

        Map<String, Object> result = service.submitPracticeSession(
                userId, sessionId, Map.of("score_percent", 75)
        );

        ArgumentCaptor<Integer> xpCaptor = ArgumentCaptor.forClass(Integer.class);
        ArgumentCaptor<String> noteCaptor = ArgumentCaptor.forClass(String.class);
        verify(xpService).awardCustomPractice(eq(userId), xpCaptor.capture(), noteCaptor.capture());

        assertThat(xpCaptor.getValue()).isEqualTo(30);
        assertThat(noteCaptor.getValue()).contains("HOEREN");
        assertThat(result).containsEntry("xpEarned", 30);
        assertThat(result).containsEntry("status", "COMPLETED");
    }

    @Test
    void skipsXpAwardWhenScoreBelowThreshold() {
        long userId = 7L;
        long sessionId = 42L;

        when(jdbcTemplate.queryForList(anyString(), eq(sessionId), eq(userId)))
                .thenReturn(List.of(openSession("LESEN")));
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), anyLong(), anyLong(), anyString()))
                .thenReturn(1);

        Map<String, Object> result = service.submitPracticeSession(
                userId, sessionId, Map.of("score_percent", 40)
        );

        verify(xpService, never()).awardCustomPractice(anyLong(), anyInt(), anyString());
        assertThat(result).containsEntry("xpEarned", 0);
        assertThat(result).containsEntry("status", "COMPLETED");
    }

    @Test
    void throwsWhenSessionAlreadyCompleted() {
        long userId = 7L;
        long sessionId = 42L;

        Map<String, Object> finished = openSession("SPRECHEN");
        finished.put("status", "COMPLETED");
        when(jdbcTemplate.queryForList(anyString(), eq(sessionId), eq(userId)))
                .thenReturn(List.of(finished));

        assertThatThrownBy(() -> service.submitPracticeSession(
                userId, sessionId, Map.of("score_percent", 90)
        )).isInstanceOf(BadRequestException.class);

        verify(xpService, never()).awardCustomPractice(anyLong(), anyInt(), anyString());
    }

    @Test
    void throwsWhenSessionMissing() {
        long userId = 7L;
        long sessionId = 99L;

        when(jdbcTemplate.queryForList(anyString(), eq(sessionId), eq(userId)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.submitPracticeSession(
                userId, sessionId, Map.of("score_percent", 90)
        )).isInstanceOf(NotFoundException.class);

        verify(xpService, never()).awardCustomPractice(anyLong(), anyInt(), anyString());
    }
}
