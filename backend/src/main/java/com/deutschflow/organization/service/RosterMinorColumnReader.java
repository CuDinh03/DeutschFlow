package com.deutschflow.organization.service;

import com.deutschflow.common.minor.GuardianDraft;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.common.minor.StudentGuardian;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Đọc bốn cột chưa-thành-niên của một dòng roster CSV, và TỪ CHỐI dòng hỏng kèm lý do đọc được.
 *
 * <p><b>Vì sao kiểm ở đây chứ không để {@code MinorLearnerService} ném.</b> Nó có ném — nhưng ném từ
 * trong transaction của dòng thì {@link OrgRosterService} chỉ bắt được một {@code Exception} và ghi
 * "Dòng N: lỗi xử lý — …". Người nhập một tệp 200 dòng cần biết dòng nào, email nào, sai cái gì, sửa
 * thế nào. Cùng khuôn với các kiểm sớm đã có trong {@link OrgRosterRowImporter} (tài khoản ADMIN,
 * tài khoản đang là nhân sự trung tâm).
 *
 * <p><b>CHỈ nhận ngày dạng ISO {@code YYYY-MM-DD}.</b> Excel Việt Nam hay xuất {@code dd/MM/yyyy},
 * còn Excel bản Mỹ xuất {@code MM/dd/yyyy}, và hai kiểu đó KHÔNG phân biệt được với nhau ở những
 * ngày ≤ 12: {@code 03/05/2010} là 3 tháng 5 hay 5 tháng 3? Đoán sai không báo lỗi gì cả, chỉ lệch
 * ngày sinh trên hồ sơ một đứa trẻ — và ngày sinh chỉ ghi được MỘT LẦN (xem
 * {@code MinorLearnerService#recordBirthDate}), nên không có lần sửa thứ hai. Từ chối thẳng, nói rõ
 * dạng cần dùng, là đường duy nhất không im lặng.
 */
@Component
@RequiredArgsConstructor
public class RosterMinorColumnReader {

    /** Bằng cận dưới của {@code chk_users_birth_date_sane} (V319) và của MinorLearnerService. */
    private static final LocalDate BIRTH_DATE_FLOOR = LocalDate.of(1900, 1, 1);

    private static final int MAX_GUARDIAN_NAME = 120;
    private static final int MAX_GUARDIAN_PHONE = 32;

    /**
     * Bí danh tiếng Việt cho {@code guardianRelationship} — người nhập là thư ký trung tâm, không
     * phải lập trình viên; bắt gõ {@code LEGAL_GUARDIAN} là bắt gõ sai. So khớp sau khi bỏ dấu và
     * hạ chữ thường, nên "Mẹ" và "me" là một.
     */
    private static final Map<String, StudentGuardian.Relationship> RELATIONSHIP_ALIASES = Map.ofEntries(
            Map.entry("me", StudentGuardian.Relationship.MOTHER),
            Map.entry("mother", StudentGuardian.Relationship.MOTHER),
            Map.entry("cha", StudentGuardian.Relationship.FATHER),
            Map.entry("bo", StudentGuardian.Relationship.FATHER),
            Map.entry("ba", StudentGuardian.Relationship.FATHER),
            Map.entry("father", StudentGuardian.Relationship.FATHER),
            Map.entry("nguoigiamho", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("giamho", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("legalguardian", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("guardian", StudentGuardian.Relationship.LEGAL_GUARDIAN),
            Map.entry("khac", StudentGuardian.Relationship.OTHER),
            Map.entry("other", StudentGuardian.Relationship.OTHER));

    private static final String ACCEPTED_RELATIONSHIPS =
            "MOTHER, FATHER, LEGAL_GUARDIAN, OTHER (hoặc mẹ, cha/bố, người giám hộ, khác)";

    private final MinorPolicy minorPolicy;

    /**
     * Kết quả đọc một dòng. Hoặc {@code error != null} (dòng bị từ chối, lý do đã kèm số dòng và
     * email), hoặc dữ liệu đã sạch — trong đó {@code birthDate}/{@code guardian} vẫn có thể là
     * {@code null} vì ô để trống, và đó KHÔNG phải lỗi.
     */
    public record Result(LocalDate birthDate, GuardianDraft guardian, String error) {

        static Result rejected(String error) {
            return new Result(null, null, error);
        }

        static Result of(LocalDate birthDate, GuardianDraft guardian) {
            return new Result(birthDate, guardian, null);
        }

        public boolean rejected() {
            return error != null;
        }
    }

    /** Dòng của tệp không khai cột ngày sinh — không đọc gì, không từ chối gì. */
    public static final Result NOTHING = Result.of(null, null);

    /**
     * @param rowNum số dòng VẬT LÝ trong tệp (tính cả header) — người nhập dò theo số này trong Excel
     * @param email  email của dòng, đã chuẩn hoá; đi kèm mọi thông báo để dò được cả khi sắp lại tệp
     */
    public Result read(String[] cols, RosterColumnLayout layout, int rowNum, String email) {
        if (!layout.readsMinorColumns()) {
            return NOTHING;
        }
        String where = "Dòng " + rowNum + " (" + email + "): ";

        String rawBirthDate = value(cols, layout.birthDate());
        LocalDate birthDate = null;
        if (!rawBirthDate.isEmpty()) {
            try {
                birthDate = LocalDate.parse(rawBirthDate);
            } catch (DateTimeParseException ex) {
                return Result.rejected(where + "ngày sinh \"" + rawBirthDate + "\" không đọc được — "
                        + "cần dạng YYYY-MM-DD (ví dụ 2010-02-01).");
            }
            if (birthDate.isAfter(LocalDate.now(MinorPolicy.ZONE))) {
                return Result.rejected(where + "ngày sinh " + birthDate + " ở tương lai.");
            }
            if (birthDate.isBefore(BIRTH_DATE_FLOOR)) {
                return Result.rejected(where + "ngày sinh " + birthDate
                        + " không hợp lệ (trước " + BIRTH_DATE_FLOOR + ").");
            }
        }

        String guardianName = value(cols, layout.guardianName());
        String guardianPhone = value(cols, layout.guardianPhone());
        String rawRelationship = value(cols, layout.guardianRelationship());
        boolean hasGuardian = !guardianName.isEmpty() || !guardianPhone.isEmpty();

        // Chốt của luật: dưới ngưỡng pháp lý thì người giám hộ là BẮT BUỘC (NĐ 13/2023 Điều 20).
        // Đây KHÔNG mâu thuẫn với "ghi danh không phải cổng": không khai ngày sinh thì dòng vẫn
        // vào bình thường. Chỉ khi trung tâm ĐÃ nói em ấy 14 tuổi mà vẫn bỏ trống người giám hộ
        // thì mới từ chối — nhận dòng đó là tự tay tạo một hồ sơ thiếu thứ luật đòi.
        if (birthDate != null && !hasGuardian
                && minorPolicy.statusOf(birthDate).requiresGuardianConsent()) {
            return Result.rejected(where + "học viên "
                    + minorPolicy.ageAt(birthDate, java.time.Instant.now()) + " tuổi (dưới "
                    + minorPolicy.legalThreshold() + ") bắt buộc phải có người giám hộ — "
                    + "điền guardianName và guardianPhone.");
        }

        if (!hasGuardian) {
            if (!rawRelationship.isEmpty()) {
                return Result.rejected(where + "có guardianRelationship nhưng thiếu guardianName "
                        + "và guardianPhone.");
            }
            return Result.of(birthDate, null);
        }
        if (guardianName.isEmpty()) {
            return Result.rejected(where + "có guardianPhone nhưng thiếu guardianName.");
        }
        // Bằng chk_student_guardians_contactable: bản ghi giám hộ phải liên lạc được. Tệp CSV không
        // có cột email người giám hộ, nên ở đường này số điện thoại là bắt buộc.
        if (guardianPhone.isEmpty()) {
            return Result.rejected(where + "có guardianName nhưng thiếu guardianPhone — "
                    + "người giám hộ phải liên lạc được.");
        }
        if (guardianName.length() > MAX_GUARDIAN_NAME) {
            return Result.rejected(where + "tên người giám hộ dài quá " + MAX_GUARDIAN_NAME + " ký tự.");
        }
        if (guardianPhone.length() > MAX_GUARDIAN_PHONE) {
            return Result.rejected(where + "số điện thoại người giám hộ dài quá "
                    + MAX_GUARDIAN_PHONE + " ký tự.");
        }

        StudentGuardian.Relationship relationship;
        if (rawRelationship.isEmpty()) {
            // Để trống là chuyện thường của một tệp xuất từ phần mềm khác. OTHER nói đúng sự thật
            // ("có người giám hộ, chưa khai quan hệ") mà không chặn dòng, và không bịa ra "mẹ".
            relationship = StudentGuardian.Relationship.OTHER;
        } else {
            relationship = RELATIONSHIP_ALIASES.get(fold(rawRelationship));
            if (relationship == null) {
                return Result.rejected(where + "guardianRelationship \"" + rawRelationship
                        + "\" không hợp lệ — nhận " + ACCEPTED_RELATIONSHIPS + ".");
            }
        }

        // primary = true: đây là người liên lạc ĐẦU TIÊN và duy nhất của dòng CSV này. recordGuardian
        // hạ người chính cũ nếu có — nhưng OrgRosterRowImporter chỉ gọi khi học viên chưa có ai.
        return Result.of(birthDate,
                new GuardianDraft(guardianName, relationship, guardianPhone, null, true));
    }

    private static String value(String[] cols, int index) {
        if (index < 0 || index >= cols.length || cols[index] == null) {
            return "";
        }
        return cols[index].trim();
    }

    /** Hạ chữ thường, bỏ dấu tiếng Việt và mọi ký tự không phải chữ/số: "Người giám hộ" → "nguoigiamho". */
    private static String fold(String raw) {
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        StringBuilder sb = new StringBuilder(decomposed.length());
        for (int i = 0; i < decomposed.length(); i++) {
            char c = decomposed.charAt(i);
            // đ/Đ không phân rã được bằng NFD — xử riêng, nếu không "bố"/"bo" khớp mà "đ..." thì không.
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
