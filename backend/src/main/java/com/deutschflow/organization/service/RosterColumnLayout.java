package com.deutschflow.organization.service;

import java.util.HashSet;
import java.util.Set;

/**
 * Cột nào nằm ở vị trí nào trong tệp roster CSV — giải MỘT LẦN từ dòng tiêu đề, rồi dùng cho mọi
 * dòng dữ liệu.
 *
 * <p><b>Cột mới là TÙY CHỌN, và đó là điều kiện tiên quyết</b> (owner chốt 09/09/2026). Trung tâm
 * đang dùng tệp {@code email,displayName,phone}; một hợp đồng bốn cột bắt buộc sẽ làm mọi tệp đang
 * có hỏng ngay lần nhập kế tiếp. Nên: có cột {@code birthDate} trong tiêu đề thì đọc phần dữ liệu
 * chưa thành niên; KHÔNG có thì {@link #legacy()} — hành vi y hệt trước PR-1B, không một dòng nào
 * đổi kết quả.
 *
 * <p><b>Vì sao dò theo TÊN chứ không chỉ đếm vị trí.</b> Vị trí thuần thì một tệp
 * {@code email,birthDate} (không có tên hiển thị) sẽ đọc ngày sinh vào ô tên và tạo tài khoản tên
 * "2010-05-01". Dò theo tên rồi mới lùi về vị trí mặc định — và chỉ lùi khi vị trí đó CHƯA bị một
 * cột có tên khác chiếm — thì cả hai kiểu tệp đều đọc đúng.
 *
 * <p>Tên cột so khớp sau khi bỏ hết ký tự không phải chữ/số và hạ chữ thường, nên
 * {@code birthDate}, {@code birth_date}, {@code "Birth Date"} là một.
 *
 * @param email       vị trí cột email; luôn ≥ 0
 * @param displayName vị trí cột tên hiển thị, {@code -1} nếu tệp không có
 * @param birthDate   vị trí cột ngày sinh, {@code -1} nếu tệp không có (⇒ chế độ cũ)
 */
public record RosterColumnLayout(
        int email,
        int displayName,
        int birthDate,
        int guardianName,
        int guardianPhone,
        int guardianRelationship
) {

    private static final String COL_EMAIL = "email";
    private static final String COL_DISPLAY_NAME = "displayname";
    private static final String COL_PHONE = "phone";
    private static final String COL_BIRTH_DATE = "birthdate";
    private static final String COL_GUARDIAN_NAME = "guardianname";
    private static final String COL_GUARDIAN_PHONE = "guardianphone";
    private static final String COL_GUARDIAN_RELATIONSHIP = "guardianrelationship";

    /** Mọi tên cột hệ thống hiểu — dùng để biết vị trí nào đã "có chủ" trước khi lùi về mặc định. */
    private static final String[] KNOWN = {
            COL_EMAIL, COL_DISPLAY_NAME, COL_PHONE, COL_BIRTH_DATE,
            COL_GUARDIAN_NAME, COL_GUARDIAN_PHONE, COL_GUARDIAN_RELATIONSHIP
    };

    private static final int DEFAULT_EMAIL_INDEX = 0;
    private static final int DEFAULT_DISPLAY_NAME_INDEX = 1;

    /**
     * Bố cục của tệp KHÔNG có dòng tiêu đề, hoặc có tiêu đề nhưng không có cột {@code birthDate}:
     * {@code email,displayName[,phone]} như trước.
     */
    public static RosterColumnLayout legacy() {
        return new RosterColumnLayout(DEFAULT_EMAIL_INDEX, DEFAULT_DISPLAY_NAME_INDEX, -1, -1, -1, -1);
    }

    /**
     * Dòng này có phải TIÊU ĐỀ không: ô ĐẦU TIÊN đúng bằng {@code "email"}.
     *
     * <p>Giữ nguyên chốt cũ, cố ý. Soi cả dòng xem có chứa "email" sẽ bỏ nhầm một dòng dữ liệu có
     * địa chỉ kiểu {@code emailguy@x.com}; nới ra "ô nào cũng được" thì một dòng dữ liệu hỏng lệch
     * cột cũng thành tiêu đề. Nới chỗ này là nới đường mất dữ liệu im lặng.
     */
    public static boolean isHeader(String[] cols) {
        return cols.length > 0 && cols[0] != null && cols[0].trim().equalsIgnoreCase(COL_EMAIL);
    }

    /**
     * Giải bố cục từ dòng tiêu đề. Không có cột {@code birthDate} ⇒ {@link #legacy()}, tức tệp cũ
     * của trung tâm chạy đúng như chưa từng có PR này.
     */
    public static RosterColumnLayout fromHeader(String[] headerCols) {
        int birthDate = indexOf(headerCols, COL_BIRTH_DATE);
        if (birthDate < 0) {
            return legacy();
        }
        Set<Integer> claimed = claimedIndexes(headerCols);
        return new RosterColumnLayout(
                orDefault(indexOf(headerCols, COL_EMAIL), DEFAULT_EMAIL_INDEX, claimed),
                orDefault(indexOf(headerCols, COL_DISPLAY_NAME), DEFAULT_DISPLAY_NAME_INDEX, claimed),
                birthDate,
                indexOf(headerCols, COL_GUARDIAN_NAME),
                indexOf(headerCols, COL_GUARDIAN_PHONE),
                indexOf(headerCols, COL_GUARDIAN_RELATIONSHIP));
    }

    /** Đúng khi tệp khai cột ngày sinh — chỉ khi đó mới đọc phần dữ liệu chưa thành niên. */
    public boolean readsMinorColumns() {
        return birthDate >= 0;
    }

    private static Set<Integer> claimedIndexes(String[] headerCols) {
        Set<Integer> claimed = new HashSet<>();
        for (String name : KNOWN) {
            int idx = indexOf(headerCols, name);
            if (idx >= 0) {
                claimed.add(idx);
            }
        }
        return claimed;
    }

    /** Vị trí mặc định chỉ dùng được khi CHƯA có cột nào tên khác đứng ở đó. */
    private static int orDefault(int found, int fallback, Set<Integer> claimed) {
        if (found >= 0) {
            return found;
        }
        return claimed.contains(fallback) ? -1 : fallback;
    }

    private static int indexOf(String[] headerCols, String normalizedName) {
        for (int i = 0; i < headerCols.length; i++) {
            if (normalizedName.equals(normalize(headerCols[i]))) {
                return i;
            }
        }
        return -1;
    }

    /** Bỏ mọi ký tự không phải chữ/số rồi hạ chữ thường: {@code "Birth Date"} → {@code birthdate}. */
    private static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (Character.isLetterOrDigit(c)) {
                sb.append(Character.toLowerCase(c));
            }
        }
        return sb.toString();
    }
}
