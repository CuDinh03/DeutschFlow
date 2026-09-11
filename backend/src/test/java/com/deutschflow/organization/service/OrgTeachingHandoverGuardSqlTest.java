package com.deutschflow.organization.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Canh cú pháp hai câu SQL của chốt lớp mồ côi (G-07).
 *
 * <p><b>Vì sao cần một ca chỉ đọc chuỗi:</b> mệnh đề chức danh được chèn vào giữa câu, và bản đầu
 * nối hai text block bằng {@code AND """ + TEACHING_MEMBER_PREDICATE}. Text block cắt khoảng trắng
 * cuối dòng, nên chuỗi chạy thật ra {@code ANDom.status = 'ACTIVE'} — mã đọc lên vẫn đúng, chỉ có
 * Postgres từ chối. Giá phải trả là 6 ca tích hợp đỏ ở tận đường rời/gỡ thành viên, cách xa chỗ
 * hỏng. Ca này bắt đúng chỗ hỏng, trong vài mili giây, không cần cơ sở dữ liệu.
 */
@DisplayName("SQL chốt lớp mồ côi (G-07)")
class OrgTeachingHandoverGuardSqlTest {

    @Test
    @DisplayName("🔴 mệnh đề chức danh ghép vào câu có khoảng trắng, không dính chữ")
    void teachingPredicateIsSpliced_withSurroundingSpace() {
        for (String sql : new String[] {
                OrgTeachingHandoverGuard.ORPHANED_CLASSES_SQL,
                OrgTeachingHandoverGuard.ORPHANED_NAMES_SQL}) {
            assertThat(sql)
                    .contains("AND " + OrgTeachingHandoverGuard.TEACHING_MEMBER_PREDICATE)
                    .doesNotContain("%s");
            // Không từ khoá nào được dính vào bí danh bảng đứng sau nó (ANDom., ORtc., …).
            assertThat(sql).doesNotContainPattern("(?i)\\b(AND|OR|NOT|WHERE)(om|tc|ct)\\.");
        }
    }

    @Test
    @DisplayName("hai câu hỏi cùng một câu hỏi — chỉ khác thứ lấy ra")
    void bothStatementsShareTheSameFilter() {
        String filterOf = OrgTeachingHandoverGuard.ORPHANED_CLASSES_SQL
                .substring(OrgTeachingHandoverGuard.ORPHANED_CLASSES_SQL.indexOf("WHERE"));
        assertThat(OrgTeachingHandoverGuard.ORPHANED_NAMES_SQL).contains(filterOf.trim());
    }
}
