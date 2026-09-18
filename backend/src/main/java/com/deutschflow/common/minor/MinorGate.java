package com.deutschflow.common.minor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * CHỐT CHẶN dữ liệu của học viên chưa xác định tuổi đi ra nhà cung cấp AI (DEC-22, owner chốt
 * 09/09/2026). Đợt này CHỈ giữ ĐƯỜNG GHI ÂM.
 *
 * <p><b>Vì sao cổng nằm ở đây chứ không ở lúc ghi danh.</b> Owner đã bác phương án chặn ở ghi danh:
 * học viên vào lớp bằng mã mời mà bị chặn vì thiếu ngày sinh thì lượt duyệt của giáo viên bị
 * rollback, trong khi giáo viên KHÔNG có đường nào nhập hộ ngày sinh. Cổng vì vậy đặt đúng chỗ có
 * hậu quả thật: lúc dữ liệu rời khỏi hệ thống. Chặn ở đây mất một tính năng; chặn ở ghi danh mất
 * cả lớp học.
 *
 * <p><b>Vì sao chỉ ghi âm trong đợt này.</b> Ghi âm là đường rủi ro cao nhất — giọng nói thật của
 * một đứa trẻ rời khỏi hạ tầng của mình sang bên thứ ba — và là đường duy nhất mà CHỦ THỂ DỮ LIỆU
 * chính là người gọi, nên không có chỗ nào mơ hồ về việc soi ai. Đường chấm bài bằng AI thì chủ thể
 * là HỌC VIÊN nhưng lệnh gọi truyền {@code teacher.getId()}; cắm cổng ở đó mà không sửa chủ thể
 * trước sẽ soi nhầm người — vừa cho lọt bài của trẻ, vừa chặn oan giáo viên trẻ tuổi. Việc đó là
 * một đợt riêng.
 *
 * <p><b>Vì sao KHÔNG cắm vào {@code QuotaService.assertAllowed}.</b> Chỗ đó là cổng CHI PHÍ, chạy
 * {@code @Transactional(readOnly = true, REQUIRES_NEW)} và mọi tính năng AI đều đi qua — trộn hai
 * loại lỗi vào một chỗ thì client mất khả năng phân biệt "hết hạn mức" (429, tự xử lý được) với
 * "chưa đủ điều kiện về tuổi" (403, phải có người khác làm việc ngoài ứng dụng), và đường chữ cũng
 * bị chặn theo dù đợt này chưa quyết định gì về chữ.
 *
 * <p>🪤 <b>Nạp lại tuổi từ DB.</b> Gate hỏi {@link MinorLearnerService#statusOf(Long)}, và hàm đó
 * SELECT thẳng cột {@code users.birth_date}. Tuyệt đối không đọc từ {@code @AuthenticationPrincipal}:
 * {@code JwtAuthFilter} cache principal 60 giây, nên vừa nhập ngày sinh xong vẫn bị chặn thêm một
 * phút — và tệ hơn, vừa sửa sai xong vẫn được cho qua thêm một phút.
 *
 * <p>Gate KHÔNG ghi sổ audit: đây là đường nóng và mỗi lần chặn là một sự kiện lặp lại của cùng một
 * tình trạng dữ liệu (thiếu ngày sinh / thiếu đồng ý), không phải một thao tác ai đó vừa thực hiện.
 * Sổ audit ghi lúc THU được ngày sinh và đồng ý ({@link MinorLearnerService}); ở đây chỉ log.
 */
@Slf4j
@Service
public class MinorGate {

    /**
     * Làm gì khi CHƯA BIẾT TUỔI. Ba giá trị vì ba mức đánh đổi khác nhau giữa "không chặn oan" và
     * "không để lọt", và lựa chọn đúng phụ thuộc dữ liệu đang có trên production — không phải một
     * hằng số cắm cứng được.
     */
    public enum UnknownAgeAudioPolicy {
        /** Cho qua hết. Chỉ hợp lý ở môi trường dev hoặc khi chưa nhận dữ liệu thật nào. */
        ALLOW,
        /**
         * Chặn nếu người đó là thành viên ACTIVE của một trung tâm. MẶC ĐỊNH — xem javadoc
         * {@link #MinorGate}. Trung tâm là bên có nghĩa vụ và có phương tiện đi thu đồng ý;
         * người dùng B2C tự đăng ký thì không có ai để đi thu hộ.
         */
        BLOCK_ORG_MEMBERS,
        /** Chặn tất cả. Đúng về mặt bảo vệ, nhưng xem cảnh báo ở {@link #MinorGate} trước khi bật. */
        BLOCK_ALL
    }

    /**
     * Có phải thành viên ACTIVE của một trung tâm nào đó không.
     *
     * <p>Hỏi thẳng bảng thay vì gọi {@code OrgQuotaService.resolveActiveMembership}: package
     * {@code common.minor} cố ý KHÔNG phụ thuộc {@code organization} (xem javadoc
     * {@link MinorLearnerService}) — nghĩa vụ với trẻ chưa thành niên không phải một tính năng của
     * B2B, và {@code speaking}/{@code phoneme}/{@code examspeaking} không có lý do gì phải kéo theo
     * cả tầng org chỉ để gọi một chốt chặn. Cùng tiền lệ với {@code SQL_READ_BIRTH_DATE}.
     *
     * <p>Không quan tâm vai trò: một GIÁO VIÊN 17 tuổi vẫn là người chưa thành niên. Lọc theo
     * {@code role = 'STUDENT'} ở đây là mở lại đúng cái lỗ mà V319 đã đóng ở tầng dữ liệu.
     */
    private static final String SQL_HAS_ACTIVE_ORG_MEMBERSHIP =
            "SELECT EXISTS (SELECT 1 FROM org_members WHERE user_id = ? AND status = 'ACTIVE')";

    private final MinorLearnerService minorLearnerService;
    private final JdbcTemplate jdbcTemplate;
    private final UnknownAgeAudioPolicy unknownAgeAudioPolicy;

    public MinorGate(MinorLearnerService minorLearnerService,
                     JdbcTemplate jdbcTemplate,
                     @Value("${app.minor.unknown-age-audio:BLOCK_ORG_MEMBERS}") String unknownAgeAudio) {
        this.minorLearnerService = minorLearnerService;
        this.jdbcTemplate = jdbcTemplate;
        this.unknownAgeAudioPolicy = parsePolicy(unknownAgeAudio);
        log.info("[MinorGate] Chính sách cho người chưa khai ngày sinh (đường ghi âm): {}",
                this.unknownAgeAudioPolicy);
    }

    /**
     * Cổng của ĐƯỜNG GHI ÂM. Trả về bình thường = được phép gửi audio đi; ném
     * {@link MinorAudioBlockedException} (403) = không được.
     *
     * <p>Bốn nhánh theo {@link MinorPolicy.Status}:
     * <ul>
     *   <li>{@code ADULT} — cho qua, không truy vấn gì thêm;</li>
     *   <li>{@code MINOR_LEGAL} (dưới 16) — chỉ qua khi phạm vi
     *       {@link StudentConsent.Scope#AUDIO_RECORDING} đang {@link ConsentState#GRANTED};</li>
     *   <li>{@code MINOR_CENTER_POLICY} (16–17) — CHỈ khi là thành viên ACTIVE của một trung tâm
     *       (phương án D, owner chốt 17/09/2026). Mức 16–17 là luật NỘI BỘ của trung tâm, không phải
     *       nghĩa vụ pháp lý; áp nó lên một học viên tự đăng ký là bắt em ấy tuân một quy định của
     *       nơi em không học, và không ai mở lại được (đường ghi đồng ý chỉ có ở {@code /api/org}).
     *       Trước 17/09 hai nhánh giống nhau ở kết luận; nay khác nhau đúng ở điểm này, và đó là
     *       lý do chúng được giữ tách từ đầu;</li>
     *   <li>{@code UNKNOWN} — theo {@link UnknownAgeAudioPolicy} cấu hình được.</li>
     * </ul>
     *
     * <p>Mọi lần chặn đều mang {@link MinorAudioBlockedException.Contact}: {@code CENTER} khi
     * người này thuộc một trung tâm (trung tâm mở lại được), {@code NONE} khi không (client giấu
     * nút "Liên hệ trung tâm", thông điệp nói đường phụ huynh xác nhận đang được làm — Q-04).
     *
     * @param subjectUserId CHỦ THỂ của bản ghi âm — người mà giọng nói thuộc về, không phải người
     *                      bấm nút. Trên các đường ghi âm hiện tại hai người này là một
     */
    public void assertAudioAllowed(Long subjectUserId) {
        if (subjectUserId == null) {
            // Không im lặng cho qua: một chốt chặn nhận null rồi return là fail-open, và đó đúng là
            // kiểu lỗi mà ca đếm điểm cắm không bắt được (điểm cắm CÓ, chỉ là nó không làm gì).
            throw new IllegalArgumentException(
                    "MinorGate.assertAudioAllowed cần subjectUserId — gọi với null là fail-open");
        }

        MinorPolicy.Status status = minorLearnerService.statusOf(subjectUserId);
        switch (status) {
            case ADULT -> { /* đủ tuổi — không cần đồng ý của ai */ }
            case MINOR_LEGAL -> requireAudioConsent(subjectUserId, status, hasActiveOrgMembership(subjectUserId));
            case MINOR_CENTER_POLICY -> {
                if (hasActiveOrgMembership(subjectUserId)) {
                    requireAudioConsent(subjectUserId, status, true);
                } else {
                    // Học viên tự đăng ký 16–17: không có trung tâm nào để áp luật nội bộ, và
                    // không có ai đi thu đồng ý hộ. Cho qua — KHÔNG hỏi sổ đồng ý.
                    log.debug("[MinorGate] userId={} 16–17 không thuộc trung tâm — không áp luật nội bộ",
                            subjectUserId);
                }
            }
            case UNKNOWN -> applyUnknownAgePolicy(subjectUserId);
        }
    }

    /** Chính sách đang áp cho người chưa khai ngày sinh — để endpoint chẩn đoán và test đọc lại. */
    public UnknownAgeAudioPolicy unknownAgeAudioPolicy() {
        return unknownAgeAudioPolicy;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Nội bộ
    // ─────────────────────────────────────────────────────────────────────────

    /** Câu nói thật với học viên không thuộc trung tâm nào: chưa có ai mở lại được, đang làm (Q-04). */
    private static final String B2C_PENDING_PATH =
            " Đường xác nhận dành cho cha mẹ/người giám hộ đang được hoàn thiện; khi có, ứng dụng sẽ "
                    + "hướng dẫn ngay tại đây. Bạn vẫn dùng được mọi phần không cần ghi âm.";

    private void requireAudioConsent(Long subjectUserId, MinorPolicy.Status status, boolean orgMember) {
        ConsentState consent = minorLearnerService.consentStatus(
                subjectUserId, StudentConsent.Scope.AUDIO_RECORDING);
        if (consent.isEffective()) {
            return;
        }

        MinorAudioBlockedException.Contact contact = orgMember
                ? MinorAudioBlockedException.Contact.CENTER
                : MinorAudioBlockedException.Contact.NONE;
        log.warn("[MinorGate] Chặn ghi âm cho userId={} (nhóm tuổi={}, đồng ý={}, liên hệ={})",
                subjectUserId, status, consent, contact);

        if (consent == ConsentState.REVOKED) {
            // Thông điệp KHÔNG được mời đồng ý lại: rút đồng ý rồi mà hệ thống tự hỏi lại là biến
            // quyền rút thành một nút phiền toái. Chỉ nói đường liên hệ, việc cấp lại do người
            // giám hộ chủ động.
            String reopen = orgMember
                    ? " Nếu muốn mở lại, người giám hộ liên hệ trung tâm để cấp lại đồng ý."
                    : " Nếu muốn mở lại, người giám hộ cần cấp lại đồng ý." + B2C_PENDING_PATH;
            throw new MinorAudioBlockedException(
                    MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REVOKED, status, contact,
                    "Đồng ý cho phép ghi âm của tài khoản này đã được thu hồi, nên phần luyện nói "
                            + "tạm thời không dùng được." + reopen);
        }

        String what = status == MinorPolicy.Status.MINOR_LEGAL
                ? "Theo quy định về dữ liệu của trẻ em, tài khoản này cần đồng ý của cha mẹ hoặc "
                        + "người giám hộ trước khi ghi âm giọng nói."
                : "Theo quy định nội bộ của trung tâm với học viên dưới 18 tuổi, tài khoản này cần "
                        + "đồng ý của cha mẹ hoặc người giám hộ trước khi ghi âm giọng nói.";
        String howTo = orgMember
                ? " Vui lòng liên hệ trung tâm để hoàn tất phiếu đồng ý; sau khi trung tâm ghi "
                        + "nhận, phần luyện nói sẽ mở lại ngay."
                : B2C_PENDING_PATH;
        throw new MinorAudioBlockedException(
                MinorAudioBlockedException.Reason.GUARDIAN_CONSENT_REQUIRED, status, contact,
                what + howTo);
    }

    private void applyUnknownAgePolicy(Long subjectUserId) {
        if (unknownAgeAudioPolicy == UnknownAgeAudioPolicy.ALLOW) {
            return;
        }
        boolean orgMember = hasActiveOrgMembership(subjectUserId);
        boolean block = switch (unknownAgeAudioPolicy) {
            case ALLOW -> false;
            case BLOCK_ALL -> true;
            case BLOCK_ORG_MEMBERS -> orgMember;
        };
        if (!block) {
            return;
        }

        log.warn("[MinorGate] Chặn ghi âm cho userId={} vì chưa khai ngày sinh (chính sách={}, thành viên={})",
                subjectUserId, unknownAgeAudioPolicy, orgMember);
        String howTo = orgMember
                ? " Vui lòng liên hệ trung tâm để bổ sung ngày sinh vào hồ sơ học viên."
                : " Vui lòng bổ sung ngày sinh trong màn Hồ sơ.";
        throw new MinorAudioBlockedException(
                MinorAudioBlockedException.Reason.BIRTH_DATE_REQUIRED, MinorPolicy.Status.UNKNOWN,
                orgMember ? MinorAudioBlockedException.Contact.CENTER : MinorAudioBlockedException.Contact.NONE,
                "Tài khoản chưa có ngày sinh nên hệ thống chưa xác định được có cần đồng ý của "
                        + "người giám hộ hay không, và không gửi bản ghi âm đi khi còn chưa rõ." + howTo);
    }

    private boolean hasActiveOrgMembership(Long userId) {
        return Boolean.TRUE.equals(
                jdbcTemplate.queryForObject(SQL_HAS_ACTIVE_ORG_MEMBERSHIP, Boolean.class, userId));
    }

    /**
     * Đổ vỡ NGAY LÚC KHỞI ĐỘNG khi cấu hình sai, thay vì lặng lẽ rơi về mặc định. Một giá trị gõ
     * nhầm ({@code BLOCK_ORGS}) mà lại rơi về {@code BLOCK_ORG_MEMBERS} thì trông như đang chạy
     * đúng; còn nếu rơi về {@code ALLOW} thì cổng biến mất mà không ai biết. Cùng lối fail-fast với
     * ràng buộc {@code legal <= center} của {@link MinorPolicy}.
     */
    private static UnknownAgeAudioPolicy parsePolicy(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        try {
            return UnknownAgeAudioPolicy.valueOf(value);
        } catch (IllegalArgumentException unknown) {
            throw new IllegalStateException(
                    "app.minor.unknown-age-audio = '" + raw + "' không hợp lệ. Giá trị cho phép: "
                            + Arrays.stream(UnknownAgeAudioPolicy.values())
                            .map(Enum::name).collect(Collectors.joining(" · ")));
        }
    }
}
