package com.deutschflow.organization.service;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Cột nào nằm ở vị trí nào trong tệp roster CSV — giải MỘT LẦN từ dòng tiêu đề, rồi dùng cho mọi
 * dòng dữ liệu.
 *
 * <p><b>Cột mới là TÙY CHỌN, và đó là điều kiện tiên quyết</b> (owner chốt 09/09/2026). Trung tâm
 * đang dùng tệp {@code email,displayName,phone}; một hợp đồng bốn cột bắt buộc sẽ làm mọi tệp đang
 * có hỏng ngay lần nhập kế tiếp. Nên: có cột {@code birthDate} (hoặc {@code consentConfirmed} /
 * {@code reportSharingConfirmed}, xem dưới) trong tiêu đề thì đọc phần dữ liệu chưa thành niên; KHÔNG
 * có thì {@link #legacy()} — hành vi y hệt trước PR-1B, không một dòng nào đổi kết quả.
 *
 * <p><b>Vì sao dò theo TÊN chứ không chỉ đếm vị trí.</b> Vị trí thuần thì một tệp
 * {@code email,birthDate} (không có tên hiển thị) sẽ đọc ngày sinh vào ô tên và tạo tài khoản tên
 * "2010-05-01". Dò theo tên rồi mới lùi về vị trí mặc định — và chỉ lùi khi vị trí đó CHƯA bị một
 * cột có tên khác chiếm — thì cả hai kiểu tệp đều đọc đúng. Ba cột của đợt D1/R11/R6
 * ({@code guardianEmail}, {@code consentConfirmed}, {@code reportSharingConfirmed}) CHỈ dò theo tên,
 * không có vị trí mặc định.
 *
 * <p><b>Vì sao {@code consentConfirmed} cũng bật chế độ đọc theo tên.</b> Luồng thật của trung tâm:
 * nhập roster có ngày sinh hôm nay, vài tuần sau thu xong phiếu giấy và muốn đánh dấu hàng loạt bằng
 * một tệp {@code email,consentConfirmed}. Nếu chỉ {@code birthDate} mới bật chế độ mới thì tệp đó rơi
 * về {@link #legacy()} và cột đồng ý bị BỎ QUA IM LẶNG — trung tâm tin là đã ghi nhận, phần nói của
 * học viên vẫn khoá. Cột đồng ý có mặt là đủ để biết đây là tệp kiểu mới. {@code reportSharingConfirmed}
 * (R6, mục C2 của phiếu giấy) bật chế độ này vì cùng một lý do: một tệp {@code email,reportSharingConfirmed}
 * đánh dấu hàng loạt sau khi thu phiếu mà bị bỏ qua im lặng thì phiếu đánh giá của học viên chưa
 * thành niên không bao giờ gửi được cho gia đình, mà trung tâm lại tin là đã xong.
 *
 * <p>Tên cột so khớp sau khi bỏ dấu tiếng Việt, bỏ hết ký tự không phải chữ/số và hạ chữ thường, nên
 * {@code birthDate}, {@code birth_date}, {@code "Birth Date"} là một — và {@code "Đã xác nhận đồng
 * ý"} khớp bí danh {@code daxacnhandongy}. Bỏ dấu là để thư ký trung tâm đặt tên cột bằng tiếng
 * Việt được; nó chỉ làm NHIỀU tiêu đề khớp hơn, không làm tiêu đề nào đang khớp thôi khớp.
 *
 * @param email                  vị trí cột email; luôn ≥ 0
 * @param displayName            vị trí cột tên hiển thị, {@code -1} nếu tệp không có
 * @param birthDate              vị trí cột ngày sinh, {@code -1} nếu tệp không có
 * @param guardianEmail          vị trí cột email người giám hộ (R11), {@code -1} nếu tệp không có
 * @param consentConfirmed       vị trí cột "đã xác nhận đồng ý" ghi âm (D1), {@code -1} nếu tệp không có
 * @param reportSharingConfirmed vị trí cột "đã xác nhận đồng ý chia sẻ phiếu đánh giá với người giám
 *                               hộ" (R6, scope {@code GUARDIAN_REPORT_SHARING}), {@code -1} nếu tệp không có
 * @param aiProcessingConfirmed  vị trí cột "đã xác nhận đồng ý cho AI chấm bài làm" (C3 của phiếu
 *                               giấy {@code 2026-10}, scope {@code AI_PROCESSING}), {@code -1} nếu
 *                               tệp không có
 */
public record RosterColumnLayout(
        int email,
        int displayName,
        int birthDate,
        int guardianName,
        int guardianPhone,
        int guardianRelationship,
        int guardianEmail,
        int consentConfirmed,
        int reportSharingConfirmed,
        int aiProcessingConfirmed
) {

    private static final String COL_EMAIL = "email";
    private static final String COL_DISPLAY_NAME = "displayname";
    private static final String COL_PHONE = "phone";
    private static final String COL_BIRTH_DATE = "birthdate";
    private static final String COL_GUARDIAN_NAME = "guardianname";
    private static final String COL_GUARDIAN_PHONE = "guardianphone";
    private static final String COL_GUARDIAN_RELATIONSHIP = "guardianrelationship";
    private static final String COL_GUARDIAN_EMAIL = "guardianemail";
    private static final String COL_CONSENT_CONFIRMED = "consentconfirmed";
    private static final String COL_REPORT_SHARING_CONFIRMED = "reportsharingconfirmed";
    private static final String COL_AI_PROCESSING_CONFIRMED = "aiprocessingconfirmed";

    /**
     * Bí danh của cột email người giám hộ — tên chính đứng đầu. Người đặt tên cột là thư ký trung
     * tâm; "Email giám hộ" là cách họ sẽ gõ, không phải {@code guardianEmail}.
     */
    static final List<String> GUARDIAN_EMAIL_ALIASES = List.of(
            COL_GUARDIAN_EMAIL, "emailgiamho", "emailnguoigiamho");

    /**
     * Bí danh của cột xác nhận đồng ý — tên chính đứng đầu. Cố ý nhận cả {@code consent} trần và
     * các cách viết tiếng Việt thường gặp trên một tệp thu phiếu giấy.
     */
    static final List<String> CONSENT_CONFIRMED_ALIASES = List.of(
            COL_CONSENT_CONFIRMED, "consent", "guardianconsent", "consentgranted",
            "dongy", "dadongy", "xacnhandongy", "daxacnhandongy", "dongygiamho", "phieudongy");

    /**
     * Bí danh của cột xác nhận đồng ý CHIA SẺ PHIẾU ĐÁNH GIÁ với người giám hộ (R6, mục C2 của phiếu
     * giấy) — tên chính đứng đầu. Cố ý KHÔNG có bí danh nào trùng hay là tiền tố mơ hồ của
     * {@link #CONSENT_CONFIRMED_ALIASES}: "Đồng ý chia sẻ phiếu" gấp thành {@code dongychiasephieu},
     * khác hẳn {@code dongy} — so khớp là so cả chuỗi, nên hai cột không thể nhận nhầm nhau.
     */
    static final List<String> REPORT_SHARING_CONFIRMED_ALIASES = List.of(
            COL_REPORT_SHARING_CONFIRMED, "reportsharing", "reportsharingconsent", "guardianreportsharing",
            "chiasephieu", "dongychiasephieu", "chiasephieudanhgia", "dongychiasephieudanhgia",
            "chiasephieuvoigiamho", "guiphieuphuhuynh");

    /**
     * Bí danh của cột xác nhận đồng ý CHẤM BÀI BẰNG AI (C3 của phiếu giấy {@code 2026-10}) — tên
     * chính đứng đầu. Cùng luật đặt tên với hai cột trên: không bí danh nào trùng hay là cả chuỗi
     * của một bí danh cột khác, vì so khớp là so CẢ chuỗi đã gấp dấu.
     *
     * <p>Cột này có mặt vì D3 (owner chốt 10/09/2026) làm phạm vi {@code AI_PROCESSING} có hiệu lực
     * thật: học viên vị thành niên của trung tâm không có đồng ý này thì bài viết phải giáo viên
     * chấm tay. Không có đường nhập hàng loạt thì trung tâm thu được phiếu giấy cũng không ghi nhận
     * nổi cho cả lớp.
     */
    static final List<String> AI_PROCESSING_CONFIRMED_ALIASES = List.of(
            COL_AI_PROCESSING_CONFIRMED, "aiprocessing", "aigrading", "aiprocessingconsent",
            "chambangai", "dongychambangai", "chamaibaiviet", "dongychamai", "aichambai");

    /** Mọi tên cột hệ thống hiểu — dùng để biết vị trí nào đã "có chủ" trước khi lùi về mặc định. */
    private static final List<String> KNOWN;

    static {
        List<String> known = new java.util.ArrayList<>(List.of(
                COL_EMAIL, COL_DISPLAY_NAME, COL_PHONE, COL_BIRTH_DATE,
                COL_GUARDIAN_NAME, COL_GUARDIAN_PHONE, COL_GUARDIAN_RELATIONSHIP));
        known.addAll(GUARDIAN_EMAIL_ALIASES);
        known.addAll(CONSENT_CONFIRMED_ALIASES);
        known.addAll(REPORT_SHARING_CONFIRMED_ALIASES);
        known.addAll(AI_PROCESSING_CONFIRMED_ALIASES);
        KNOWN = List.copyOf(known);
    }

    private static final int DEFAULT_EMAIL_INDEX = 0;
    private static final int DEFAULT_DISPLAY_NAME_INDEX = 1;

    /**
     * Bố cục của tệp KHÔNG có dòng tiêu đề, hoặc có tiêu đề nhưng không có cột {@code birthDate},
     * {@code consentConfirmed}, {@code reportSharingConfirmed} lẫn {@code aiProcessingConfirmed}:
     * {@code email,displayName[,phone]} như trước.
     */
    public static RosterColumnLayout legacy() {
        return new RosterColumnLayout(DEFAULT_EMAIL_INDEX, DEFAULT_DISPLAY_NAME_INDEX,
                -1, -1, -1, -1, -1, -1, -1, -1);
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
     * Giải bố cục từ dòng tiêu đề. Không có cột {@code birthDate}, {@code consentConfirmed},
     * {@code reportSharingConfirmed} lẫn {@code aiProcessingConfirmed} ⇒ {@link #legacy()}, tức tệp
     * cũ của trung tâm chạy đúng như chưa từng có PR này.
     */
    public static RosterColumnLayout fromHeader(String[] headerCols) {
        int birthDate = indexOf(headerCols, COL_BIRTH_DATE);
        int consentConfirmed = indexOfAny(headerCols, CONSENT_CONFIRMED_ALIASES);
        int reportSharingConfirmed = indexOfAny(headerCols, REPORT_SHARING_CONFIRMED_ALIASES);
        int aiProcessingConfirmed = indexOfAny(headerCols, AI_PROCESSING_CONFIRMED_ALIASES);
        if (birthDate < 0 && consentConfirmed < 0 && reportSharingConfirmed < 0
                && aiProcessingConfirmed < 0) {
            return legacy();
        }
        Set<Integer> claimed = claimedIndexes(headerCols);
        return new RosterColumnLayout(
                orDefault(indexOf(headerCols, COL_EMAIL), DEFAULT_EMAIL_INDEX, claimed),
                orDefault(indexOf(headerCols, COL_DISPLAY_NAME), DEFAULT_DISPLAY_NAME_INDEX, claimed),
                birthDate,
                indexOf(headerCols, COL_GUARDIAN_NAME),
                indexOf(headerCols, COL_GUARDIAN_PHONE),
                indexOf(headerCols, COL_GUARDIAN_RELATIONSHIP),
                indexOfAny(headerCols, GUARDIAN_EMAIL_ALIASES),
                consentConfirmed,
                reportSharingConfirmed,
                aiProcessingConfirmed);
    }

    /**
     * Đúng khi tệp khai cột ngày sinh hoặc một trong ba cột xác nhận đồng ý — chỉ khi đó mới đọc
     * phần dữ liệu chưa thành niên (kể cả các cột người giám hộ).
     */
    public boolean readsMinorColumns() {
        return birthDate >= 0 || consentConfirmed >= 0 || reportSharingConfirmed >= 0
                || aiProcessingConfirmed >= 0;
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

    /** Vị trí của bí danh ĐẦU TIÊN khớp, theo thứ tự ưu tiên của danh sách. */
    private static int indexOfAny(String[] headerCols, List<String> aliases) {
        for (String alias : aliases) {
            int idx = indexOf(headerCols, alias);
            if (idx >= 0) {
                return idx;
            }
        }
        return -1;
    }

    /**
     * Bỏ dấu tiếng Việt, bỏ mọi ký tự không phải chữ/số rồi hạ chữ thường: {@code "Birth Date"} →
     * {@code birthdate}, {@code "Đã xác nhận đồng ý"} → {@code daxacnhandongy}. Cùng quy tắc với
     * {@code RosterMinorColumnReader#fold} và với {@code normalizeHeader} ở {@code orgCsv.ts} — ba
     * nơi phải cho cùng một kết quả, nếu không bảng xem trước và kết quả nhập lệch nhau im lặng.
     */
    static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        StringBuilder sb = new StringBuilder(decomposed.length());
        for (int i = 0; i < decomposed.length(); i++) {
            char c = decomposed.charAt(i);
            // đ/Đ không phân rã được bằng NFD — xử riêng.
            if (c == 'đ' || c == 'Đ') {
                sb.append('d');
            } else if (Character.isLetterOrDigit(c)) {
                // Dấu thanh sau NFD là ký tự COMBINING, không phải chữ/số — nhánh này tự loại chúng.
                sb.append(Character.toLowerCase(c));
            }
        }
        return sb.toString();
    }
}
