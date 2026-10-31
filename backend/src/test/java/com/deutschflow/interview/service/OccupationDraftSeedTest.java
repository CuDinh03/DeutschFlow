package com.deutschflow.interview.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn nháp V350 (đợt 2f): nội dung soạn tay không đi qua {@code OccupationContentGenerator.parse}
 * nên phải tự giữ đúng luật của bộ sinh. Đọc thẳng file migration, như {@code OccupationCatalogSeedTest}.
 */
class OccupationDraftSeedTest {

    private static final String MIGRATION = "db/migration/V350__nhap_lop_nghe_dieu_duong_xay_dung.sql";
    private static final String TEXT = "'((?:[^']|'')*)'";
    private static final Pattern QUESTION = Pattern.compile(
            "\\('occ_(\\w+?)_2f\\d', " + TEXT + ", " + TEXT + ",\\s+" + TEXT + ",\\s+" + TEXT + ", '(BEGINNER|INTERMEDIATE|ADVANCED)'\\)");
    private static final Pattern TERM = Pattern.compile(
            "\\('(\\w+)', " + TEXT + ", " + TEXT + ", " + TEXT + ",\\s+" + TEXT + ", 'claude-nhap-2f'\\)");
    /** Chủ đề AGG cấm hỏi, như SYSTEM_PROMPT của bộ sinh. */
    private static final List<String> FORBIDDEN =
            List.of("gehalt", "religion", "alter ", "herkunft", "familie", "schwanger", "gesundheit");

    record Question(String code, String topic, String de, String vi, String en, String difficulty) {}

    record Term(String code, String de, String en, String vi, String example) {}

    private static String sql() throws IOException {
        try (InputStream in = OccupationDraftSeedTest.class.getClassLoader().getResourceAsStream(MIGRATION)) {
            assertThat(in).as("thiếu migration %s", MIGRATION).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("\r\n", "\n");
        }
    }

    private static List<Question> questions(String code) throws IOException {
        List<Question> out = new ArrayList<>();
        Matcher m = QUESTION.matcher(sql());
        while (m.find()) {
            if (m.group(1).equals(code)) {
                out.add(new Question(code, m.group(2), m.group(3), m.group(4), m.group(5), m.group(6)));
            }
        }
        return out;
    }

    private static List<Term> terms(String code) throws IOException {
        List<Term> out = new ArrayList<>();
        Matcher m = TERM.matcher(sql());
        while (m.find()) {
            if (m.group(1).equals(code)) {
                out.add(new Term(code, m.group(2), m.group(3), m.group(4), m.group(5)));
            }
        }
        return out;
    }

    @ParameterizedTest
    @ValueSource(strings = {"pflegefachkraft", "altenpfleger", "maurer", "bauhelfer"})
    @DisplayName("Mỗi nghề đúng 6 câu chia 2 dễ, 2 vừa, 2 khó, không câu có/không, không chủ đề AGG")
    void questionsFollowGeneratorRules(String code) throws IOException {
        List<Question> questions = questions(code);
        assertThat(questions).hasSize(OccupationContentGenerator.QUESTIONS_PER_OCCUPATION);
        assertThat(questions.stream().filter(q -> q.difficulty().equals("BEGINNER"))).hasSize(2);
        assertThat(questions.stream().filter(q -> q.difficulty().equals("INTERMEDIATE"))).hasSize(2);
        assertThat(questions.stream().filter(q -> q.difficulty().equals("ADVANCED"))).hasSize(2);

        for (Question q : questions) {
            assertThat(q.de().split("\\s+").length).as(q.de()).isLessThanOrEqualTo(30);
            assertThat(q.de()).as("câu hỏi mở hoặc yêu cầu mô tả").containsPattern("^(Wie|Welche|Worauf|Was|Mit welchen|Beschreiben)\\b");
            assertThat(q.vi()).as("thiếu bản dịch Việt").isNotBlank();
            assertThat(q.en()).as("thiếu bản dịch Anh").isNotBlank();
            assertThat(OccupationContentGenerator.topicKey(q.topic())).isEqualTo(q.topic());
            String lower = q.de().toLowerCase(Locale.ROOT);
            assertThat(FORBIDDEN).noneMatch(lower::contains);
        }
        assertThat(questions.stream().map(Question::de).distinct()).hasSize(questions.size());
    }

    @ParameterizedTest
    @ValueSource(strings = {"pflegefachkraft", "altenpfleger", "maurer", "bauhelfer"})
    @DisplayName("Mỗi nghề đúng 6 từ có mạo từ, nghĩa Anh + Việt, câu ví dụ vừa cột")
    void termsFollowGeneratorRules(String code) throws IOException {
        List<Term> terms = terms(code);
        assertThat(terms).hasSize(OccupationContentGenerator.TERMS_PER_OCCUPATION);
        for (Term t : terms) {
            assertThat(t.de()).as("danh từ kèm mạo từ").containsPattern("^(der|die|das) ");
            assertThat(t.de().length()).isLessThanOrEqualTo(120);
            assertThat(t.en().length()).isBetween(1, 200);
            assertThat(t.vi().length()).isBetween(1, 200);
            assertThat(t.example().length()).isBetween(1, 300);
        }
    }

    @Test
    @DisplayName("Không tự duyệt: nháp giữ status mặc định, trang nghề chưa được index")
    void draftsAreNeverApproved() throws IOException {
        assertThat(sql()).doesNotContain("'APPROVED'").doesNotContain("reviewed_by");
    }
}
