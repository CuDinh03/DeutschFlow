package com.deutschflow.common.minor;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Ngày sinh đang lưu của một học viên, kèm dấu vết của lần đặt gần nhất
 * ({@link MinorLearnerService#birthDateOf}).
 *
 * <p>Ba trường cùng NULL là trạng thái bình thường: học viên chưa từng được khai ngày sinh. Hai
 * trường {@code recordedAt}/{@code recordedByUserId} tồn tại từ V319 với đúng mục đích của màn
 * hình này — không có chúng thì một lần sửa sẽ viết lại hồi tố "tuổi tại thời điểm ghi", và không
 * ai trả lời được câu "giá trị đang hiển thị là do ai đặt".
 */
public record BirthDateRecord(LocalDate birthDate, Instant recordedAt, Long recordedByUserId) {}
