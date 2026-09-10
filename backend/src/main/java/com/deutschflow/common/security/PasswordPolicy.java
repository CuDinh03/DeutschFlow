package com.deutschflow.common.security;

import com.deutschflow.common.exception.BadRequestException;

/**
 * MỘT định nghĩa duy nhất cho "mật khẩu đủ dài".
 *
 * <p><b>Vì sao tồn tại.</b> Trước đợt này sàn mật khẩu được chép tay ở bảy chỗ với BA con số khác
 * nhau — 8 (admin tạo tài khoản, admin đặt lại mật khẩu, quên mật khẩu), 6 (đăng ký, tạo trước tài
 * khoản giáo viên, gắn chủ sở hữu trung tâm) và <b>0</b> (nhận lời mời tạo tài khoản mới). Không có
 * hằng dùng chung nào trên toàn backend: {@code git grep PASSWORD_MIN|PasswordPolicy} trả về rỗng.
 * Hệ quả là con số cao nhất chỉ bảo vệ được những cửa đã nhớ đặt nó, còn cửa yếu nhất quyết định
 * mức an toàn thật.
 *
 * <p><b>Cửa yếu nhất là cửa công khai.</b> {@code POST /api/public/org-invitations/{token}/accept}
 * không cần đăng nhập và TẠO THẲNG một tài khoản {@code TEACHER} — nhân sự trung tâm, đọc được dữ
 * liệu học viên — mà chỉ kiểm {@code isBlank()}, nghĩa là mật khẩu MỘT ký tự lọt qua. Lớp kiểm soát
 * độc lập duy nhất ở đó là {@code PublicApiRateLimitFilter}, mà filter đó
 * <b>fail-open khi Redis chết</b> (bắt Exception rồi cho qua), nên không thể coi là hàng rào.
 *
 * <p>Sàn thống nhất là <b>8</b> — con số cao nhất trong ba con số đang tồn tại, nên nâng lên không
 * hạ mức an toàn ở bất kỳ cửa nào. Không khoá ai ra khỏi hệ thống: mọi mật khẩu đã lưu đều là bcrypt
 * hash và không đường nào kiểm lại độ dài lúc đăng nhập ({@code LoginRequest} chỉ có
 * {@code @NotBlank}); seed cũng nhét thẳng hash chứ không đi qua validation.
 *
 * <p>Trần 100 giữ nguyên theo {@code RegisterRequest} — bcrypt cắt ở 72 byte nên phần dài hơn không
 * thêm entropy, và một trần tường minh chặn việc gửi chuỗi khổng lồ vào hàm băm.
 */
public final class PasswordPolicy {

    /** Số ký tự tối thiểu cho MỌI đường đặt hoặc đổi mật khẩu. */
    public static final int MIN_LENGTH = 8;

    /** Trần độ dài — xem javadoc lớp. */
    public static final int MAX_LENGTH = 100;

    /** Thông điệp dùng chung, để bảy cửa không nói bảy câu khác nhau về cùng một luật. */
    public static final String MESSAGE = "Mật khẩu phải có ít nhất " + MIN_LENGTH + " ký tự.";

    private PasswordPolicy() {
    }

    /**
     * Ném {@link BadRequestException} nếu mật khẩu rỗng hoặc ngắn hơn sàn.
     *
     * <p>Cố ý ném {@code BadRequestException} chứ không dùng {@code @Size} trên DTO ở những chỗ
     * đang kiểm tay: {@code @Size} đi qua nhánh {@code MethodArgumentNotValidException} của
     * {@code GlobalExceptionHandler}, ở đó {@code detail} bị thay bằng chuỗi tiếng Anh cố định và
     * câu thật rơi vào map {@code errors} — mà web chỉ đọc {@code detail}
     * ({@code frontend/src/lib/api.ts} duyệt {@code detail|message|error|title}), nên người dùng sẽ
     * thấy một câu chung chung tiếng Anh thay cho câu tiếng Việt hiện có.
     */
    public static void requireStrongEnough(String raw) {
        if (raw == null || raw.length() < MIN_LENGTH) {
            throw new BadRequestException(MESSAGE);
        }
    }
}
