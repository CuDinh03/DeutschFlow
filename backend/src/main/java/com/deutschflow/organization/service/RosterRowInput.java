package com.deutschflow.organization.service;

import com.deutschflow.common.minor.GuardianDraft;

import java.time.LocalDate;

/**
 * MỘT dòng CSV roster đã được đọc, kiểm và chuẩn hoá — thứ mà {@link OrgRosterRowImporter} ghi xuống.
 *
 * <p><b>Vì sao là record chứ không phải thêm tham số vào {@code importRow}.</b> Chữ ký cũ đã có
 * {@code (org, email, displayNameCol, classId)}; nhét thêm ngày sinh, tên/điện thoại/quan hệ người
 * giám hộ nữa thành bảy tham số mà bốn trong số đó cùng kiểu {@code String} đứng liền nhau — đảo chỗ
 * {@code guardianPhone} với {@code guardianName} thì trình biên dịch không nói gì cả, còn dữ liệu
 * thì đã sai trên hồ sơ của một đứa trẻ. Cùng lý do với {@link GuardianDraft} (xem javadoc ở đó).
 *
 * <p><b>Kiểm ở đâu.</b> Mọi kiểm tra ĐỌC ĐƯỢC (định dạng ngày, ngày tương lai, thiếu người giám hộ,
 * ô đồng ý gõ lạ) nằm ở {@link OrgRosterService} — chỉ chỗ đó mới biết SỐ DÒNG VẬT LÝ để nói cho
 * người nhập biết phải sửa dòng nào trong Excel. Tới được đây thì dòng đã hợp lệ; {@code importRow}
 * chỉ còn việc ghi.
 *
 * @param email                  đã chuẩn hoá và kiểm định dạng ở {@link OrgRosterService}
 * @param displayName            cột tên hiển thị thô; rỗng thì {@code importRow} lấy phần trước {@code @} của email
 * @param birthDate              {@code null} = tệp không có cột ngày sinh, hoặc ô để trống. KHÔNG phải lỗi:
 *                               owner chốt ghi danh không phải cổng chặn (09/09/2026), cổng nằm ở đường dữ
 *                               liệu đi ra nhà cung cấp AI
 * @param guardian               {@code null} = dòng không khai người giám hộ
 * @param consentConfirmed       trung tâm xác nhận đã cầm phiếu đồng ý giấy của người giám hộ cho phạm vi
 *                               ghi âm (cột {@code consentConfirmed}, D1 — owner chốt 10/09/2026). Ghi một
 *                               dòng {@code GRANTED} phương thức {@code PAPER} — chỉ khi trạng thái hiện tại
 *                               chưa là {@code GRANTED}, để nhập lại cùng tệp không làm phình sổ chỉ-ghi-thêm
 * @param reportSharingConfirmed trung tâm xác nhận mục C2 của cùng phiếu: người giám hộ đồng ý nhận phiếu
 *                               đánh giá (cột {@code reportSharingConfirmed}, R6 — scope
 *                               {@code GUARDIAN_REPORT_SHARING}). Cùng quy tắc ghi/idempotent như trên,
 *                               độc lập với {@code consentConfirmed}
 * @param aiProcessingConfirmed  trung tâm xác nhận mục C3 của cùng phiếu: người giám hộ đồng ý cho AI chấm
 *                               bài làm (cột {@code aiProcessingConfirmed} — scope {@code AI_PROCESSING},
 *                               D3). Cùng quy tắc ghi/idempotent, độc lập với hai ô kia
 */
public record RosterRowInput(
        String email,
        String displayName,
        LocalDate birthDate,
        GuardianDraft guardian,
        boolean consentConfirmed,
        boolean reportSharingConfirmed,
        boolean aiProcessingConfirmed
) {
}
