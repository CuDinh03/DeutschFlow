/**
 * MỘT định nghĩa duy nhất cho "mật khẩu đủ dài" ở phía web.
 *
 * Phải khớp `PasswordPolicy.MIN_LENGTH` của backend
 * (`backend/src/main/java/com/deutschflow/common/security/PasswordPolicy.java`).
 *
 * Vì sao cần hằng chứ không gõ số vào từng form: trước đợt này ba màn tạo tài khoản mỗi màn chép
 * tay số 6, trong khi backend đã đòi 8 ở một số cửa — nên `AdminCreateUserModal` cho bấm Gửi rồi
 * mới nhận 400 từ máy chủ. Sàn phía client chỉ để báo sớm; máy chủ vẫn là nơi có thẩm quyền.
 */
export const PASSWORD_MIN = 8;

/** Trần độ dài — bcrypt cắt ở 72 byte nên dài hơn không thêm entropy. */
export const PASSWORD_MAX = 100;
