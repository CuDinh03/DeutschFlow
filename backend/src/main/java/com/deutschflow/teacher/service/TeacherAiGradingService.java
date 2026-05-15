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

    @Async
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

            // Dặn AI không dùng markdown và trả đúng định dạng
            String prompt = """
                    Bạn là một Giám khảo chấm thi tiếng Đức.
                    Dưới đây là đoạn hội thoại giữa Học sinh và AI Tutor.
                    Hãy đánh giá trình độ nói của học sinh theo thang điểm 100.
                    Tuyệt đối không sử dụng markdown (không dùng ký hiệu ```). Trả về chính xác định dạng 2 dòng:
                    SCORE: [Điểm số 0-100]
                    FEEDBACK: [Nhận xét tiếng Việt]
                    
                    Đoạn hội thoại:
                    %s
                    """.formatted(transcript.toString());

            // Bước 2: Gọi OpenAI API (Tốn thời gian)
            List<ChatMessage> openAiMessages = new ArrayList<>();
            openAiMessages.add(new ChatMessage("user", prompt));

            AiChatCompletionResult aiResult = openAiChatClient.chatCompletion(openAiMessages, null, 0.3, 1000);
            
            if (aiResult == null || aiResult.content() == null) {
                log.warn("[Auto-Grading] AI response is null for session {}", sessionId);
                return;
            }
            
            String content = aiResult.content();
            Integer aiScore = null;
            String aiFeedback = "Không có nhận xét.";

            // Bước 3: Parse kết quả an toàn bằng Regex và Xử lý chuỗi
            try {
                // Lấy điểm số bằng regex (tìm số ngay sau SCORE:)
                java.util.regex.Matcher scoreMatcher = java.util.regex.Pattern.compile("(?i)SCORE:\\s*(\\d+)").matcher(content);
                if (scoreMatcher.find()) {
                    aiScore = Integer.parseInt(scoreMatcher.group(1));
                }

                // Lấy phần feedback
                java.util.regex.Matcher feedbackMatcher = java.util.regex.Pattern.compile("(?i)FEEDBACK:\\s*(.*)", java.util.regex.Pattern.DOTALL).matcher(content);
                if (feedbackMatcher.find()) {
                    aiFeedback = feedbackMatcher.group(1).trim();
                } else if (content.toUpperCase().contains("FEEDBACK:")) {
                     aiFeedback = content.substring(content.toUpperCase().indexOf("FEEDBACK:") + 9).trim();
                }
            } catch (Exception e) {
                log.warn("[Auto-Grading] Failed to parse AI response for session {}. Raw content: {}. Error: {}", sessionId, content, e.getMessage());
            }

            // Bước 4: Lưu kết quả
            session.setAiScore(aiScore);
            session.setAiFeedback(aiFeedback);
            sessionRepository.save(session);
            log.info("[Auto-Grading] Successfully graded session {} with score {}", sessionId, aiScore);

        } catch (Exception e) {
            log.error("[Auto-Grading] Error grading session {}", sessionId, e);
        }
    }
}
