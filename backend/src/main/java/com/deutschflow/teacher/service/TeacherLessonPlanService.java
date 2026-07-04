package com.deutschflow.teacher.service;

import com.deutschflow.common.async.AsyncJob;
import com.deutschflow.common.async.AsyncJobService;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.GeminiApiClient;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.sl.usermodel.TextParagraph;
import java.util.HashMap;
import org.apache.poi.xslf.usermodel.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.awt.*;
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
    private final PptxStore pptxStore;
    private final GoogleSlidesService googleSlidesService;
    private final AiUsageLedgerService aiUsageLedgerService;

    /**
     * Token-tương-đương cho 1 lần tạo PPTX (Gemini đọc tài liệu + sinh slide) — khớp với
     * {@code PPTX_ESTIMATED_TOKENS} mà TeacherMaterialController dùng ở bước gate. Trừ vào org
     * pool + ví sau khi tạo thành công (audit H-2: trước đây gate nhưng KHÔNG trừ gì).
     */
    private static final long PPTX_CHARGED_TOKENS = 40_000L;

    // ── Slide dimensions: 16:9 widescreen (720 × 405 pt = 10in × 5.625in) ──
    private static final int SLIDE_W = 720;
    private static final int SLIDE_H = 405;

    // ── Brand color palette ───────────────────────────────────────────────────
    // Primary: Indigo gradient
    private static final Color C_INDIGO_900 = new Color(0x312E81);
    private static final Color C_INDIGO_700 = new Color(0x4338CA);
    private static final Color C_INDIGO_600 = new Color(0x4F46E5);
    private static final Color C_INDIGO_500 = new Color(0x6366F1);
    private static final Color C_INDIGO_100 = new Color(0xE0E7FF);
    private static final Color C_INDIGO_50  = new Color(0xEEF2FF);
    // Accent: Violet
    private static final Color C_VIOLET_600 = new Color(0x7C3AED);
    private static final Color C_VIOLET_400 = new Color(0xA78BFA);
    // Neutral
    private static final Color C_SLATE_900  = new Color(0x0F172A);
    private static final Color C_SLATE_700  = new Color(0x334155);
    private static final Color C_SLATE_500  = new Color(0x64748B);
    private static final Color C_SLATE_200  = new Color(0xE2E8F0);
    private static final Color C_SLATE_50   = new Color(0xF8FAFC);
    private static final Color C_WHITE      = Color.WHITE;
    // Semantic
    private static final Color C_GREEN_600  = new Color(0x16A34A);
    private static final Color C_GREEN_50   = new Color(0xF0FDF4);
    private static final Color C_AMBER_600  = new Color(0xD97706);
    private static final Color C_AMBER_50   = new Color(0xFFFBEB);

    // ── Prompt ───────────────────────────────────────────────────────────────
    private static final String PPTX_SYSTEM_PROMPT = """
        Bạn là chuyên gia thiết kế bài giảng tiếng Đức chuẩn CEFR (A1–C2) với 10 năm kinh nghiệm.
        Nhiệm vụ: Đọc hiểu tài liệu được cung cấp và tạo ra một bài thuyết trình PowerPoint
        chuyên nghiệp, đầy đủ nghiệp vụ sư phạm, phù hợp để giảng dạy trực tiếp trên lớp.

        ═══ QUY TẮC NỘI DUNG ═══
        1. Phân tích tài liệu và xác định: chủ đề chính, cấp độ CEFR, mục tiêu học tập.
        2. Cấu trúc bài giảng theo trình tự sư phạm chuẩn:
           - Slide 1: TITLE — Tiêu đề + cấp độ CEFR + mục tiêu tổng quát
           - Slide 2: AGENDA — Nội dung sẽ học (4–6 mục)
           - Slide 3+: SECTION — Đánh dấu chuyển phần lớn (nếu có nhiều chủ đề)
           - Slide nội dung: CONTENT — Kiến thức lý thuyết, ngữ pháp, từ vựng
           - Slide ví dụ: EXAMPLE — Câu ví dụ thực tế, đối thoại mẫu
           - Slide hai cột: TWO_COLUMN — So sánh (VD: Deutsch vs Vietnamesisch, Singular vs Plural)
           - Slide cuối: SUMMARY — Tóm tắt + bài tập về nhà
        3. Mỗi slide CONTENT: 4–6 bullet points, súc tích, không quá 12 từ/bullet.
        4. Slide EXAMPLE: left = câu tiếng Đức, right = nghĩa tiếng Việt.
        5. Slide TWO_COLUMN: left_title + left_items, right_title + right_items.
        6. Tổng số slide: 8–15 slide (không ít hơn 8, không nhiều hơn 15).
        7. Ngôn ngữ: tiêu đề và nội dung chính bằng tiếng Đức (nếu phù hợp),
           chú thích/giải thích bằng tiếng Việt.

        ═══ QUY TẮC JSON ═══
        Trả về ĐÚNG định dạng JSON sau. KHÔNG thêm markdown (```json), KHÔNG thêm text ngoài JSON.

        {
          "title": "Tiêu đề bài giảng",
          "level": "A1",
          "duration_minutes": 45,
          "slides": [
            {
              "type": "TITLE",
              "title": "Tiêu đề chính",
              "subtitle": "Cấp độ A1 · 45 phút",
              "objectives": ["Mục tiêu 1", "Mục tiêu 2", "Mục tiêu 3"]
            },
            {
              "type": "AGENDA",
              "title": "Nội dung bài học",
              "items": ["Phần 1: ...", "Phần 2: ...", "Phần 3: ...", "Phần 4: ..."]
            },
            {
              "type": "SECTION",
              "title": "Tên phần",
              "subtitle": "Mô tả ngắn về phần này"
            },
            {
              "type": "CONTENT",
              "title": "Tiêu đề slide",
              "content": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"]
            },
            {
              "type": "EXAMPLE",
              "title": "Ví dụ thực tế",
              "left_title": "Auf Deutsch",
              "left_items": ["Guten Morgen!", "Wie heißen Sie?"],
              "right_title": "Tiếng Việt",
              "right_items": ["Chào buổi sáng!", "Bạn tên là gì?"]
            },
            {
              "type": "TWO_COLUMN",
              "title": "So sánh",
              "left_title": "Cột trái",
              "left_items": ["Item A1", "Item A2"],
              "right_title": "Cột phải",
              "right_items": ["Item B1", "Item B2"]
            },
            {
              "type": "SUMMARY",
              "title": "Tổng kết",
              "key_points": ["Điểm chính 1", "Điểm chính 2", "Điểm chính 3"],
              "homework": "Bài tập về nhà cụ thể"
            }
          ]
        }
        """;


    // ── Async entry point ─────────────────────────────────────────────────────
    @Async("taskExecutor")
    public void processDocumentToPptxAsync(UUID jobId, Long userId, byte[] fileBytes, String mimeType) {
        log.info("[LessonPlan] Starting PPTX generation for Job {}", jobId);
        asyncJobService.updateStatus(jobId, AsyncJob.Status.PROCESSING);

        try {
            String base64Doc = Base64.getEncoder().encodeToString(fileBytes);
            String jsonResponse = geminiApiClient
                    .generateJsonFromDocument(PPTX_SYSTEM_PROMPT, base64Doc, mimeType)
                    .join();
            log.debug("[LessonPlan] Gemini JSON length: {}", jsonResponse.length());

            // Strip accidental markdown fences if Gemini adds them
            String cleaned = jsonResponse.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```[a-z]*\\n?", "").replaceAll("```$", "").trim();
            }

            JsonNode root = objectMapper.readTree(cleaned);
            if (!root.has("slides") || !root.get("slides").isArray()) {
                throw new IllegalStateException("Invalid JSON: missing 'slides' array.");
            }

            String fileName = root.path("title").asText("Bài giảng") + ".pptx";
            byte[] pptxBytes;
            int slideCount = root.get("slides").size();

            if (googleSlidesService.isAvailable()) {
                // ── Google Slides API path (chất lượng cao) ──────────────────
                log.info("[LessonPlan] Using Google Slides API for Job {}", jobId);
                pptxBytes = googleSlidesService.createPptx(root);
            } else {
                // ── Apache POI fallback ───────────────────────────────────────
                log.info("[LessonPlan] Using Apache POI fallback for Job {}", jobId);
                try (XMLSlideShow ppt = new XMLSlideShow()) {
                    ppt.setPageSize(new Dimension(SLIDE_W, SLIDE_H));
                    for (JsonNode slideNode : root.get("slides")) {
                        String type = slideNode.path("type").asText("CONTENT").toUpperCase();
                        XSLFSlide slide = ppt.createSlide();
                        switch (type) {
                            case "TITLE"      -> buildTitleSlide(slide, slideNode);
                            case "AGENDA"     -> buildAgendaSlide(slide, slideNode);
                            case "SECTION"    -> buildSectionSlide(slide, slideNode);
                            case "EXAMPLE",
                                 "TWO_COLUMN" -> buildTwoColumnSlide(slide, slideNode, type);
                            case "SUMMARY"    -> buildSummarySlide(slide, slideNode);
                            default           -> buildContentSlide(slide, slideNode);
                        }
                    }
                    try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                        ppt.write(out);
                        pptxBytes = out.toByteArray();
                    }
                }
            }

            pptxStore.put(jobId, pptxBytes, fileName);
            String payload = objectMapper.writeValueAsString(Map.of(
                    "fileName", fileName,
                    "ready", true
            ));
            asyncJobService.completeJob(jobId, payload);
            log.info("[LessonPlan] Completed PPTX ({} slides, {} KB) via {} for Job {}",
                    slideCount, pptxBytes.length / 1024,
                    googleSlidesService.isAvailable() ? "GoogleSlides" : "POI", jobId);

            // B2B-COGS (audit H-2): trừ token-tương-đương PPTX vào org pool + ví CHỈ khi tạo
            // thành công (best-effort). No-op cho GV B2C không thuộc org / plan không có ví.
            if (userId != null) {
                try {
                    aiUsageLedgerService.record(
                            userId, "GOOGLE", "gemini-1.5-flash",
                            0, (int) PPTX_CHARGED_TOKENS, (int) PPTX_CHARGED_TOKENS,
                            "TEACHER_PPTX_GEN", null, null);
                } catch (Exception e) {
                    log.warn("[LessonPlan] Could not record AI usage for PPTX (non-fatal): {}", e.toString());
                }
            }

        } catch (JsonProcessingException e) {
            log.error("[LessonPlan] JSON parse error for Job {}: {}", jobId, e.getMessage());
            asyncJobService.failJob(jobId, "AI returned invalid JSON: " + e.getMessage());
        } catch (Exception e) {
            log.error("[LessonPlan] Error for Job {}: {}", jobId, e.getMessage(), e);
            asyncJobService.failJob(jobId, "Lỗi hệ thống: " + e.getMessage());
        }
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // SLIDE BUILDERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * TITLE slide — full indigo gradient background, centered title + subtitle + objectives.
     * Layout: decorative top bar | big title | subtitle | 3 objective chips at bottom
     */
    private void buildTitleSlide(XSLFSlide slide, JsonNode n) {
        // Full background
        fillRect(slide, 0, 0, SLIDE_W, SLIDE_H, C_INDIGO_700);

        // Decorative top stripe
        fillRect(slide, 0, 0, SLIDE_W, 5, C_VIOLET_400);

        // Decorative bottom stripe
        fillRect(slide, 0, SLIDE_H - 5, SLIDE_W, 5, C_INDIGO_900);

        // Subtle right-side accent block
        fillRect(slide, SLIDE_W - 8, 0, 8, SLIDE_H, C_VIOLET_600);

        // Main title
        String title = n.path("title").asText("Bài Giảng");
        addText(slide, title, 60, 90, SLIDE_W - 120, 80,
                32.0, true, C_WHITE, TextParagraph.TextAlign.CENTER, "Calibri");

        // Subtitle / level
        String subtitle = n.path("subtitle").asText("");
        if (!subtitle.isBlank()) {
            addText(slide, subtitle, 60, 178, SLIDE_W - 120, 28,
                    14.0, false, C_VIOLET_400, TextParagraph.TextAlign.CENTER, "Calibri");
        }

        // Objectives as chips
        JsonNode objs = n.path("objectives");
        if (objs.isArray() && objs.size() > 0) {
            int chipW = Math.min(200, (SLIDE_W - 80) / objs.size() - 8);
            int totalW = objs.size() * (chipW + 8) - 8;
            int startX = (SLIDE_W - totalW) / 2;
            int chipY = 240;
            for (int i = 0; i < objs.size() && i < 4; i++) {
                int cx = startX + i * (chipW + 8);
                fillRect(slide, cx, chipY, chipW, 36, new Color(0x3730A3)); // indigo-800
                addText(slide, objs.get(i).asText(), cx + 6, chipY + 6, chipW - 12, 24,
                        10.0, false, C_INDIGO_100, TextParagraph.TextAlign.CENTER, "Calibri");
            }
        }

        // DeutschFlow branding
        addText(slide, "DeutschFlow · AI Lesson", 0, SLIDE_H - 28, SLIDE_W, 20,
                9.0, false, new Color(0x818CF8), TextParagraph.TextAlign.CENTER, "Calibri");
    }


    /**
     * AGENDA slide — numbered list of lesson sections.
     * Layout: indigo header | numbered items with alternating bg
     */
    private void buildAgendaSlide(XSLFSlide slide, JsonNode n) {
        fillRect(slide, 0, 0, SLIDE_W, SLIDE_H, C_SLATE_50);
        // Header
        fillRect(slide, 0, 0, SLIDE_W, 64, C_INDIGO_600);
        fillRect(slide, 0, 0, 6, SLIDE_H, C_VIOLET_600); // left accent bar
        addText(slide, n.path("title").asText("Nội dung bài học"),
                20, 14, SLIDE_W - 40, 36, 22.0, true, C_WHITE,
                TextParagraph.TextAlign.LEFT, "Calibri");

        JsonNode items = n.path("items");
        if (!items.isArray()) return;

        int y = 76;
        int itemH = 38;
        Color[] rowColors = { C_WHITE, C_INDIGO_50 };
        Color[] numColors = { C_INDIGO_600, C_VIOLET_600 };

        for (int i = 0; i < items.size() && i < 7; i++) {
            Color rowBg = rowColors[i % 2];
            fillRect(slide, 6, y, SLIDE_W - 6, itemH - 2, rowBg);

            // Number badge
            fillRect(slide, 14, y + 6, 26, 26, numColors[i % 2]);
            addText(slide, String.valueOf(i + 1), 14, y + 8, 26, 22,
                    11.0, true, C_WHITE, TextParagraph.TextAlign.CENTER, "Calibri");

            // Item text
            addText(slide, items.get(i).asText(), 48, y + 8, SLIDE_W - 68, 22,
                    13.0, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
            y += itemH;
        }

        addFooter(slide);
    }


    /**
     * SECTION slide — bold divider between major lesson parts.
     * Layout: split design — left indigo block | right white with subtitle
     */
    private void buildSectionSlide(XSLFSlide slide, JsonNode n) {
        fillRect(slide, 0, 0, SLIDE_W, SLIDE_H, C_WHITE);
        // Left colored block (40% width)
        fillRect(slide, 0, 0, 288, SLIDE_H, C_INDIGO_600);
        fillRect(slide, 0, 0, 288, 5, C_VIOLET_400);

        // Section number / label on left
        addText(slide, "PHẦN", 20, 120, 248, 30,
                11.0, false, C_INDIGO_100, TextParagraph.TextAlign.CENTER, "Calibri");

        // Title on left
        String title = n.path("title").asText();
        addText(slide, title, 20, 155, 248, 80,
                26.0, true, C_WHITE, TextParagraph.TextAlign.CENTER, "Calibri");

        // Subtitle on right
        String subtitle = n.path("subtitle").asText("");
        if (!subtitle.isBlank()) {
            addText(slide, subtitle, 308, 140, SLIDE_W - 328, 80,
                    16.0, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
        }

        // Right accent line
        fillRect(slide, 308, 130, 3, 100, C_INDIGO_500);
        addFooter(slide);
    }

    /**
     * CONTENT slide — standard lesson content with styled bullet points.
     * Layout: indigo header bar | bullet cards with left accent dot
     */
    private void buildContentSlide(XSLFSlide slide, JsonNode n) {
        fillRect(slide, 0, 0, SLIDE_W, SLIDE_H, C_SLATE_50);
        // Header
        fillRect(slide, 0, 0, SLIDE_W, 60, C_INDIGO_600);
        fillRect(slide, 0, 0, 6, SLIDE_H, C_INDIGO_500);
        fillRect(slide, 0, 57, SLIDE_W, 3, C_VIOLET_400);

        addText(slide, n.path("title").asText("Nội dung"),
                20, 12, SLIDE_W - 40, 36, 20.0, true, C_WHITE,
                TextParagraph.TextAlign.LEFT, "Calibri");

        JsonNode bullets = n.path("content");
        if (!bullets.isArray()) { addFooter(slide); return; }

        int y = 70;
        int maxBullets = 6;
        // Dynamic height based on bullet count
        int count = Math.min(bullets.size(), maxBullets);
        int availH = SLIDE_H - 70 - 20;
        int bulletH = Math.min(48, availH / Math.max(count, 1));

        for (int i = 0; i < count; i++) {
            String text = bullets.get(i).asText();
            // Card background
            fillRect(slide, 14, y + 2, SLIDE_W - 28, bulletH - 4, C_WHITE);
            // Left accent dot
            fillRect(slide, 14, y + 2, 4, bulletH - 4, C_INDIGO_500);
            // Bullet text
            addText(slide, text, 26, y + (bulletH / 2) - 9, SLIDE_W - 50, 18,
                    12.5, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
            y += bulletH;
        }
        addFooter(slide);
    }


    /**
     * TWO_COLUMN / EXAMPLE slide — side-by-side comparison.
     * EXAMPLE: left = Deutsch, right = Tiếng Việt (green header)
     * TWO_COLUMN: left = indigo, right = violet
     */
    private void buildTwoColumnSlide(XSLFSlide slide, JsonNode n, String type) {
        fillRect(slide, 0, 0, SLIDE_W, SLIDE_H, C_SLATE_50);
        // Header
        fillRect(slide, 0, 0, SLIDE_W, 56, C_INDIGO_600);
        fillRect(slide, 0, 53, SLIDE_W, 3, C_VIOLET_400);
        addText(slide, n.path("title").asText("So sánh"),
                20, 10, SLIDE_W - 40, 36, 20.0, true, C_WHITE,
                TextParagraph.TextAlign.LEFT, "Calibri");

        boolean isExample = "EXAMPLE".equals(type);
        int colW = (SLIDE_W - 36) / 2;
        int leftX = 12, rightX = 12 + colW + 12;
        int colHeaderH = 32;
        int colY = 64;

        // Left column header
        Color leftHdr = isExample ? C_INDIGO_600 : C_INDIGO_600;
        fillRect(slide, leftX, colY, colW, colHeaderH, leftHdr);
        addText(slide, n.path("left_title").asText("Links"),
                leftX + 8, colY + 6, colW - 16, 20,
                12.0, true, C_WHITE, TextParagraph.TextAlign.LEFT, "Calibri");

        // Right column header
        Color rightHdr = isExample ? C_GREEN_600 : C_VIOLET_600;
        fillRect(slide, rightX, colY, colW, colHeaderH, rightHdr);
        addText(slide, n.path("right_title").asText("Rechts"),
                rightX + 8, colY + 6, colW - 16, 20,
                12.0, true, C_WHITE, TextParagraph.TextAlign.LEFT, "Calibri");

        // Column items
        JsonNode leftItems  = n.path("left_items");
        JsonNode rightItems = n.path("right_items");
        int maxRows = Math.max(
                leftItems.isArray()  ? leftItems.size()  : 0,
                rightItems.isArray() ? rightItems.size() : 0);
        maxRows = Math.min(maxRows, 7);

        int availH = SLIDE_H - colY - colHeaderH - 20;
        int rowH = Math.min(42, availH / Math.max(maxRows, 1));
        Color[] leftRowBg  = { C_WHITE, C_INDIGO_50 };
        Color[] rightRowBg = { C_WHITE, isExample ? C_GREEN_50 : new Color(0xF5F3FF) };

        for (int i = 0; i < maxRows; i++) {
            int ry = colY + colHeaderH + i * rowH;
            // Left row
            fillRect(slide, leftX, ry, colW, rowH - 1, leftRowBg[i % 2]);
            if (leftItems.isArray() && i < leftItems.size()) {
                addText(slide, leftItems.get(i).asText(),
                        leftX + 10, ry + 4, colW - 20, rowH - 8,
                        11.5, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
            }
            // Right row
            fillRect(slide, rightX, ry, colW, rowH - 1, rightRowBg[i % 2]);
            if (rightItems.isArray() && i < rightItems.size()) {
                addText(slide, rightItems.get(i).asText(),
                        rightX + 10, ry + 4, colW - 20, rowH - 8,
                        11.5, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
            }
        }
        addFooter(slide);
    }


    /**
     * SUMMARY slide — key takeaways + homework box.
     * Layout: indigo header | key points with checkmark | amber homework box
     */
    private void buildSummarySlide(XSLFSlide slide, JsonNode n) {
        fillRect(slide, 0, 0, SLIDE_W, SLIDE_H, C_SLATE_50);
        // Header
        fillRect(slide, 0, 0, SLIDE_W, 56, C_INDIGO_900);
        fillRect(slide, 0, 53, SLIDE_W, 3, C_VIOLET_400);
        addText(slide, n.path("title").asText("Tổng kết"),
                20, 10, SLIDE_W - 40, 36, 20.0, true, C_WHITE,
                TextParagraph.TextAlign.LEFT, "Calibri");

        // Key points section label
        addText(slide, "✓  Điểm chính cần nhớ", 14, 62, 300, 20,
                10.0, true, C_INDIGO_600, TextParagraph.TextAlign.LEFT, "Calibri");

        JsonNode kp = n.path("key_points");
        int y = 82;
        int kpH = 34;
        if (kp.isArray()) {
            int count = Math.min(kp.size(), 5);
            for (int i = 0; i < count; i++) {
                fillRect(slide, 14, y, SLIDE_W - 28, kpH - 2, C_WHITE);
                fillRect(slide, 14, y, 4, kpH - 2, C_GREEN_600);
                addText(slide, kp.get(i).asText(),
                        26, y + 6, SLIDE_W - 50, 22,
                        12.0, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
                y += kpH;
            }
        }

        // Homework box
        String hw = n.path("homework").asText("");
        if (!hw.isBlank()) {
            int hwY = Math.max(y + 8, SLIDE_H - 80);
            fillRect(slide, 14, hwY, SLIDE_W - 28, 60, C_AMBER_50);
            fillRect(slide, 14, hwY, 4, 60, C_AMBER_600);
            addText(slide, "📝  Bài tập về nhà", 24, hwY + 4, 200, 18,
                    10.0, true, C_AMBER_600, TextParagraph.TextAlign.LEFT, "Calibri");
            addText(slide, hw, 24, hwY + 22, SLIDE_W - 48, 32,
                    11.5, false, C_SLATE_700, TextParagraph.TextAlign.LEFT, "Calibri");
        }

        addFooter(slide);
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /** Vẽ hình chữ nhật màu đặc (dùng TextBox không có text). */
    private void fillRect(XSLFSlide slide, int x, int y, int w, int h, Color color) {
        XSLFTextBox box = slide.createTextBox();
        box.setAnchor(new Rectangle(x, y, w, h));
        box.setFillColor(color);
        box.clearText();
        // Remove border
        box.setLineColor(color);
        box.setLineWidth(0);
    }

    /** Thêm text box với đầy đủ tùy chọn định dạng. */
    private void addText(XSLFSlide slide, String text,
                         int x, int y, int w, int h,
                         double fontSize, boolean bold, Color color,
                         TextParagraph.TextAlign align, String font) {
        if (text == null || text.isBlank()) return;
        XSLFTextBox box = slide.createTextBox();
        box.setAnchor(new Rectangle(x, y, w, h));
        box.setFillColor(null);
        box.setLineColor(null);
        box.setLineWidth(0);
        // Clear default paragraph
        box.clearText();
        XSLFTextParagraph para = box.addNewTextParagraph();
        para.setTextAlign(align);
        para.setSpaceBefore(0.0);
        para.setSpaceAfter(0.0);
        XSLFTextRun run = para.addNewTextRun();
        run.setText(text);
        run.setFontSize(fontSize);
        run.setBold(bold);
        run.setFontColor(color);
        run.setFontFamily(font);
    }

    /** Footer nhỏ ở cuối mỗi slide nội dung. */
    private void addFooter(XSLFSlide slide) {
        fillRect(slide, 0, SLIDE_H - 4, SLIDE_W, 4, C_INDIGO_100);
        addText(slide, "DeutschFlow", SLIDE_W - 90, SLIDE_H - 18, 80, 14,
                7.5, false, C_SLATE_500, TextParagraph.TextAlign.RIGHT, "Calibri");
    }
}
