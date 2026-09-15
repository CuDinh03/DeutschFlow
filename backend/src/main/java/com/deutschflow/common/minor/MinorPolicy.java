package com.deutschflow.common.minor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;

/**
 * MỘT nơi duy nhất trả lời "người này có phải chưa thành niên không" (DEC-22, owner chốt 09/09/2026).
 *
 * <p><b>Hai mức, không phải một.</b> Repo đang có BA ngưỡng cùng lúc và chúng không thể gộp:
 * <ul>
 *   <li><b>13</b> — chính sách quyền riêng tư ĐANG PHÁT HÀNH ("not directed to children under 13"),
 *       tức ngưỡng COPPA;</li>
 *   <li><b>16</b> — NĐ 13/2023 Điều 20 theo Luật Trẻ em: xử lý dữ liệu trẻ em phải có đồng ý của cha
 *       mẹ hoặc người giám hộ. Đây là ngưỡng PHÁP LÝ ở Việt Nam;</li>
 *   <li><b>18</b> — quyết định của owner cho trung tâm pilot, và là nhãn của
 *       {@code UserLearningProfile.AgeRange.UNDER_18}.</li>
 * </ul>
 * Owner chốt dùng CẢ HAI mức 16 và 18: dưới 16 thì người giám hộ là BẮT BUỘC theo luật; 16–17 thì
 * áp luật nội bộ của trung tâm (hạn chế AI, ghi âm, nhắn riêng) nhưng không phải nghĩa vụ pháp lý.
 * Vì vậy lớp này trả về một {@link Status} nhiều mức chứ không phải boolean — ghim một con số là
 * hoặc vi phạm luật, hoặc siết quá tay ở nhóm 16–17.
 *
 * <p><b>Tính LÚC ĐỌC, không lưu cột.</b> PostgreSQL từ chối {@code CURRENT_DATE} trong CHECK và
 * trong generated column, nên một cột {@code is_minor} sẽ phải do job cập nhật và sẽ SAI trong
 * khoảng giữa hai lần chạy. Tính lúc đọc thì người đủ tuổi giữa chừng tự hết hạn chế ở request kế
 * tiếp, không cần job sinh nhật.
 *
 * <p>🪤 <b>Zone ghim Asia/Ho_Chi_Minh.</b> Container chạy giờ UTC. Không ghim thì trong 7 tiếng mỗi
 * ngày cùng một người sẽ là 17 ở chốt này và 18 ở chốt kia. Cùng lý do
 * {@code DataRetentionJob} ghim zone cho cron.
 *
 * <p>🪤 <b>Đừng đọc {@code birthDate} từ {@code @AuthenticationPrincipal}.</b> {@code JwtAuthFilter}
 * cache principal 60 giây, nên chính sách sẽ trễ tới một phút sau khi sửa ngày sinh. Đây đúng lớp
 * lỗi đã phải vá cho {@code push_token} ({@code User} javadoc). Nạp lại từ repository ở điểm quyết
 * định, hoặc dùng {@link #statusOf(LocalDate)} với giá trị vừa đọc từ DB.
 */
@Slf4j
@Component
public class MinorPolicy {

    /** Giờ Việt Nam — mọi phép tính tuổi phải cùng một zone, xem javadoc lớp. */
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Kết quả phân loại. Bốn nhánh, không phải hai — {@link #UNKNOWN} là nhánh THẬT, không phải
     * trạng thái lỗi: 37 dòng ghi danh đã có trên production từ trước khi hệ thống biết hỏi tuổi.
     */
    public enum Status {
        /** Chưa khai ngày sinh. Điểm gọi quyết định fail-closed hay cho qua, KHÔNG mặc định ở đây. */
        UNKNOWN,
        /** Dưới ngưỡng pháp lý — BẮT BUỘC có người giám hộ và vết đồng ý (NĐ 13/2023 Điều 20). */
        MINOR_LEGAL,
        /** Từ ngưỡng pháp lý tới dưới ngưỡng nội bộ — áp luật của trung tâm, không phải nghĩa vụ luật. */
        MINOR_CENTER_POLICY,
        /** Đủ tuổi theo cả hai ngưỡng. */
        ADULT;

        /** Đúng khi cần đối xử như người chưa thành niên ở BẤT KỲ mức nào. */
        public boolean isMinor() {
            return this == MINOR_LEGAL || this == MINOR_CENTER_POLICY;
        }

        /** Đúng khi luật đòi đồng ý của người giám hộ — chỉ mức dưới 16. */
        public boolean requiresGuardianConsent() {
            return this == MINOR_LEGAL;
        }
    }

    private final int legalThreshold;
    private final int centerPolicyThreshold;

    public MinorPolicy(
            @Value("${app.minor.legal-guardian-threshold:16}") int legalThreshold,
            @Value("${app.minor.center-policy-threshold:18}") int centerPolicyThreshold) {
        if (legalThreshold > centerPolicyThreshold) {
            throw new IllegalStateException(
                    "app.minor.legal-guardian-threshold (" + legalThreshold + ") không được lớn hơn "
                            + "app.minor.center-policy-threshold (" + centerPolicyThreshold + ") — "
                            + "cấu hình như vậy làm nhánh MINOR_CENTER_POLICY không bao giờ đạt tới.");
        }
        this.legalThreshold = legalThreshold;
        this.centerPolicyThreshold = centerPolicyThreshold;
    }

    /** Phân loại theo tuổi HÔM NAY. */
    public Status statusOf(LocalDate birthDate) {
        return statusAt(birthDate, Instant.now());
    }

    /**
     * Phân loại theo tuổi TẠI MỘT THỜI ĐIỂM — dùng cho job dọn dữ liệu và cho việc trả lời "lúc thu
     * bản ghi âm này thì chủ thể bao nhiêu tuổi".
     *
     * <p>Không cần cột ảnh chụp vì {@code birth_date} bất biến trên thực tế; V319 kèm
     * {@code birth_date_recorded_at}/{@code birth_date_recorded_by} để một lần sửa vẫn truy được.
     */
    public Status statusAt(LocalDate birthDate, Instant at) {
        if (birthDate == null) {
            return Status.UNKNOWN;
        }
        int age = ageAt(birthDate, at);
        if (age < legalThreshold) {
            return Status.MINOR_LEGAL;
        }
        if (age < centerPolicyThreshold) {
            return Status.MINOR_CENTER_POLICY;
        }
        return Status.ADULT;
    }

    /** Tuổi tròn năm tại một thời điểm, tính theo lịch Việt Nam. */
    public int ageAt(LocalDate birthDate, Instant at) {
        LocalDate on = LocalDate.ofInstant(at, ZONE);
        if (birthDate.isAfter(on)) {
            // Ngày sinh ở tương lai là dữ liệu bẩn — CHECK ở tầng DB không chặn được (PostgreSQL
            // cấm CURRENT_DATE trong CHECK). Coi như 0 tuổi để fail về phía an toàn nhất thay vì
            // trả số âm rồi lọt qua mọi phép so sánh `< ngưỡng`.
            log.warn("[MinorPolicy] birth_date {} nằm ở tương lai so với {} — coi như 0 tuổi", birthDate, on);
            return 0;
        }
        return Period.between(birthDate, on).getYears();
    }

    public int legalThreshold() {
        return legalThreshold;
    }

    public int centerPolicyThreshold() {
        return centerPolicyThreshold;
    }
}
