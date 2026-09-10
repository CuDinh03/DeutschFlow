package com.deutschflow.common.minor;

import java.time.Instant;

/**
 * Một lần ghi vào sổ đồng ý, TRƯỚC khi kiểm tra và chuẩn hoá.
 *
 * <p>Không mang {@code studentUserId}/{@code orgId}: hai giá trị đó là ngữ cảnh do controller giải
 * (chủ thể nào, trung tâm nào), không phải nội dung người dùng gõ. Trộn chung thì một điểm gọi có
 * thể ghi bằng chứng cho học viên A trong khi đang thao tác trên hồ sơ học viên B.
 *
 * @param guardianId  người giám hộ đã đồng ý; {@code null} khi học viên đủ tuổi tự đồng ý.
 *                    Nếu có, {@code MinorLearnerService} bắt buộc phải thuộc CHÍNH học viên đó
 * @param effectiveAt lúc đồng ý THẬT (ngày ký giấy). {@code null} = lấy thời điểm hiện tại, đúng
 *                    cho đường {@link StudentConsent.Method#IN_APP} nơi hai mốc trùng nhau
 */
public record ConsentDraft(
        StudentConsent.Scope scope,
        StudentConsent.Action action,
        Long guardianId,
        StudentConsent.Method method,
        String termsVersion,
        Instant effectiveAt,
        String note
) {
}
