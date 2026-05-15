package com.deutschflow.teacher.service;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.speaking.ai.GeminiApiClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherLessonPlanService {

    private final GeminiApiClient geminiApiClient;
    private final AsyncJobService asyncJobService;
    private final ObjectMapper objectMapper;

    private static final String PPTX_SYSTEM_PROMPT = """
            Bạn là một chuyên gia thiết kế bài giảng tiếng Đức.
            Người dùng cung cấp một tài liệu (PDF/Word). Hãy đọc hiểu tài liệu và tạo ra một cấu trúc bài thuyết trình PowerPoint (PPTX).
            Yêu cầu BẮT BUỘC trả về ĐÚNG định dạng JSON sau, KHÔNG thêm bất kỳ markdown (```json) nào:
            {
              "title": "Tiêu đề bài giảng",
              "slides": [
                {
                  "type": "TITLE",
                  "title": "Tiêu đề Slide",
                  "content": ["Nội dung 1", "Nội dung 2"]
                },
                {
                  "type": "CONTENT",
                  "title": "Tiêu đề Slide",
                  "content": ["Gạch đầu dòng 1", "Gạch đầu dòng 2"]
                }
              ]
            }
            """;

    @Async("taskExecutor")
    public void processDocumentToPptxAsync(UUID jobId, byte[] fileBytes, String mimeType) {
        log.info("[TeacherLessonPlanService] Starting PPTX generation for Job {}", jobId);
        asyncJobService.updateStatus(jobId, AsyncJob.Status.PROCESSING);

        try {
            // 1. Chuyển đổi file sang Base64
            String base64Doc = Base64.getEncoder().encodeToString(fileBytes);

            // 2. Gọi Gemini API lấy JSON
            String jsonResponse = geminiApiClient.generateJsonFromDocument(PPTX_SYSTEM_PROMPT, base64Doc, mimeType);
            log.debug("[TeacherLessonPlanService] Gemini returned JSON: {}", jsonResponse);

            // 3. Parse JSON & Xây dựng PPTX
            JsonNode rootNode = objectMapper.readTree(jsonResponse);
            if (!rootNode.has("slides") || !rootNode.get("slides").isArray()) {
                throw new IllegalStateException("Invalid JSON structure returned from AI.");
            }

            try (XMLSlideShow ppt = new XMLSlideShow()) {
                for (JsonNode slideNode : rootNode.get("slides")) {
                    XSLFSlide slide = ppt.createSlide();
                    
                    // Simple Title layout for now
                    XSLFTextShape titleShape = slide.createTextBox();
                    titleShape.setAnchor(new java.awt.Rectangle(50, 50, 600, 50));
                    titleShape.setText(slideNode.path("title").asText("Untitled"));

                    // Content layout
                    if (slideNode.has("content") && slideNode.get("content").isArray()) {
                        XSLFTextShape contentShape = slide.createTextBox();
                        contentShape.setAnchor(new java.awt.Rectangle(50, 150, 600, 300));
                        StringBuilder contentBuilder = new StringBuilder();
                        for (JsonNode bullet : slideNode.get("content")) {
                            contentBuilder.append("• ").append(bullet.asText()).append("\n");
                        }
                        contentShape.setText(contentBuilder.toString());
                    }
                }

                // 4. Xuất ra ByteArray
                try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    ppt.write(out);
                    byte[] pptxBytes = out.toByteArray();
                    
                    // 5. Lưu vào DB (Vì file PPTX sinh ra thường nhẹ < 1MB, lưu Base64 vào DB tạm thời là ổn)
                    // Nếu file lớn, nên đẩy lên S3 và lưu URL.
                    String pptxBase64 = Base64.getEncoder().encodeToString(pptxBytes);
                    
                    // Lưu dưới dạng JSON để frontend dễ parse
                    String resultPayload = objectMapper.writeValueAsString(Map.of(
                            "fileName", rootNode.path("title").asText("Bài giảng") + ".pptx",
                            "fileData", pptxBase64
                    ));
                    
                    asyncJobService.completeJob(jobId, resultPayload);
                    log.info("[TeacherLessonPlanService] Completed PPTX generation for Job {}", jobId);
                }
            }

        } catch (JsonProcessingException e) {
            log.error("[TeacherLessonPlanService] JSON parse error for Job {}: {}", jobId, e.getMessage());
            asyncJobService.failJob(jobId, "AI returned invalid JSON: " + e.getMessage());
        } catch (Exception e) {
            log.error("[TeacherLessonPlanService] Error processing Job {}: {}", jobId, e.getMessage(), e);
            asyncJobService.failJob(jobId, "Lỗi hệ thống: " + e.getMessage());
        }
    }
}
