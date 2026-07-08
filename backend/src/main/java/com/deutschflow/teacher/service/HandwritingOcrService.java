package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.GeminiApiClient;
import com.deutschflow.speaking.exception.AiServiceException;
import com.deutschflow.teacher.dto.GradeImageResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Chấm ảnh bài viết TAY (checklist D2): ảnh → Gemini vision OCR → chấm bằng đúng model chấm
 * ({@link GradingService#gradeGermanEssay}) như bài gõ máy ⇒ handwritten và typed cùng một rubric/model.
 *
 * <p>Khớp thực tế lớp giấy ở VN (đối thủ Azota/DeutschExam/Cornelsen đều đã có OCR). Giáo viên nên
 * rà lại {@code transcription} trước khi chốt — OCR chữ viết tay không bao giờ 100%.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HandwritingOcrService {

    /** Ảnh Gemini chấp nhận qua inlineData. */
    static final Set<String> SUPPORTED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/heic");

    private static final int OCR_TIMEOUT_SECONDS = 45;

    /** Ước lượng token cho lượt OCR (Gemini vision) — API không trả usage nên ghi ước lượng cố định. */
    private static final int OCR_ESTIMATED_TOKENS = 8_000;

    /**
     * Prompt OCR-only (forced JSON; chứa "json"): trích nguyên văn tiếng Đức, giữ xuống dòng,
     * KHÔNG sửa lỗi chính tả/ngữ pháp (để bước chấm còn thấy lỗi thật của học viên).
     */
    private static final String OCR_PROMPT = """
            Bạn là công cụ OCR cho bài viết tay tiếng Đức.
            Hãy trích XUẤT NGUYÊN VĂN phần chữ viết tay tiếng Đức trong ảnh, giữ nguyên xuống dòng.
            KHÔNG sửa lỗi chính tả, ngữ pháp hay dấu câu — chép đúng những gì học viên viết.
            Trả về DUY NHẤT một JSON object hợp lệ: {"text": "<nguyên văn bài viết>"}.
            Nếu ảnh không có chữ tiếng Đức đọc được, trả {"text": ""}.
            """;

    private final GeminiApiClient geminiApiClient;
    private final ObjectMapper objectMapper;
    private final GradingService gradingService;
    private final AiUsageLedgerService aiUsageLedgerService;

    /** OCR ảnh → văn bản tiếng Đức (đã trim). Rỗng nếu ảnh không có chữ đọc được. */
    public String ocr(byte[] imageBytes, String mimeType) {
        if (imageBytes == null || imageBytes.length == 0) {
            throw new BadRequestException("Ảnh trống.");
        }
        if (mimeType == null || !SUPPORTED_IMAGE_TYPES.contains(mimeType.toLowerCase())) {
            throw new BadRequestException("Chỉ hỗ trợ ảnh JPEG/PNG/WEBP/HEIC.");
        }
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        String raw;
        try {
            raw = geminiApiClient.generateJsonFromDocument(OCR_PROMPT, base64, mimeType)
                    .get(OCR_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("[OCR] Gemini OCR thất bại: {}", e.getMessage());
            throw new AiServiceException("Không đọc được ảnh lúc này. Vui lòng thử lại hoặc nhập tay.");
        }
        return parseTranscription(raw, objectMapper);
    }

    /** OCR rồi chấm luôn bằng model chấm cấu hình. Ném 400 nếu ảnh không có chữ đọc được. */
    public GradeImageResponse ocrAndGrade(byte[] imageBytes, String mimeType, String topic, Long teacherUserId) {
        String transcription = ocr(imageBytes, mimeType);
        if (transcription.isBlank()) {
            throw new BadRequestException("Không tìm thấy chữ tiếng Đức trong ảnh. Vui lòng chụp rõ hơn.");
        }
        GradingService.EssayGrade grade = gradingService.gradeGermanEssay(topic, transcription);
        if (grade.score() == null) {
            throw new AiServiceException("Đọc được bài nhưng AI chấm chưa xong. Vui lòng thử lại.");
        }
        // Charge the org pool for BOTH the Gemini OCR (fixed estimate) and the text grade (real usage);
        // previously image grading advanced the pool counter by neither, so it systematically under-billed.
        recordOcrGradeUsage(teacherUserId, grade.raw());
        String feedback = (grade.feedback() == null || grade.feedback().isBlank())
                ? "Đã chấm. Rà lại phần OCR nếu cần."
                : grade.feedback();
        return new GradeImageResponse(transcription, grade.score(), feedback);
    }

    /** Best-effort ledger record for an OCR-grade (OCR estimate + real text-grade usage). Never throws. */
    private void recordOcrGradeUsage(Long teacherUserId, AiChatCompletionResult textGrade) {
        if (teacherUserId == null) return;
        try {
            aiUsageLedgerService.record(teacherUserId, "GEMINI", "gemini-ocr",
                    OCR_ESTIMATED_TOKENS, 0, OCR_ESTIMATED_TOKENS, "TEACHER_OCR_GRADE", null, null);
        } catch (Exception e) {
            log.warn("[OCR] Không ghi được usage OCR (non-fatal): {}", e.toString());
        }
        if (textGrade != null && textGrade.usage() != null) {
            try {
                aiUsageLedgerService.record(teacherUserId,
                        textGrade.provider() != null ? textGrade.provider() : "GROQ",
                        textGrade.model() != null ? textGrade.model() : "unknown",
                        textGrade.usage().promptTokens(), textGrade.usage().completionTokens(),
                        textGrade.usage().totalTokens(), "TEACHER_OCR_TEXT_GRADE", null, null);
            } catch (Exception e) {
                log.warn("[OCR] Không ghi được usage chấm-text (non-fatal): {}", e.toString());
            }
        }
    }

    /** Trích {@code text} từ JSON Gemini trả về; chịu được khi model bọc ```json hoặc thêm chữ. */
    static String parseTranscription(String rawJson, ObjectMapper mapper) {
        if (rawJson == null || rawJson.isBlank()) {
            return "";
        }
        String cleaned = rawJson.trim();
        // Bóc code fence nếu có
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceAll("(?s)```(?:json)?", "").trim();
        }
        try {
            JsonNode node = mapper.readTree(cleaned);
            JsonNode text = node.get("text");
            if (text != null && text.isTextual()) {
                return text.asText().trim();
            }
        } catch (Exception ignored) {
            // fallback: cố tách {...} đầu tiên
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                try {
                    JsonNode node = mapper.readTree(cleaned.substring(start, end + 1));
                    JsonNode text = node.get("text");
                    if (text != null && text.isTextual()) {
                        return text.asText().trim();
                    }
                } catch (Exception ignored2) {
                    // bỏ qua → trả rỗng
                }
            }
        }
        return "";
    }
}
