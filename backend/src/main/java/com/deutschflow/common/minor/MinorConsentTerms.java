package com.deutschflow.common.minor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Phiên bản ĐIỀU KHOẢN mà một phiếu đồng ý thu hôm nay được coi là đồng ý với — MỘT nơi cho mọi
 * đường ghi (cột CSV {@code consentConfirmed} và endpoint của trung tâm).
 *
 * <p>Vì sao là cấu hình chứ không phải hằng số: {@code student_consents.terms_version} là câu trả
 * lời cho "người giám hộ đã đồng ý với CÁI GÌ", mà điều khoản thì đổi theo thời gian còn chữ ký thì
 * không ký lại. Đổi điều khoản = đổi giá trị này ở {@code app.minor.consent-terms-version}; các dòng
 * đã ghi giữ nguyên phiên bản cũ, và một đợt sau có thể hỏi "còn ai đang ở phiên bản cũ".
 *
 * <p>Vì sao KHÔNG để client gửi lên: hai điểm gọi (CSV, màn nhỏ) mà mỗi bên tự gõ một chuỗi thì sổ
 * sẽ có {@code "v1"}, {@code "2026-09"}, {@code "1.0"} lẫn lộn — không so được với nhau. Máy chủ là
 * bên duy nhất biết điều khoản đang hiệu lực.
 */
@Component
public class MinorConsentTerms {

    private final String currentVersion;

    public MinorConsentTerms(@Value("${app.minor.consent-terms-version:2026-09}") String currentVersion) {
        String value = currentVersion == null ? "" : currentVersion.trim();
        if (value.isEmpty()) {
            throw new IllegalStateException(
                    "app.minor.consent-terms-version không được rỗng — không có phiên bản điều khoản thì "
                            + "vết đồng ý không nói được người giám hộ đã đồng ý với cái gì.");
        }
        this.currentVersion = value;
    }

    /** Phiên bản điều khoản đang hiệu lực — ghi vào mọi dòng đồng ý thu từ hôm nay. */
    public String currentVersion() {
        return currentVersion;
    }
}
