package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cổng nội dung đề thi thử: đọc thẳng {@code sections_json} trong migration và bắt các lỗi mà chỉ
 * chạy tay mới lộ ra — đáp án không nằm trong lựa chọn, trùng id câu hỏi, phần thi thiếu chỗ nhập.
 *
 * <p>Đề mới (V3xx) bị soi chặt hơn đề cũ: đủ số câu Đọc/Nghe, có giải thích tiếng Việt cho từng câu,
 * và mọi Teil phải dùng dạng mà trình chạy web vẽ được (xem {@code ExamTaking.tsx}).
 */
@DisplayName("Nội dung đề thi thử trong migration")
class MockExamSeedContentTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");
    /** Chuỗi SQL một nháy chứa sections_json. Nội dung đề không được có dấu nháy đơn. */
    private static final Pattern SECTIONS_JSON =
            Pattern.compile("'(\\{[^']*\"sections\"[^']*})'", Pattern.DOTALL);
    private static final Pattern NEW_SEED = Pattern.compile("V3\\d\\d__mock_exam.*\\.sql");
    private static final Set<String> SECTION_NAMES = Set.of("LESEN", "HOEREN", "SCHREIBEN", "SPRECHEN");
    private static final Set<String> MATCHING_LETTERS = Set.of("A", "B", "C", "D", "E", "F", "G", "H");

    @Test
    @DisplayName("mọi đề: đáp án khớp lựa chọn, id không trùng, phần thi có chỗ nhập")
    void everySeededExam_isStructurallyValid() throws IOException {
        List<String> problems = new ArrayList<>();
        int examCount = 0;

        for (Path file : examSeedFiles()) {
            boolean strict = NEW_SEED.matcher(file.getFileName().toString()).matches();
            Matcher matcher = SECTIONS_JSON.matcher(Files.readString(file));
            int index = 0;
            while (matcher.find()) {
                index++;
                String tag = file.getFileName() + "#đề" + index;
                Map<String, Object> root;
                try {
                    root = OM.readValue(matcher.group(1), Map.class);
                } catch (Exception e) {
                    problems.add(tag + ": sections_json không phải JSON hợp lệ — " + e.getMessage());
                    continue;
                }
                if (!(root.get("sections") instanceof List<?> sections)) {
                    problems.add(tag + ": thiếu mảng sections");
                    continue;
                }
                examCount++;
                checkExam(tag, sections, strict, problems);
            }
        }

        assertThat(examCount)
                .as("phải quét được đề thi thử trong migration (đường dẫn/biểu thức trích JSON còn đúng?)")
                .isGreaterThanOrEqualTo(20);
        assertThat(problems).as("lỗi nội dung đề").isEmpty();
    }

    @Test
    @DisplayName("đề mới: trả lời đúng hết Đọc/Nghe ra đủ 25 điểm mỗi phần")
    void newSeeds_allCorrectAnswers_reachFullSectionScore() throws IOException {
        ExamScoringService scoring = new ExamScoringService(null);
        List<String> problems = new ArrayList<>();
        int checked = 0;

        for (Path file : examSeedFiles()) {
            if (!NEW_SEED.matcher(file.getFileName().toString()).matches()) continue;
            Matcher matcher = SECTIONS_JSON.matcher(Files.readString(file));
            int index = 0;
            while (matcher.find()) {
                index++;
                Map<String, Object> root = OM.readValue(matcher.group(1), Map.class);
                for (Object sectionObj : (List<?>) root.get("sections")) {
                    Map<String, Object> section = cast((Map<?, ?>) sectionObj);
                    String name = String.valueOf(section.get("name"));
                    if (!name.equals("LESEN") && !name.equals("HOEREN")) continue;
                    Map<String, Object> answers = answerKey(section);
                    Map<String, Object> score = scoring.scoreObjectiveSection(answers, section);
                    checked++;
                    if (!Integer.valueOf(25).equals(score.get("total"))) {
                        problems.add(file.getFileName() + "#đề" + index + "/" + name
                                + ": trả lời đúng hết chỉ được " + score.get("total") + "/25");
                    }
                }
            }
        }

        assertThat(checked).as("số phần Đọc/Nghe đã chấm thử").isEqualTo(34);
        assertThat(problems).as("đề mới không đạt điểm tối đa dù đúng hết").isEmpty();
    }

    /** Bộ đáp án đúng của một phần khách quan, dùng để chấm thử. */
    private Map<String, Object> answerKey(Map<String, Object> section) {
        Map<String, Object> answers = new java.util.HashMap<>();
        for (Map<String, Object> teil : teile(section)) {
            if (!(teil.get("items") instanceof List<?> items)) continue;
            for (Object itemObj : items) {
                Map<String, Object> item = cast((Map<?, ?>) itemObj);
                if (item.get("id") != null && item.get("correct") != null) {
                    answers.put(item.get("id").toString(), item.get("correct"));
                }
            }
        }
        return answers;
    }

    private List<Path> examSeedFiles() throws IOException {
        try (Stream<Path> files = Files.list(MIGRATIONS)) {
            List<Path> seeds = new ArrayList<>();
            for (Path file : files.sorted().toList()) {
                String sql = Files.readString(file);
                if (sql.contains("INTO mock_exams ") || sql.contains("UPDATE mock_exams SET")) {
                    seeds.add(file);
                }
            }
            return seeds;
        }
    }

    private void checkExam(String tag, List<?> sections, boolean strict, List<String> problems) {
        // V118 chèn khung đề rỗng rồi V120 ghi đè bằng nội dung thật; khung rỗng không phải lỗi.
        if (countItems(sections) == 0) {
            if (strict) problems.add(tag + ": đề mới không có câu hỏi nào");
            return;
        }
        Set<String> ids = new HashSet<>();
        for (Object sectionObj : sections) {
            if (!(sectionObj instanceof Map<?, ?> raw)) continue;
            Map<String, Object> section = cast(raw);
            String name = String.valueOf(section.get("name"));
            if (!SECTION_NAMES.contains(name)) {
                problems.add(tag + ": tên phần lạ " + name);
                continue;
            }
            List<Map<String, Object>> teile = teile(section);
            int itemCount = 0;
            for (Map<String, Object> teil : teile) {
                itemCount += checkTeil(tag + "/" + name, teil, ids, strict, problems);
                if (name.equals("SPRECHEN") && !hasAny(teil, "prompt", "prompt_words", "topic_cards", "scenario_cards")) {
                    problems.add(tag + "/SPRECHEN/Teil " + teil.get("teil") + ": không có đề bài trình chạy hiện được");
                }
            }
            if (strict && (name.equals("LESEN") || name.equals("HOEREN")) && itemCount < 15) {
                problems.add(tag + "/" + name + ": chỉ " + itemCount + " câu, đề mới cần tối thiểu 15");
            }
            if (strict && name.equals("SCHREIBEN")
                    && teile.stream().noneMatch(t -> hasAny(t, "input_email", "prompt"))) {
                problems.add(tag + "/SCHREIBEN: không có bài viết tự luận nào");
            }
            if (strict && !(section.get("max_points") instanceof Number points && points.intValue() > 0)) {
                problems.add(tag + "/" + name + ": thiếu max_points");
            }
        }
    }

    /** Tổng số câu có đáp án trong cả đề — dùng để nhận ra khung đề rỗng. */
    private int countItems(List<?> sections) {
        int total = 0;
        for (Object sectionObj : sections) {
            if (!(sectionObj instanceof Map<?, ?> raw)) continue;
            for (Map<String, Object> teil : teile(cast(raw))) {
                if (teil.get("items") instanceof List<?> items) total += items.size();
            }
        }
        return total;
    }

    /** Kiểm tra một Teil, trả về số câu hỏi có đáp án. */
    private int checkTeil(String tag, Map<String, Object> teil, Set<String> ids,
                          boolean strict, List<String> problems) {
        if (!(teil.get("items") instanceof List<?> items)) return 0;
        int count = 0;
        for (Object itemObj : items) {
            if (!(itemObj instanceof Map<?, ?> raw)) continue;
            Map<String, Object> item = cast(raw);
            String id = String.valueOf(item.get("id"));
            if (item.get("id") == null) {
                problems.add(tag + ": có câu thiếu id");
                continue;
            }
            if (!ids.add(id)) {
                problems.add(tag + ": id câu hỏi trùng — " + id);
            }
            Object correct = item.get("correct");
            if (correct == null) {
                problems.add(tag + "/" + id + ": thiếu đáp án");
                continue;
            }
            count++;
            String answer = correct.toString().trim();
            if (item.get("options") instanceof Map<?, ?> options) {
                if (!options.containsKey(answer)) {
                    problems.add(tag + "/" + id + ": đáp án " + answer + " không nằm trong lựa chọn " + options.keySet());
                }
                if (options.size() < 2) {
                    problems.add(tag + "/" + id + ": dưới hai lựa chọn");
                }
            } else if (!answer.equalsIgnoreCase("richtig") && !answer.equalsIgnoreCase("falsch")
                    && !MATCHING_LETTERS.contains(answer)) {
                problems.add(tag + "/" + id + ": đáp án " + answer
                        + " không phải richtig/falsch, chữ cái A–H hay khoá lựa chọn");
            }
            if (strict && !(item.get("explanation_vi") instanceof String vi && !vi.isBlank())) {
                problems.add(tag + "/" + id + ": đề mới phải có explanation_vi cho màn ôn lại");
            }
        }
        return count;
    }

    private boolean hasAny(Map<String, Object> teil, String... keys) {
        for (String key : keys) {
            Object value = teil.get(key);
            if (value instanceof String s && !s.isBlank()) return true;
            if (value instanceof List<?> list && !list.isEmpty()) return true;
        }
        return false;
    }

    private List<Map<String, Object>> teile(Map<String, Object> section) {
        Object raw = section.get("teile");
        List<Map<String, Object>> out = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object value : list) {
                if (value instanceof Map<?, ?> m) out.add(cast(m));
            }
        } else if (raw instanceof Map<?, ?> map) {
            for (Object value : map.values()) {
                if (value instanceof Map<?, ?> m) out.add(cast(m));
            }
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Map<?, ?> map) {
        return (Map<String, Object>) map;
    }
}
