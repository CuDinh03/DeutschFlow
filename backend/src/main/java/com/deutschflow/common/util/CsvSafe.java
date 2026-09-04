package com.deutschflow.common.util;

/**
 * An toàn hoá một ô CSV (audit C4/F-M13, 03/09/2026).
 *
 * <p>Gộp hai việc mà mọi export CSV có chứa text do người dùng nhập (tên giáo viên, tên người chấm)
 * đều cần: (1) trung hoà <b>CSV formula injection</b> — một ô mở đầu bằng {@code = + - @} (hoặc
 * tab/CR) sẽ bị Excel/Google Sheets diễn giải là công thức khi mở file, nên prefix một dấu nháy đơn
 * để ép về text; (2) bọc nháy kép theo RFC-4180 và nhân đôi nháy trong nội dung. Bước (1) phải chạy
 * TRƯỚC (2) — nếu bọc nháy trước thì ô đã mở bằng {@code "} chứ không còn là {@code =...}.
 */
public final class CsvSafe {

    /** Ký tự mở đầu bị coi là công thức (OWASP CSV injection). */
    private static final String FORMULA_PREFIXES = "=+-@\t\r";

    private CsvSafe() {}

    /** Trung hoà công thức rồi bọc nháy RFC-4180. {@code null} → ô rỗng {@code ""}. */
    public static String quote(String raw) {
        String v = raw == null ? "" : raw;
        if (!v.isEmpty() && FORMULA_PREFIXES.indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        return '"' + v.replace("\"", "\"\"") + '"';
    }
}
