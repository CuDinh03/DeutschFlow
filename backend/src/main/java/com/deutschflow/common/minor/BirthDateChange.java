package com.deutschflow.common.minor;

/**
 * Kết quả một lượt đặt ngày sinh qua {@link MinorLearnerService#setBirthDate}.
 *
 * <p><b>Cố ý không mang ngày sinh cũ.</b> Người gọi cần biết *có gì đổi không* và *đổi kiểu gì* để
 * quyết định báo cho học viên và render lại màn hình — không cần giá trị cũ. Giá trị cũ chỉ tồn tại
 * bên trong giao dịch ghi, không đi ra ngoài, không vào vết audit (owner để mở Q-06 ngày 14/09/2026;
 * mặc định an toàn là vết không mang giá trị — cùng luật với {@code student_guardian_updated}).
 *
 * @param changed     {@code false} khi người dùng gõ lại đúng ngày đang có — không ghi, không vết,
 *                    không báo. Một cú bấm Lưu không đổi gì thì không phải là một sự kiện
 * @param firstRecord {@code true} nếu trước đó cột đang NULL (khai lần đầu), {@code false} nếu đây
 *                    là một lần SỬA giá trị đã có. Quyết định tên vết và câu chữ của thông báo
 * @param minorStatus nhóm tuổi SAU khi đặt — thứ quyết định các chốt chặn của {@code MinorGate}
 */
public record BirthDateChange(boolean changed, boolean firstRecord, MinorPolicy.Status minorStatus) {}
