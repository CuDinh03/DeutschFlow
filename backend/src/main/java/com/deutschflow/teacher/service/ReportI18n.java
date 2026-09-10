package com.deutschflow.teacher.service;

import com.deutschflow.teacher.entity.StudentReportIssue;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Nhãn ba ngôn ngữ (vi/en/de, R8) cho phần backend RENDER của phiếu gửi gia đình — hiện chỉ PDF.
 *
 * <p><b>Vì sao không dùng {@code MessageSource} của Spring Boot.</b> Repo có sẵn
 * {@code i18n/messages_{vi,en,de}.properties} và {@code spring.messages.basename: i18n/messages},
 * nhưng KHÔNG có {@code i18n/messages.properties} (bản gốc không hậu tố) nên
 * {@code MessageSourceAutoConfiguration.ResourceBundleCondition} không khớp ⇒ không bean nào được
 * tạo, và {@code grep MessageSource src/main} rỗng — bundle đó hiện là tài sản không ai đọc. Kích hoạt
 * nó là một thay đổi toàn cục (đụng cả cách Bean Validation nội suy thông điệp) không thuộc phạm vi
 * PR này. Lớp này tự nạp bundle RIÊNG {@code i18n/report*.properties} — cùng thư mục, cùng định dạng,
 * không tác dụng phụ; khi nào bật MessageSource chung thì gộp vào là việc một dòng.
 *
 * <p>Bản gốc {@code report.properties} là tiếng Việt (mặc định R8); {@code report_en}/{@code report_de}
 * thiếu khoá nào thì rơi về tiếng Việt chứ KHÔNG rơi về locale hệ thống của máy chủ
 * ({@code fallbackToSystemLocale=false}) — container chạy locale POSIX, rơi về đó là ra tiếng Anh
 * hoặc mã khoá trần. Thiếu khoá ở cả bản gốc ⇒ in mã khoá ({@code useCodeAsDefaultMessage}) thay vì
 * ném: một nhãn thiếu không được phép biến việc tải PDF thành 500.
 *
 * <p>🪤 MỌI giá trị đi qua {@link java.text.MessageFormat} ({@code alwaysUseMessageFormat}): dấu nháy
 * đơn {@code '} phải viết {@code ''}, ngoặc nhọn phải bọc {@code '{'}. Người gọi truyền SỐ dưới dạng
 * chuỗi để tránh MessageFormat tự thêm dấu phân nhóm nghìn.
 */
@Component
public class ReportI18n {

    private final ResourceBundleMessageSource source;

    public ReportI18n() {
        ResourceBundleMessageSource s = new ResourceBundleMessageSource();
        s.setBasename("i18n/report");
        s.setDefaultEncoding("UTF-8");
        s.setFallbackToSystemLocale(false);
        s.setUseCodeAsDefaultMessage(true);
        // MỌI chuỗi qua MessageFormat, kể cả không tham số — để '' luôn thành ' nhất quán (không thì
        // "Teacher''s comment" in nguyên hai dấu nháy khi gọi không có args).
        s.setAlwaysUseMessageFormat(true);
        this.source = s;
    }

    /** Nhãn theo ngôn ngữ; {@code lang} lạ/rỗng ⇒ tiếng Việt. */
    public String t(String lang, String key, Object... args) {
        return source.getMessage(key, args, Locale.forLanguageTag(normalize(lang)));
    }

    /** {@code vi|en|de}; mọi thứ khác (kể cả {@code null}) ⇒ {@code vi} — cùng luật CHECK của V323. */
    public static String normalize(String lang) {
        if (lang == null) {
            return StudentReportIssue.LANG_VI;
        }
        String l = lang.trim().toLowerCase(Locale.ROOT);
        return StudentReportIssue.SUPPORTED_LANGS.contains(l) ? l : StudentReportIssue.LANG_VI;
    }
}
