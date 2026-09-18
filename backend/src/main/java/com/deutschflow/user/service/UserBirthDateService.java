package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.minor.MinorPolicy;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Người dùng tự khai ngày sinh trên trang hồ sơ.
 *
 * <p><b>Vì sao phải có.</b> Trước đợt này {@code users.birth_date} chỉ ghi được qua đường ghi danh
 * của trung tâm ({@code OrgRosterRowImporter}, phiếu đồng ý giám hộ). Người tự đăng ký vì thế luôn
 * ở {@link MinorPolicy.Status#UNKNOWN} — không có cách nào để một học viên chưa thành niên tự nói
 * mình chưa thành niên, nên mọi chốt bảo vệ theo tuổi đều không chạm tới nhóm B2C.
 *
 * <p><b>Ghi MỘT LẦN, không cho tự sửa (chốt của đợt này).</b> Ngày sinh là dữ liệu nền của chốt vị
 * thành niên: cho sửa tự do tức là mở cửa hậu — một tài khoản bị hạn chế theo tuổi chỉ cần khai lại
 * năm sinh là thoát. Ai gõ nhầm vẫn sửa được, nhưng phải đi đường có người duyệt (trung tâm hoặc hỗ
 * trợ), và đường ấy để lại vết ở {@code birth_date_recorded_by}. Cùng lý do bên
 * {@code AccountDeletionGuard}: chặn thì phải NÓI RÕ PHẢI LÀM GÌ, không ném 409 trống.
 *
 * <p>🪤 Khai tuổi nhỏ KHÔNG bị từ chối, dù Điều khoản §3 nói tự đăng ký phải đủ 16. Từ chối ghi thì
 * hệ thống mất luôn thông tin người này là trẻ em và mọi chốt bảo vệ tiếp tục không áp — tức là
 * phạt đúng vào người cần được bảo vệ nhất. Ghi nhận trước, xử lý tài khoản (nếu owner quyết) đi
 * đường riêng có người duyệt.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserBirthDateService {

    /** Quá mốc này gần như chắc chắn là dữ liệu bẩn chứ không phải người thật. */
    static final int MAX_AGE_YEARS = 120;
    /**
     * Sàn chống gõ nhầm năm (2026 thay vì 1996) chứ không phải chốt chính sách — chốt tuổi thật sự
     * nằm ở {@link MinorPolicy}. Đặt thấp có chủ đích: thà nhận một tuổi nhỏ bất thường còn hơn chặn
     * một học viên nhỏ tuổi có thật rồi mất luôn vết bảo vệ.
     */
    static final int MIN_AGE_YEARS = 6;

    private final UserRepository userRepository;
    private final MinorPolicy minorPolicy;

    /**
     * Ghi ngày sinh tự khai cho chính chủ.
     *
     * @return trạng thái vị thành niên tính theo ngày vừa khai (để giao diện nói đúng hệ quả)
     * @throws BadRequestException ngày không hợp lệ
     * @throws ConflictException   tài khoản đã có ngày sinh
     */
    @Transactional
    public MinorPolicy.Status declareBirthDate(User user, LocalDate birthDate) {
        validate(birthDate);
        // Chốt "chưa có ngày sinh" nằm trong WHERE của câu UPDATE chứ không đọc-rồi-ghi ở đây:
        // principal được cache ~60 giây nên user.getBirthDate() có thể đã cũ.
        int updated = userRepository.recordBirthDateIfAbsent(user.getId(), birthDate, user.getId());
        if (updated == 0) {
            throw new ConflictException(
                    "Tài khoản đã có ngày sinh nên không thể tự đổi. Nếu ngày sinh đang sai, hãy liên "
                            + "hệ trung tâm của bạn hoặc bộ phận hỗ trợ để được chỉnh lại.");
        }
        MinorPolicy.Status status = minorPolicy.statusOf(birthDate);
        log.info("[BirthDate] user {} tự khai ngày sinh, trạng thái {}", user.getId(), status);
        return status;
    }

    private void validate(LocalDate birthDate) {
        if (birthDate == null) {
            throw new BadRequestException("Vui lòng chọn ngày sinh.");
        }
        LocalDate today = LocalDate.ofInstant(Instant.now(), MinorPolicy.ZONE);
        if (birthDate.isAfter(today)) {
            throw new BadRequestException("Ngày sinh không thể ở tương lai.");
        }
        int age = minorPolicy.ageAt(birthDate, Instant.now());
        if (age > MAX_AGE_YEARS) {
            throw new BadRequestException("Ngày sinh không hợp lệ — vui lòng kiểm tra lại năm.");
        }
        if (age < MIN_AGE_YEARS) {
            throw new BadRequestException(
                    "Ngày sinh không hợp lệ — vui lòng kiểm tra lại năm (có thể bạn gõ nhầm năm nay).");
        }
    }
}
