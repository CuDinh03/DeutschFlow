package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewTurn;
import com.deutschflow.interview.repository.InterviewTurnRepository;
import com.deutschflow.speaking.interview.InterviewAnswerAnalysis;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Persists each interview turn to {@code interview_turn} for analytics and report generation.
 * Runs in a separate transaction so a persistence failure never aborts the main chat flow.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewTurnPersistenceService {

    private final InterviewTurnRepository turnRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveTurn(
            Long sessionId,
            int turnIndex,
            InterviewTurnPlan plan,
            String userAnswer,
            String aiFollowUp,
            InterviewAnswerAnalysis analysis,
            Integer latencyMs) {
        try {
            InterviewTurn turn = InterviewTurn.builder()
                    .sessionId(sessionId)
                    .turnIndex(turnIndex)
                    .phase(plan.phase().name())
                    .questionId(plan.questionId())
                    .questionText(plan.mandatoryQuestion())
                    .userAnswer(userAnswer)
                    .aiFollowUp(aiFollowUp)
                    .answerAnalysisJson(toJson(analysis))
                    .directiveType(plan.directive().name())
                    .latencyMs(latencyMs)
                    .build();
            turnRepository.save(turn);
        } catch (Exception e) {
            log.warn("Failed to persist interview turn {}/{}: {}", sessionId, turnIndex, e.getMessage());
        }
    }

    public List<InterviewTurn> getTurnsForSession(Long sessionId) {
        return turnRepository.findBySessionIdOrderByTurnIndexAsc(sessionId);
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize value: {}", e.getMessage());
            return null;
        }
    }
}
