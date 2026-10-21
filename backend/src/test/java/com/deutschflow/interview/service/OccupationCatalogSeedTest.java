package com.deutschflow.interview.service;

import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewQuestionBank;
import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn dữ liệu seed V334 (danh mục nghề, đợt 2a A + B + E).
 *
 * <p>Đọc thẳng file migration — không cần DB — để bắt lỗi trước khi Flyway chạy trên prod:
 * nhân vật cũ gõ sai thì nghề rơi về bộ chung mà không ai biết; tên nghề dài quá 100 ký tự thì
 * {@code ai_speaking_sessions.interview_position} từ chối khi tạo phiên.
 */
class OccupationCatalogSeedTest {

    private static final String MIGRATION = "db/migration/V334__occupation_catalog.sql";
    private static final Set<String> WORKPLACES =
            Set.of("gastro", "pflege", "bau", "industrie", "logistik", "handel", "buero", "bildung");

    /** Một dòng VALUES: code, name_de, name_en, name_vi, workplace, aliases, persona, position, rank. */
    record Row(String code, String nameDe, String nameEn, String nameVi, String workplace,
               String aliases, String persona, String position) {}

    @Test
    void seedHasAtLeast150UniqueOccupationsWithValidFields() {
        List<Row> rows = rows();
        assertThat(rows).hasSizeGreaterThanOrEqualTo(150);

        Set<String> codes = new HashSet<>();
        for (Row r : rows) {
            assertThat(codes.add(r.code())).as("mã nghề trùng: %s", r.code()).isTrue();
            assertThat(r.code()).matches("[a-z0-9_]{2,64}");
            assertThat(WORKPLACES).as("workplace của %s", r.code()).contains(r.workplace());
            assertThat(r.nameDe()).isNotBlank();
            assertThat(r.nameEn()).isNotBlank();
            assertThat(r.nameVi()).isNotBlank();
            // interviewPosition gửi lên phiên là tên nghề (khi không có nhãn cũ) — cột VARCHAR(100).
            assertThat(r.nameDe().length()).as("tên nghề %s quá dài cho interview_position", r.code())
                    .isLessThanOrEqualTo(100);
        }
        assertThat(rows.stream().map(Row::workplace).distinct()).hasSize(WORKPLACES.size());
    }

    @Test
    void legacyPersonaMappingPointsToRealPersonasWithHandwrittenQuestions() {
        Set<String> pairs = new HashSet<>();
        for (Row r : rows()) {
            assertThat(r.persona() == null).as("persona/position phải đi cặp: %s", r.code())
                    .isEqualTo(r.position() == null);
            if (r.persona() == null) {
                continue;
            }
            SpeakingPersona persona = SpeakingPersona.valueOf(r.persona());
            assertThat(pairs.add(r.persona() + "|" + r.position()))
                    .as("vị trí cũ ánh xạ hai lần: %s", r.position()).isTrue();
            assertThat(InterviewQuestionBank.forPersona(persona, r.position()).stream()
                    .filter(q -> q.phase() == InterviewPhase.HARD_SKILLS)
                    .filter(q -> !q.id().startsWith("gen_")))
                    .as("%s → %s phải có bộ câu hỏi viết tay riêng", r.code(), r.persona())
                    .isNotEmpty();
        }
    }

    @Test
    void nursingAndConstructionStayOnGeneralQuestionsUntilReviewed() {
        // Sổ lời hứa: Điều dưỡng và Xây dựng ghi "Sắp có" cho tới khi duyệt xong ở đợt 2. Không được
        // gắn lén một nhân vật khác để chúng trông như đã có bộ câu hỏi riêng.
        for (Row r : rows()) {
            if (r.workplace().equals("bau") || r.code().contains("pfleg") || r.code().equals("hebamme")) {
                assertThat(r.persona()).as("%s chưa được có bộ câu hỏi riêng", r.code()).isNull();
            }
        }
    }

    // ── đọc SQL ──────────────────────────────────────────────────────────────

    static List<Row> rows() {
        String sql = readMigration();
        int start = sql.indexOf("VALUES");
        int end = sql.lastIndexOf("ON CONFLICT");
        assertThat(start).isPositive();
        String body = sql.substring(start + "VALUES".length(), end);
        List<Row> rows = new ArrayList<>();
        for (List<String> f : tuples(body)) {
            assertThat(f).hasSize(9);
            rows.add(new Row(f.get(0), f.get(1), f.get(2), f.get(3), f.get(4), f.get(5), f.get(6), f.get(7)));
        }
        return rows;
    }

    /** Tách các bộ (...) thành danh sách trường; chuỗi '..' (có '' thoát), NULL → null, số giữ nguyên. */
    private static List<List<String>> tuples(String body) {
        List<List<String>> out = new ArrayList<>();
        List<String> cur = null;
        int i = 0;
        while (i < body.length()) {
            char c = body.charAt(i);
            if (c == '(') {
                cur = new ArrayList<>();
                i++;
            } else if (c == ')') {
                out.add(cur);
                cur = null;
                i++;
            } else if (cur != null && c == '\'') {
                StringBuilder sb = new StringBuilder();
                i++;
                while (true) {
                    char d = body.charAt(i);
                    if (d == '\'' && i + 1 < body.length() && body.charAt(i + 1) == '\'') {
                        sb.append('\'');
                        i += 2;
                    } else if (d == '\'') {
                        i++;
                        break;
                    } else {
                        sb.append(d);
                        i++;
                    }
                }
                cur.add(sb.toString());
            } else if (cur != null && Character.isLetterOrDigit(c)) {
                int j = i;
                while (j < body.length() && Character.isLetterOrDigit(body.charAt(j))) {
                    j++;
                }
                String token = body.substring(i, j);
                cur.add(token.equals("NULL") ? null : token);
                i = j;
            } else {
                i++;
            }
        }
        return out;
    }

    private static String readMigration() {
        try (InputStream is = OccupationCatalogSeedTest.class.getClassLoader().getResourceAsStream(MIGRATION)) {
            if (is != null) {
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (IOException ignored) {
            // fall through to filesystem
        }
        try {
            return Files.readString(Path.of("src/main/resources/" + MIGRATION), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + MIGRATION, e);
        }
    }
}
