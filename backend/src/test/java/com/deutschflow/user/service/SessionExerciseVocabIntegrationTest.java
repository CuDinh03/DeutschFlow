package com.deutschflow.user.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Gác việc lấy từ vựng cá nhân hoá của {@link SessionExerciseService} — thứ mà unit test dùng mock
 * {@code JdbcTemplate} không bao giờ bắt được, vì lỗi nằm trong chuỗi SQL thô và chỉ lộ ra khi chạy
 * với schema thật.
 *
 * <p><b>Regression:</b> cả ba truy vấn đều sắp xếp bằng {@code ORDER BY RAND(? + ?)} — cú pháp
 * MySQL. Project chạy PostgreSQL (không migration nào định nghĩa hàm {@code rand}), nên mọi truy vấn
 * ném {@code function rand(bigint) does not exist}. Lỗi bị {@code catch (Exception)} trong
 * {@code fetchPersonalizedVocab} nuốt → luôn trả về danh sách RỖNG.
 *
 * <p><b>Vì sao không ai báo lỗi:</b> {@link TheoryBasedExerciseGenerator#generate} kiểm tra
 * {@code if (!dbVocabs.isEmpty())} rồi lặng lẽ rơi về bộ từ vựng hardcode. Học viên vẫn nhận đủ bài
 * tập, chỉ là toàn bộ phần cá nhân hoá theo ngành nghề/sở thích lấy từ DB đã chết — không HTTP 500,
 * không log, không dấu hiệu nào.
 */
@SpringBootTest
@EnabledIf("com.deutschflow.testsupport.TestcontainersPostgresConditions#integrationPostgresAvailable")
class SessionExerciseVocabIntegrationTest extends AbstractPostgresIntegrationTest {

    /** Ngành nghề riêng của test: chỉ khớp tag do test tạo, không đụng dữ liệu migration seed. */
    private static final String INDUSTRY = "itvocabprobe";

    /** Tiền tố base_form để dọn dẹp chính xác các dòng của test. */
    private static final String MARKER = "ITVOCAB_";

    /** Đủ lớn hơn LIMIT 12 của truy vấn industry để thứ tự sắp xếp thực sự quyết định chọn dòng nào. */
    private static final int SEEDED_WORDS = 24;

    private static final long USER_ID = 910_001L;
    private static final int WEEK = 3;
    private static final int SESSION_INDEX = 2;

    @Autowired
    private SessionExerciseService service;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void seedVocabulary() {
        cleanup();
        jdbc.update("INSERT INTO tags(name) VALUES (?)", INDUSTRY + "-tag");
        Long tagId = jdbc.queryForObject("SELECT id FROM tags WHERE name = ?", Long.class, INDUSTRY + "-tag");

        for (int i = 1; i <= SEEDED_WORDS; i++) {
            String baseForm = MARKER + i;
            Long wordId = jdbc.queryForObject(
                    "INSERT INTO words(dtype, base_form, cefr_level) VALUES ('NOUN', ?, 'A1') RETURNING id",
                    Long.class, baseForm);
            // Truy vấn đòi nghĩa vi/en, và nhánh fallback còn đòi ví dụ tiếng Đức khác rỗng.
            jdbc.update("INSERT INTO word_translations(word_id, locale, meaning) VALUES (?, 'vi', ?)",
                    wordId, "nghia " + i);
            jdbc.update("INSERT INTO word_translations(word_id, locale, meaning, example) VALUES (?, 'de', ?, ?)",
                    wordId, "Bedeutung " + i, "Das ist " + baseForm + ".");
            jdbc.update("INSERT INTO word_tags(word_id, tag_id) VALUES (?, ?)", wordId, tagId);
        }
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM words WHERE base_form LIKE ?", MARKER + "%");
        jdbc.update("DELETE FROM tags WHERE name = ?", INDUSTRY + "-tag");
    }

    @Test
    void industryVocab_returnsRowsFromDatabase() {
        List<TheoryBasedExerciseGenerator.SourceVocab> vocab = fetchAttempt(0);

        // Trước khi sửa: RỖNG — RAND() nổ trên Postgres rồi bị nuốt.
        assertThat(vocab).isNotEmpty();
        assertThat(vocab).hasSize(12); // LIMIT 12 của truy vấn industry
        assertThat(vocab).allSatisfy(v -> {
            assertThat(v.german()).startsWith(MARKER);
            assertThat(v.meaning()).isNotBlank();
            assertThat(v.tag()).isEqualTo("job");
        });
    }

    @Test
    void generalFallback_returnsRowsWhenNoIndustryOrInterests() {
        // Không industry, không interests → chỉ chạy truy vấn fallback theo CEFR A1.
        List<TheoryBasedExerciseGenerator.SourceVocab> vocab =
                service.fetchPersonalizedVocab(USER_ID, null, List.of(), WEEK, SESSION_INDEX, 0);

        assertThat(vocab).isNotEmpty();
        assertThat(vocab).allSatisfy(v -> assertThat(v.german()).isNotBlank());
    }

    @Test
    void sameSeed_returnsIdenticalSelection() {
        // Cùng (user, tuần, buổi, lần làm) → phải ra đúng một kết quả, kể cả thứ tự.
        assertThat(fetchAttempt(0)).isEqualTo(fetchAttempt(0));
        assertThat(fetchAttempt(4)).isEqualTo(fetchAttempt(4));
    }

    @Test
    void differentAttempt_changesSelection() {
        List<TheoryBasedExerciseGenerator.SourceVocab> first = fetchAttempt(0);

        // Seed thực sự tham gia ORDER BY: đổi attempt phải đổi được kết quả.
        assertThat(List.of(fetchAttempt(1), fetchAttempt(2), fetchAttempt(3), fetchAttempt(4)))
                .as("đổi attemptCount phải cho ra bộ từ vựng khác — nếu tất cả giống nhau thì seed bị bỏ qua")
                .anySatisfy(other -> assertThat(other).isNotEqualTo(first));
    }

    @Test
    void differentSession_changesSelection() {
        List<TheoryBasedExerciseGenerator.SourceVocab> session2 =
                service.fetchPersonalizedVocab(USER_ID, INDUSTRY, List.of(), WEEK, 2, 0);

        assertThat(List.of(1, 3, 4, 5))
                .as("đổi buổi học phải cho ra bộ từ vựng khác")
                .anySatisfy(idx -> assertThat(service.fetchPersonalizedVocab(USER_ID, INDUSTRY, List.of(), WEEK, idx, 0))
                        .isNotEqualTo(session2));
    }

    private List<TheoryBasedExerciseGenerator.SourceVocab> fetchAttempt(int attemptCount) {
        return service.fetchPersonalizedVocab(USER_ID, INDUSTRY, List.of(), WEEK, SESSION_INDEX, attemptCount);
    }
}
