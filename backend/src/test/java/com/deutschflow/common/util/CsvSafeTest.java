package com.deutschflow.common.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * C4/F-M13 (03/09/2026): CSV formula injection — ô mở đầu = + - @ (tab/CR) phải bị prefix ' trước
 * khi bọc nháy, để Excel/Sheets không chạy nó như công thức khi mở file export.
 */
@DisplayName("CsvSafe.quote — trung hoà công thức + bọc nháy RFC-4180")
class CsvSafeTest {

    @Test
    @DisplayName("ô mở đầu = + - @ tab CR đều bị prefix ' (trong lớp nháy)")
    void neutralizesFormulaLeadingChars() {
        assertThat(CsvSafe.quote("=SUM(A1:A9)")).isEqualTo("\"'=SUM(A1:A9)\"");
        assertThat(CsvSafe.quote("+1")).isEqualTo("\"'+1\"");
        assertThat(CsvSafe.quote("-2")).isEqualTo("\"'-2\"");
        assertThat(CsvSafe.quote("@cmd")).isEqualTo("\"'@cmd\"");
        assertThat(CsvSafe.quote("\tx")).isEqualTo("\"'\tx\"");
        assertThat(CsvSafe.quote("\rx")).isEqualTo("\"'\rx\"");
    }

    @Test
    @DisplayName("payload kinh điển =cmd|... vẫn thành text, không còn mở đầu bằng =")
    void neutralizesClassicExecPayload() {
        String out = CsvSafe.quote("=cmd|'/c calc'!A1");
        assertThat(out).startsWith("\"'=");     // ' chèn ngay sau dấu nháy mở
        assertThat(out).doesNotStartWith("\"=");
    }

    @Test
    @DisplayName("tên người bình thường không bị prefix, chỉ bọc nháy")
    void leavesNormalTextAlone() {
        assertThat(CsvSafe.quote("Nguyễn Văn A")).isEqualTo("\"Nguyễn Văn A\"");
        assertThat(CsvSafe.quote("Anna-Lena")).isEqualTo("\"Anna-Lena\""); // '-' KHÔNG ở đầu → không prefix
    }

    @Test
    @DisplayName("nháy kép trong nội dung được nhân đôi; null/rỗng → ô rỗng")
    void escapesQuotesAndHandlesNull() {
        assertThat(CsvSafe.quote("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
        assertThat(CsvSafe.quote(null)).isEqualTo("\"\"");
        assertThat(CsvSafe.quote("")).isEqualTo("\"\"");
    }
}
