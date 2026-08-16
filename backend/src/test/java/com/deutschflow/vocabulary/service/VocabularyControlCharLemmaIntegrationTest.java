package com.deutschflow.vocabulary.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bảo vệ bản vá lemma dính ký tự điều khiển (QA Admin 2026-08-16).
 *
 * <p>Bộ trích PDF Goethe cũ đặt TAB sai ranh giới cột nên {@code base_form} nuốt luôn từ đầu của
 * câu ví dụ ({@code "Salz<TAB>Entschuldigung"}). Đo trên mẫu 2.314 bản ghi prod: 5 dòng (0,22%).
 *
 * <p>Điều test này khoá lại là <b>quyết định theo từng dòng</b> — thứ mà một bản vá "cắt cụt tất cả"
 * sẽ làm sai: 4/5 ca có lemma chuẩn ĐÃ tồn tại ở dòng khác, mà kho hiện không có lemma trùng nào,
 * nên cắt cụt sẽ tạo bản trùng đầu tiên. Và 1.939 lemma chứa DẤU CÁCH ({@code "das Auto"}) là hợp
 * lệ, tuyệt đối không được đụng tới.
 */
@SpringBootTest
@DisplayName("vocabulary cleanup · lemma dính TAB: xoá khi trùng, sửa khi không trùng")
class VocabularyControlCharLemmaIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private VocabularyCleanupService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long insertWord(String baseForm, String dtype, String cefr) {
        return jdbcTemplate.queryForObject(
                "INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at)" +
                " VALUES (?, ?, ?, NOW(), NOW()) RETURNING id",
                Long.class, dtype, baseForm, cefr);
    }

    @Test
    @DisplayName("có lemma chuẩn ở dòng khác → XOÁ dòng hỏng; không có → SỬA base_form")
    void repairsOrDeletesPerRow() {
        String uniq = "ZZQA" + System.nanoTime();

        // (1) Dòng hỏng CÓ bản chuẩn tồn tại sẵn → phải XOÁ (cắt cụt sẽ đẻ ra bản trùng).
        String canonicalForm = uniq + "Kanon";
        long canonicalId = insertWord(canonicalForm, "Noun", "A1");
        long redundantId = insertWord(canonicalForm + "\tEntschuldigung", "Noun", "A1");

        // (2) Dòng hỏng KHÔNG có bản chuẩn → phải SỬA về phần trước TAB.
        String loneForm = uniq + "Allein";
        long loneId = insertWord(loneForm + "\tKomm", "Noun", "A1");

        // (3) Lemma hợp lệ chứa DẤU CÁCH → không bao giờ được đụng tới.
        String spacedForm = "das " + uniq + "Auto";
        long spacedId = insertWord(spacedForm, "Noun", "A1");

        Map<String, Object> dry = service.repairControlCharLemmas(500, true);
        assertThat(dry.get("dryRun")).isEqualTo(true);
        assertThat(dry.get("repaired")).isEqualTo(0);
        assertThat(dry.get("deleted")).isEqualTo(0);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> plan = (List<Map<String, Object>>) dry.get("plan");
        assertThat(plan).as("dry-run phải nêu kế hoạch cho cả 2 dòng hỏng")
                .anySatisfy(p -> {
                    assertThat(p.get("id")).isEqualTo(redundantId);
                    assertThat(p.get("action")).isEqualTo("delete_redundant");
                })
                .anySatisfy(p -> {
                    assertThat(p.get("id")).isEqualTo(loneId);
                    assertThat(p.get("action")).isEqualTo("repair");
                    assertThat(p.get("trimmed")).isEqualTo(loneForm);
                });
        assertThat(plan).as("lemma có dấu cách KHÔNG được lọt vào kế hoạch")
                .noneSatisfy(p -> assertThat(p.get("id")).isEqualTo(spacedId));

        // Dry-run không được ghi gì.
        assertThat(countById(redundantId)).isEqualTo(1);
        assertThat(baseFormOf(loneId)).isEqualTo(loneForm + "\tKomm");

        service.repairControlCharLemmas(500, false);

        assertThat(countById(redundantId)).as("dòng thừa phải bị xoá").isZero();
        assertThat(countById(canonicalId)).as("bản chuẩn phải còn nguyên").isEqualTo(1);
        assertThat(baseFormOf(loneId)).as("dòng không trùng phải được sửa").isEqualTo(loneForm);
        assertThat(baseFormOf(spacedId)).as("lemma có dấu cách phải nguyên vẹn").isEqualTo(spacedForm);

        jdbcTemplate.update("DELETE FROM words WHERE id IN (?,?,?)", canonicalId, loneId, spacedId);
    }

    private int countById(long id) {
        Integer n = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM words WHERE id = ?", Integer.class, id);
        return n == null ? 0 : n;
    }

    private String baseFormOf(long id) {
        return jdbcTemplate.queryForObject("SELECT base_form FROM words WHERE id = ?", String.class, id);
    }
}
