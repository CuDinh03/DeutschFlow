package com.deutschflow.vocabulary.galerie;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Comment;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.jsoup.parser.Parser;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Cổng an ninh BẮT BUỘC trước khi lưu SVG do LLM sinh (plan mục 12): SVG là code sẽ render
 * trong trình duyệt/WebView học viên, nên xử lý như untrusted input đúng nghĩa.
 *
 * <p>Chiến lược whitelist (không blacklist): chỉ tập element hình học + tập attribute mà bộ
 * anchor pilot thực dùng; mọi thứ khác — kể cả thứ "trông vô hại" như {@code id}/{@code class}
 * — đều chặn, khớp luật prompt (mục 5 handoff: no text/gradient/opacity/filter/id/class).
 * Nhờ đó palette compliance + text detection thành deterministic 0đ (plan mục 13).
 *
 * <p>Sau khi validate DOM, kết quả được RE-SERIALIZE từ cây đã lọc (bỏ comment/PI/CDATA) —
 * không trả lại raw string, tránh nội dung lọt ngoài các node đã kiểm.
 */
@Component
public class GalerieSvgSanitizer {

    static final int MAX_BYTES = 20 * 1024;

    private static final Set<String> ALLOWED_ELEMENTS =
            Set.of("svg", "rect", "circle", "ellipse", "path", "polygon", "g");

    private static final Set<String> ALLOWED_ATTRIBUTES = Set.of(
            "xmlns", "viewbox", "width", "height",
            "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
            "d", "cx", "cy", "r", "rx", "ry", "x", "y", "points", "transform");

    private static final Set<String> ALLOWED_COLORS = Set.of(
            "none", "#f6f3ec", "#ffcd00", "#c79a00", "#da291c", "#161513");

    private static final String REQUIRED_VIEWBOX = "0 0 1024 1024";

    public SanitizedSvg sanitize(String rawModelOutput) {
        String extracted = extractSvg(rawModelOutput);
        if (extracted.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new GalerieSvgValidationException(
                    "SVG vượt trần 20KB (" + extracted.length() + " ký tự)");
        }

        Document doc = Jsoup.parse(extracted, "", Parser.xmlParser());
        Element root = doc.children().stream()
                .filter(e -> e.tagName().equalsIgnoreCase("svg"))
                .findFirst()
                .orElseThrow(() -> new GalerieSvgValidationException("Không parse được root <svg>"));

        String viewBox = root.attr("viewBox");
        if (!REQUIRED_VIEWBOX.equals(viewBox.trim())) {
            throw new GalerieSvgValidationException(
                    "viewBox phải là \"" + REQUIRED_VIEWBOX + "\", nhận: \"" + viewBox + "\"");
        }

        int elementCount = 0;
        for (Element element : root.getAllElements()) {
            validateElement(element);
            elementCount++;
        }
        stripNonElementNodes(root);

        doc.outputSettings(new Document.OutputSettings()
                .syntax(Document.OutputSettings.Syntax.xml)
                .prettyPrint(false));
        return new SanitizedSvg(root.outerHtml(), elementCount);
    }

    private void validateElement(Element element) {
        String tag = element.tagName().toLowerCase(Locale.ROOT);
        if (!ALLOWED_ELEMENTS.contains(tag)) {
            throw new GalerieSvgValidationException("Element bị cấm: <" + element.tagName() + ">");
        }
        element.attributes().forEach(attr -> {
            String key = attr.getKey().toLowerCase(Locale.ROOT);
            if (!ALLOWED_ATTRIBUTES.contains(key)) {
                throw new GalerieSvgValidationException(
                        "Attribute bị cấm trên <" + tag + ">: " + attr.getKey());
            }
            if (("fill".equals(key) || "stroke".equals(key))
                    && !ALLOWED_COLORS.contains(attr.getValue().trim().toLowerCase(Locale.ROOT))) {
                throw new GalerieSvgValidationException(
                        "Màu ngoài palette Galerie: " + key + "=\"" + attr.getValue() + "\"");
            }
        });
    }

    /**
     * Spec cấm chữ trong tranh: text node có nội dung thật (không phải whitespace) bị chặn;
     * comment/CDATA/PI bị gỡ lặng lẽ (vô hại nhưng không có lý do tồn tại trong artwork).
     */
    private void stripNonElementNodes(Element root) {
        List<Node> toRemove = new ArrayList<>();
        root.traverse((node, depth) -> {
            if (node instanceof TextNode text) {
                if (!text.isBlank()) {
                    throw new GalerieSvgValidationException(
                            "SVG chứa text node — spec cấm chữ trong artwork: \""
                                    + text.text().trim() + "\"");
                }
            } else if (node instanceof Comment || !(node instanceof Element)) {
                toRemove.add(node);
            }
        });
        toRemove.forEach(Node::remove);
    }

    private static String extractSvg(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new GalerieSvgValidationException("Model trả nội dung rỗng");
        }
        int start = raw.indexOf("<svg");
        int end = raw.lastIndexOf("</svg>");
        if (start < 0 || end < 0 || end < start) {
            throw new GalerieSvgValidationException(
                    "Không tìm thấy khối <svg>…</svg> trong output của model");
        }
        return raw.substring(start, end + "</svg>".length());
    }

    /** SVG đã qua kiểm + số element (phục vụ soi độ rối theo plan mục 13). */
    public record SanitizedSvg(String svg, int elementCount) {}

    public static class GalerieSvgValidationException extends RuntimeException {
        public GalerieSvgValidationException(String message) {
            super(message);
        }
    }
}
