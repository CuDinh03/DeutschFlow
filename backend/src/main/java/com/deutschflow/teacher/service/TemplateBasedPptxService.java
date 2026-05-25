package com.deutschflow.teacher.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xslf.usermodel.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;

/**
 * Tạo PPTX chuyên nghiệp bằng cách clone slides từ template có sẵn.
 *
 * Template (deutschflow-template.pptx) chứa 7 slide layouts đẹp:
 *   Slide 0: TITLE
 *   Slide 1: AGENDA
 *   Slide 2: SECTION
 *   Slide 3: CONTENT
 *   Slide 4: TWO_COLUMN
 *   Slide 5: EXAMPLE
 *   Slide 6: SUMMARY
 *
 * Mỗi slide template có placeholders dạng {{KEY}}.
 * Service clone slide từ template, thay thế placeholders bằng nội dung thực.
 */
@Service
@Slf4j
public class TemplateBasedPptxService {

    private static final String TEMPLATE_PATH = "templates/deutschflow-template.pptx";

    // Index của từng layout trong template
    private static final int IDX_TITLE      = 0;
    private static final int IDX_AGENDA     = 1;
    private static final int IDX_SECTION    = 2;
    private static final int IDX_CONTENT    = 3;
    private static final int IDX_TWO_COLUMN = 4;
    private static final int IDX_EXAMPLE    = 5;
    private static final int IDX_SUMMARY    = 6;

    /**
     * Tạo PPTX bytes từ JSON cấu trúc Gemini output.
     */
    public byte[] createPptx(JsonNode root) throws Exception {
        ClassPathResource resource = new ClassPathResource(TEMPLATE_PATH);
        if (!resource.exists()) {
            throw new IllegalStateException("Template not found: " + TEMPLATE_PATH);
        }

        try (InputStream templateStream = resource.getInputStream();
             XMLSlideShow template = new XMLSlideShow(templateStream);
             XMLSlideShow output = new XMLSlideShow()) {

            // Copy slide size từ template
            output.setPageSize(template.getPageSize());

            // Lấy danh sách template slides
            List<XSLFSlide> templateSlides = template.getSlides();
            if (templateSlides.size() < 7) {
                throw new IllegalStateException("Template phải có ít nhất 7 slides");
            }

            JsonNode slides = root.path("slides");
            int slideCount = 0;

            for (JsonNode slideNode : slides) {
                String type = slideNode.path("type").asText("CONTENT").toUpperCase();
                int templateIdx = getTemplateIndex(type);
                XSLFSlide templateSlide = templateSlides.get(templateIdx);

                // Import slide từ template vào output
                XSLFSlide newSlide = output.createSlide();
                newSlide.importContent(templateSlide);

                // Thay thế placeholders
                Map<String, String> replacements = buildReplacements(type, slideNode);
                replacePlaceholders(newSlide, replacements);

                slideCount++;
            }

            log.info("[TemplatePptx] Built {} slides from template", slideCount);

            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                output.write(out);
                return out.toByteArray();
            }
        }
    }

    private int getTemplateIndex(String type) {
        return switch (type) {
            case "TITLE"      -> IDX_TITLE;
            case "AGENDA"     -> IDX_AGENDA;
            case "SECTION"    -> IDX_SECTION;
            case "EXAMPLE"    -> IDX_EXAMPLE;
            case "TWO_COLUMN" -> IDX_TWO_COLUMN;
            case "SUMMARY"    -> IDX_SUMMARY;
            default           -> IDX_CONTENT;
        };
    }

    /**
     * Xây dựng map placeholder → giá trị thực từ JSON node.
     */
    private Map<String, String> buildReplacements(String type, JsonNode n) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("{{TITLE}}", n.path("title").asText(""));

        switch (type) {
            case "TITLE" -> {
                map.put("{{SUBTITLE}}", n.path("subtitle").asText(""));
                JsonNode objs = n.path("objectives");
                for (int i = 0; i < 3; i++) {
                    map.put("{{OBJ" + i + "}}",
                            (objs.isArray() && i < objs.size()) ? objs.get(i).asText() : "");
                }
            }
            case "AGENDA" -> {
                JsonNode items = n.path("items");
                for (int i = 0; i < 7; i++) {
                    map.put("{{ITEM" + i + "}}",
                            (items.isArray() && i < items.size()) ? items.get(i).asText() : "");
                }
            }
            case "SECTION" -> map.put("{{SUBTITLE}}", n.path("subtitle").asText(""));
            case "CONTENT" -> {
                JsonNode bullets = n.path("content");
                for (int i = 0; i < 6; i++) {
                    map.put("{{BULLET" + i + "}}",
                            (bullets.isArray() && i < bullets.size()) ? bullets.get(i).asText() : "");
                }
            }
            case "TWO_COLUMN", "EXAMPLE" -> {
                map.put("{{LEFT_TITLE}}",  n.path("left_title").asText(""));
                map.put("{{RIGHT_TITLE}}", n.path("right_title").asText(""));
                JsonNode li = n.path("left_items"), ri = n.path("right_items");
                for (int i = 0; i < 6; i++) {
                    map.put("{{LEFT"  + i + "}}",
                            (li.isArray() && i < li.size()) ? li.get(i).asText() : "");
                    map.put("{{RIGHT" + i + "}}",
                            (ri.isArray() && i < ri.size()) ? ri.get(i).asText() : "");
                }
            }
            case "SUMMARY" -> {
                JsonNode kp = n.path("key_points");
                for (int i = 0; i < 5; i++) {
                    map.put("{{KP" + i + "}}",
                            (kp.isArray() && i < kp.size()) ? kp.get(i).asText() : "");
                }
                map.put("{{HOMEWORK}}", n.path("homework").asText(""));
            }
        }
        return map;
    }

    /**
     * Duyệt tất cả text shapes trong slide và thay thế placeholders.
     * Xóa shape nếu placeholder rỗng (tránh hiển thị ô trống).
     */
    private void replacePlaceholders(XSLFSlide slide, Map<String, String> replacements) {
        List<XSLFShape> toRemove = new ArrayList<>();

        for (XSLFShape shape : slide.getShapes()) {
            if (!(shape instanceof XSLFTextShape textShape)) continue;

            String fullText = textShape.getText();
            if (fullText == null || fullText.isBlank()) continue;

            // Tìm placeholder key trong text
            String matchedKey = null;
            String matchedValue = null;
            for (Map.Entry<String, String> entry : replacements.entrySet()) {
                if (fullText.contains(entry.getKey())) {
                    matchedKey = entry.getKey();
                    matchedValue = entry.getValue();
                    break;
                }
            }

            if (matchedKey == null) continue;

            // Nếu value rỗng → xóa shape (ẩn slot trống)
            if (matchedValue.isBlank()) {
                toRemove.add(shape);
                continue;
            }

            // Thay thế text trong từng run, giữ nguyên formatting
            for (XSLFTextParagraph para : textShape.getTextParagraphs()) {
                for (XSLFTextRun run : para.getTextRuns()) {
                    String runText = run.getRawText();
                    if (runText != null && runText.contains(matchedKey)) {
                        run.setText(runText.replace(matchedKey, matchedValue));
                    }
                }
            }
        }

        // Xóa shapes rỗng
        for (XSLFShape shape : toRemove) {
            slide.removeShape(shape);
        }
    }
}
