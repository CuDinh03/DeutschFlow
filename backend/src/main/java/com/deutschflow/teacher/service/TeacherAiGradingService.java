package com.deutschflow.teacher.service;

import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherAiGradingService {

    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final OpenAiChatClient openAiChatClient;
    private final com.deutschflow.teacher.repository.StudentAssignmentRepository studentAssignmentRepository;
    private final com.deutschflow.common.quota.AiUsageLedgerService aiUsageLedgerService;

    @Async("taskExecutor")
    public void autoGradeSession(Long sessionId) {
        log.info("[Auto-Grading] Start async grading for session {}", sessionId);
        try {
            // Bước 1: Đọc dữ liệu nhanh
            AiSpeakingSession session = sessionRepository.findById(sessionId).orElse(null);
            if (session == null) return;

            List<AiSpeakingMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
            if (messages.size() <= 2) {
                log.info("[Auto-Grading] Session {} has too few messages, skipping", sessionId);
                return;
            }

            StringBuilder transcript = new StringBuilder();
            for (AiSpeakingMessage msg : messages) {
                String role = msg.getRole() == AiSpeakingMessage.MessageRole.USER ? "Student" : "AI Tutor";
                String text = msg.getRole() == AiSpeakingMessage.MessageRole.USER ? msg.getUserText() : msg.getAiSpeechDe();
                transcript.append(role).append(": ").append(text).append("\n");
            }

            // Groq runs in forced JSON mode (response_format=json_object): the prompt MUST request
            // JSON and contain the word "json", else Groq returns HTTP 400 and the grade silently
            // never completes. Ask for a strict JSON object and parse it (with a text fallback).
            String prompt = """
                    Bạn là một giám khảo chấm thi nói tiếng Đức.
                    Dưới đây là đoạn hội thoại giữa Học sinh và AI Tutor.
                    Đánh giá trình độ nói của học sinh theo thang điểm 100.
                    Trả về DUY NHẤT một JSON object hợp lệ (không markdown) đúng định dạng:
                    {"score": <số nguyên 0-100>, "feedback": "<nhận xét tiếng Việt>"}

                    Đoạn hội thoại:
                    %s
                    """.formatted(transcript.toString());

            // Bước 2: Gọi OpenAI API (Tốn thời gian)
            List<ChatMessage> openAiMessages = new ArrayList<>();
            openAiMessages.add(new ChatMessage("user", prompt));

            AiChatCompletionResult aiResult = openAiChatClient.chatCompletion(openAiMessages, null, 0.3, 1000);
            
            if (aiResult == null || aiResult.content() == null) {
                log.warn("[Auto-Grading] AI response is null for session {}", sessionId);
                markSpeakingGradingFailed(session, "AI trả về kết quả rỗng");
                return;
            }

            String content = aiResult.content();
            Integer aiScore = AiGradeResultParser.parseScore(content);
            String aiFeedback = AiGradeResultParser.parseFeedback(content);

            if (aiScore == null) {
                String snippet = content.length() > 200 ? content.substring(0, 200) : content;
                log.warn("[Auto-Grading] Could not read score for session {}. Raw: {}", sessionId, snippet.replaceAll("\\s+", " "));
                markSpeakingGradingFailed(session, "Không đọc được điểm từ phản hồi AI");
                return;
            }

            // Bước 4: Lưu kết quả
            session.setAiScore(aiScore);
            session.setAiFeedback(aiFeedback);
            sessionRepository.save(session);

            // Best-effort cost-ledger record so this AI call shows up in admin cost accounting.
            recordSpeakingGradingUsage(session.getUserId(), session.getId(), aiResult);

            log.info("[Auto-Grading] Successfully graded session {} with score {}", sessionId, aiScore);

            // Bước 5: Cập nhật StudentAssignment nếu đây là phiên liên kết với bài tập
            if (session.getAssignmentId() != null) {
                final Integer finalAiScore = aiScore;
                final String finalAiFeedback = aiFeedback;
                studentAssignmentRepository.findById(session.getAssignmentId()).ifPresent(sa -> {
                    sa.setScore(finalAiScore);
                    sa.setFeedback(finalAiFeedback);
                    sa.setStatus("GRADED");
                    sa.setSubmittedAt(java.time.LocalDateTime.now());
                    studentAssignmentRepository.save(sa);
                    log.info("[Auto-Grading] Updated StudentAssignment {} with AI score", sa.getId());
                });
            }

        } catch (Exception e) {
            log.error("[Auto-Grading] Error grading session {}", sessionId, e);
            sessionRepository.findById(sessionId).ifPresent(s ->
                    markSpeakingGradingFailed(s, e.getClass().getSimpleName() + ": " + e.getMessage()));
        }
    }

    /**
     * Surface an auto-grading failure on the session (and any linked assignment) instead of
     * leaving the session silently ungraded. The linked assignment becomes GRADING_FAILED so it
     * stays visible in the teacher's grading queue for a manual grade.
     */
    private void markSpeakingGradingFailed(AiSpeakingSession session, String reason) {
        if (session == null) return;
        String r = (reason == null || reason.isBlank()) ? "không rõ nguyên nhân" : reason;
        if (r.length() > 480) r = r.substring(0, 480);
        try {
            session.setAiFeedback("[AI chấm lỗi] " + r);
            sessionRepository.save(session);
        } catch (Exception persistErr) {
            log.warn("[Auto-Grading] Could not persist failure note for session {}: {}", session.getId(), persistErr.toString());
        }
        if (session.getAssignmentId() != null) {
            final String reasonFinal = r;
            try {
                studentAssignmentRepository.findById(session.getAssignmentId()).ifPresent(sa -> {
                    if ("EVALUATED".equals(sa.getStatus()) || "GRADED".equals(sa.getStatus())) return;
                    sa.setStatus("GRADING_FAILED");
                    sa.setFeedback("[AI chấm lỗi] " + reasonFinal);
                    studentAssignmentRepository.save(sa);
                });
            } catch (Exception persistErr) {
                log.warn("[Auto-Grading] Could not mark linked assignment failed for session {}: {}", session.getId(), persistErr.toString());
            }
        }
    }

    /** Best-effort cost-ledger record. Never throws into the grading flow. */
    private void recordSpeakingGradingUsage(Long userId, Long sessionId, AiChatCompletionResult result) {
        if (userId == null || result == null || result.usage() == null) return;
        try {
            aiUsageLedgerService.record(
                    userId,
                    result.provider() != null ? result.provider() : "GROQ",
                    result.model() != null ? result.model() : "unknown",
                    result.usage().promptTokens(),
                    result.usage().completionTokens(),
                    result.usage().totalTokens(),
                    "TEACHER_AI_SPEAKING_GRADING",
                    null,
                    sessionId
            );
        } catch (Exception e) {
            log.warn("[Auto-Grading] Could not record AI usage (non-fatal): {}", e.toString());
        }
    }
}
