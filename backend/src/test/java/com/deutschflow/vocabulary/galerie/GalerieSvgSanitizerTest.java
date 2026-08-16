package com.deutschflow.vocabulary.galerie;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * SVG do LLM sinh là CODE chạy trong trình duyệt học viên — sanitizer là cổng an ninh bắt buộc
 * trước khi lưu (plan mục 12). Test bám spec handoff 16/08: whitelist element/attribute,
 * whitelist đúng 5 hex Galerie, cap 20KB, và extract được SVG từ output có markdown fence.
 */
class GalerieSvgSanitizerTest {

    private final GalerieSvgSanitizer sanitizer = new GalerieSvgSanitizer();

    private static final String MINIMAL_VALID = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
            <rect width="1024" height="1024" fill="#F6F3EC"/>
            <path fill="#DA291C" d="M100 100 C200 50 300 150 200 200 Z"/>
            <circle cx="500" cy="500" r="40" fill="#161513"/>
            </svg>""";

    // ── Happy path ──────────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("SVG hợp lệ tối thiểu đi qua nguyên vẹn, đếm đúng element")
    void minimalValidSvgPasses() {
        GalerieSvgSanitizer.SanitizedSvg result = sanitizer.sanitize(MINIMAL_VALID);
        assertThat(result.svg()).startsWith("<svg").endsWith("</svg>");
        assertThat(result.svg()).contains("#DA291C");
        // svg + rect + path + circle
        assertThat(result.elementCount()).isEqualTo(4);
    }

    @Test
    @DisplayName("Cả 3 SVG anchor pilot (few-shot chính thức) phải PASS sanitizer")
    void allPilotAnchorsPass() throws IOException {
        for (String name : new String[]{"01-der-apfel.svg", "16-lesen.svg", "24-gross.svg"}) {
            String svg = new String(Objects.requireNonNull(
                    getClass().getResourceAsStream("/galerie/anchors/" + name),
                    "thiếu resource anchor " + name).readAllBytes(), StandardCharsets.UTF_8);
            GalerieSvgSanitizer.SanitizedSvg result = sanitizer.sanitize(svg);
            assertThat(result.svg()).as(name).contains("viewBox=\"0 0 1024 1024\"");
        }
    }

    @Test
    @DisplayName("Extract SVG từ output có preamble + markdown fence")
    void extractsSvgFromFencedOutput() {
        String raw = "Here is the artwork:\n```xml\n" + MINIMAL_VALID + "\n```\nHope you like it!";
        GalerieSvgSanitizer.SanitizedSvg result = sanitizer.sanitize(raw);
        assertThat(result.svg()).startsWith("<svg").endsWith("</svg>");
    }

    @Test
    @DisplayName("Màu hex viết thường vẫn được chấp nhận (so khớp case-insensitive)")
    void lowercaseHexAccepted() {
        String svg = MINIMAL_VALID.replace("#DA291C", "#da291c");
        assertThat(sanitizer.sanitize(svg).svg()).isNotBlank();
    }

    @Test
    @DisplayName("fill=\"none\" được phép (không phải màu ngoài palette)")
    void fillNoneAccepted() {
        String svg = MINIMAL_VALID.replace(
                "<circle cx=\"500\" cy=\"500\" r=\"40\" fill=\"#161513\"/>",
                "<circle cx=\"500\" cy=\"500\" r=\"40\" fill=\"none\" stroke=\"#161513\" stroke-width=\"8\"/>");
        assertThat(sanitizer.sanitize(svg).svg()).isNotBlank();
    }

    // ── Element/attribute cấm ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Cấm element ngoài whitelist: script, text, image, foreignObject, gradient, animate, style")
    void forbiddenElementsRejected() {
        String[] payloads = {
                "<script>alert(1)</script>",
                "<text x=\"10\" y=\"10\">Apfel</text>",
                "<image href=\"https://evil\"/>",
                "<foreignObject><div>x</div></foreignObject>",
                "<linearGradient id=\"g\"/>",
                "<animate attributeName=\"x\"/>",
                "<style>.a{fill:red}</style>",
                "<clipPath id=\"c\"/>",
                "<mask id=\"m\"/>",
                "<tspan>x</tspan>",
                "<filter id=\"f\"/>",
                "<use href=\"#x\"/>",
        };
        for (String payload : payloads) {
            String svg = MINIMAL_VALID.replace("</svg>", payload + "</svg>");
            assertThatThrownBy(() -> sanitizer.sanitize(svg))
                    .as("payload: " + payload)
                    .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class);
        }
    }

    @Test
    @DisplayName("Cấm attribute nguy hiểm / ngoài whitelist: on*, href, style, opacity, id, class")
    void forbiddenAttributesRejected() {
        String[] payloads = {
                "<path d=\"M0 0\" fill=\"#161513\" onclick=\"alert(1)\"/>",
                "<path d=\"M0 0\" fill=\"#161513\" onload=\"x()\"/>",
                "<path d=\"M0 0\" fill=\"#161513\" style=\"fill:red\"/>",
                "<path d=\"M0 0\" fill=\"#161513\" opacity=\"0.5\"/>",
                "<path d=\"M0 0\" fill=\"#161513\" id=\"p1\"/>",
                "<path d=\"M0 0\" fill=\"#161513\" class=\"x\"/>",
                "<g href=\"https://evil\"><path d=\"M0 0\" fill=\"#161513\"/></g>",
        };
        for (String payload : payloads) {
            String svg = MINIMAL_VALID.replace("</svg>", payload + "</svg>");
            assertThatThrownBy(() -> sanitizer.sanitize(svg))
                    .as("payload: " + payload)
                    .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class);
        }
    }

    @Test
    @DisplayName("Màu ngoài palette 5 hex bị chặn — cả fill lẫn stroke, cả tên màu CSS")
    void offPaletteColorsRejected() {
        String[] payloads = {
                "<path d=\"M0 0\" fill=\"#FF0000\"/>",
                "<path d=\"M0 0\" fill=\"red\"/>",
                "<path d=\"M0 0\" fill=\"#161513\" stroke=\"#00FF00\"/>",
                "<path d=\"M0 0\" fill=\"url(#g)\"/>",
        };
        for (String payload : payloads) {
            String svg = MINIMAL_VALID.replace("</svg>", payload + "</svg>");
            assertThatThrownBy(() -> sanitizer.sanitize(svg))
                    .as("payload: " + payload)
                    .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class);
        }
    }

    // ── Cấu trúc + kích thước ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("viewBox phải đúng 0 0 1024 1024")
    void wrongViewBoxRejected() {
        String svg = MINIMAL_VALID.replace("0 0 1024 1024", "0 0 512 512");
        assertThatThrownBy(() -> sanitizer.sanitize(svg))
                .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class);
    }

    @Test
    @DisplayName("Output không chứa <svg nào bị chặn với thông điệp rõ")
    void missingSvgRejected() {
        assertThatThrownBy(() -> sanitizer.sanitize("I cannot draw that."))
                .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class);
        assertThatThrownBy(() -> sanitizer.sanitize(null))
                .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class);
    }

    @Test
    @DisplayName("SVG vượt 20KB bị chặn")
    void oversizeRejected() {
        String bigPath = "<path fill=\"#161513\" d=\"M0 0 " + "L1 1 ".repeat(5000) + "Z\"/>";
        String svg = MINIMAL_VALID.replace("</svg>", bigPath + "</svg>");
        assertThatThrownBy(() -> sanitizer.sanitize(svg))
                .isInstanceOf(GalerieSvgSanitizer.GalerieSvgValidationException.class)
                .hasMessageContaining("20");
    }
}
