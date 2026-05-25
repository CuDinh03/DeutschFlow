package com.deutschflow.teacher.service;

import com.deutschflow.speaking.ai.AiCacheService;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.teacher.dto.StudentPerformanceAnalyticsDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherAdvisoryService {

    private final AiCacheService aiCacheService;
    private final ObjectMapper objectMapper;

    private static final String ADVISORY_SYSTEM_PROMPT = """
            Bạn là một Chuyên gia Cố vấn Sư phạm Tiếng Đức.
            Dưới đây là số liệu phân tích của một học sinh: Before (Trước khi vào lớp) và In-Class (Sau khi vào lớp).
            Dựa trên các lỗi sai thường gặp và sự tiến bộ, hãy viết một Báo cáo Lộ trình (Action Plan) ngắn gọn (dưới 300 chữ) dành cho giáo viên, bao gồm:
            1. Điểm mạnh và sự tiến bộ.
            2. Điểm yếu cần khắc phục ngay.
            3. Đề xuất phương pháp tiếp cận / bài tập cụ thể cho tuần tới.
            KHÔNG sử dụng markdown format quá phức tạp, chỉ dùng gạch đầu dòng cơ bản.
            """;

    public String generateAdvisoryReport(StudentPerformanceAnalyticsDto analytics) {
        try {
            String studentDataJson = objectMapper.writeValueAsString(analytics);

            List<ChatMessage> messages = new ArrayList<>();
            messages.add(new ChatMessage("system", ADVISORY_SYSTEM_PROMPT));
            messages.add(new ChatMessage("user", "Dữ liệu học sinh: " + studentDataJson));

            // Use temperature 0.4 for slightly creative but structured advice
            return aiCacheService.getCachedChatCompletion(messages, "gpt-4o-mini", 0.4, 800).content();
        } catch (Exception e) {
            log.error("Failed to generate advisory report", e);
            return "Không thể tạo đề xuất AI lúc này. Vui lòng thử lại sau.";
        }
    }
}
