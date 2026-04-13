package com.deutschflow.user.service;

import com.deutschflow.user.dto.SessionDetailResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TheoryLessonLoader {

    private final ObjectMapper objectMapper;
    private JsonNode lessonsRoot;

    @PostConstruct
    void load() throws Exception {
        ClassPathResource res = new ClassPathResource("theory/lessons.json");
        try (InputStream in = res.getInputStream()) {
            JsonNode root = objectMapper.readTree(in);
            lessonsRoot = root.path("lessons");
            if (!lessonsRoot.isObject() || lessonsRoot.isEmpty()) {
                throw new IllegalStateException("theory/lessons.json missing or invalid");
            }
        }
    }

    public SessionDetailResponse.TheoryLesson lesson(int week, int sessionIndex, String normalizedType, String lang) {
        int v = Math.floorMod(week * 11 + sessionIndex * 5, 3);
        String base = canonicalTheoryType(normalizedType);
        JsonNode lesson = resolveLesson(base, v);
        if (lesson == null || lesson.isNull()) {
            lesson = resolveLesson("GRAMMAR", 0);
        }
        if (lesson == null || lesson.isNull()) {
            throw new IllegalStateException("Missing theory lesson (no fallback) for base=" + base + " v=" + v);
        }
        String l = normalizeLang(lang);
        return new SessionDetailResponse.TheoryLesson(
                text(lesson.get("title"), l),
                text(lesson.get("overview"), l),
                bullets(lesson.get("focusBullets"), l),
                vocabulary(lesson.get("vocabulary"), l),
                phrases(lesson.get("phrases"), l),
                examples(lesson.get("examples"), l)
        );
    }

    /**
     * Only these families exist in theory/lessons.json. Anything else (e.g. legacy or bad JSON) maps to GRAMMAR.
     */
    private static String canonicalTheoryType(String normalizedType) {
        if (normalizedType == null || normalizedType.isBlank()) {
            return "GRAMMAR";
        }
        String u = normalizedType.trim().toUpperCase(Locale.ROOT);
        return switch (u) {
            case "GRAMMAR", "PRACTICE", "SPEAKING", "REVIEW" -> u;
            default -> "GRAMMAR";
        };
    }

    /**
     * Prefer {@code base:v}, then {@code base:0}, then {@code GRAMMAR:v}, then {@code GRAMMAR:0}.
     */
    private JsonNode resolveLesson(String base, int v) {
        JsonNode lesson = lessonsRoot.get(base + ":" + v);
        if (lesson != null && !lesson.isNull()) {
            return lesson;
        }
        lesson = lessonsRoot.get(base + ":0");
        if (lesson != null && !lesson.isNull()) {
            return lesson;
        }
        lesson = lessonsRoot.get("GRAMMAR:" + v);
        if (lesson != null && !lesson.isNull()) {
            return lesson;
        }
        return lessonsRoot.get("GRAMMAR:0");
    }

    private static String normalizeLang(String lang) {
        if (lang == null || lang.isBlank()) return "vi";
        return lang.trim().toLowerCase(Locale.ROOT);
    }

    private static String text(JsonNode tri, String lang) {
        if (tri == null || tri.isNull()) return "";
        if (tri.has(lang)) return tri.get(lang).asText("");
        return tri.path("vi").asText("");
    }

    private static List<String> bullets(JsonNode arr, String lang) {
        List<String> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            out.add(text(n, lang));
        }
        return out;
    }

    private static List<SessionDetailResponse.VocabLine> vocabulary(JsonNode arr, String lang) {
        List<SessionDetailResponse.VocabLine> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            out.add(new SessionDetailResponse.VocabLine(
                    n.path("german").asText(""),
                    text(n.get("meaning"), lang),
                    n.path("exampleDe").asText(""),
                    text(n.get("exampleTranslation"), lang),
                    n.path("speakDe").asText("")
            ));
        }
        return out;
    }

    private static List<SessionDetailResponse.PhraseLine> phrases(JsonNode arr, String lang) {
        List<SessionDetailResponse.PhraseLine> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            out.add(new SessionDetailResponse.PhraseLine(
                    n.path("german").asText(""),
                    text(n.get("meaning"), lang),
                    n.path("speakDe").asText("")
            ));
        }
        return out;
    }

    private static List<SessionDetailResponse.ExampleLine> examples(JsonNode arr, String lang) {
        List<SessionDetailResponse.ExampleLine> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode n : arr) {
            out.add(new SessionDetailResponse.ExampleLine(
                    n.path("german").asText(""),
                    text(n.get("translation"), lang),
                    text(n.get("note"), lang),
                    n.path("speakDe").asText("")
            ));
        }
        return out;
    }
}
