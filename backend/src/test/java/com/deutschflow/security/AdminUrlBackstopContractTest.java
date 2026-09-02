package com.deutschflow.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotationAttributes;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.type.AnnotationMetadata;
import org.springframework.core.type.classreading.CachingMetadataReaderFactory;
import org.springframework.core.type.classreading.MetadataReaderFactory;
import org.springframework.web.bind.annotation.RequestMapping;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Khoá hợp đồng vành đai admin: MỌI controller có {@code @RequestMapping} class-level chứa
 * {@code /admin} phải nằm dưới một prefix ĐÃ có backstop URL trong
 * {@link com.deutschflow.common.config.SecurityConfig} — tức {@code /api/admin} hoặc
 * {@code /api/v2/admin}.
 *
 * <p>Vì sao cần bài test này (audit F-H1, 03/09/2026): trước đây chỉ {@code /api/admin/**} có
 * backstop URL, còn {@code /api/v2/admin/**} thì không. Hệ quả là
 * {@code VocabularyImageReviewController} để {@code @PreAuthorize("isAuthenticated()")} trên
 * {@code GET .../review/{wordId}} và MỌI STUDENT gọi được endpoint quản trị — quên một annotation
 * là thủng, vì method-security khi đó là lớp bảo vệ DUY NHẤT. Compiler không bắt được lỗi này và
 * bài RBAC test theo từng endpoint chỉ phủ endpoint nào ai đó nhớ viết test.
 *
 * <p>Bài test quét bytecode toàn bộ {@code com.deutschflow} nên controller admin MỚI cũng tự động
 * bị kiểm — không đụng DB, không phụ thuộc Spring context, không flaky. Khi thêm một namespace
 * admin mới (ví dụ {@code /api/v3/admin/**}) thì phải thêm backstop trong SecurityConfig TRƯỚC,
 * rồi mới nới hằng {@link #BACKSTOPPED_ADMIN_PREFIXES} ở đây.
 */
class AdminUrlBackstopContractTest {

    /** Các prefix có {@code auth.requestMatchers(...).hasRole("ADMIN")} ở tầng URL. */
    private static final List<String> BACKSTOPPED_ADMIN_PREFIXES = List.of("/api/admin", "/api/v2/admin");

    @Test
    @DisplayName("mọi @RequestMapping class-level chứa '/admin' đều nằm dưới prefix có backstop URL")
    void everyAdminMappingSitsBehindAUrlBackstop() throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        MetadataReaderFactory metadataFactory = new CachingMetadataReaderFactory(resolver);
        Resource[] classFiles = resolver.getResources("classpath*:com/deutschflow/**/*.class");

        List<String> adminMappings = new ArrayList<>();
        List<String> offenders = new ArrayList<>();
        for (Resource classFile : classFiles) {
            AnnotationMetadata metadata = metadataFactory.getMetadataReader(classFile).getAnnotationMetadata();
            Map<String, Object> attrs = metadata.getAnnotationAttributes(RequestMapping.class.getName());
            if (attrs == null) {
                continue;
            }
            for (String path : AnnotationAttributes.fromMap(attrs).getStringArray("value")) {
                if (!path.contains("/admin")) {
                    continue;
                }
                String signature = metadata.getClassName() + " -> " + path;
                adminMappings.add(signature);
                if (BACKSTOPPED_ADMIN_PREFIXES.stream().noneMatch(
                        prefix -> path.equals(prefix) || path.startsWith(prefix + "/"))) {
                    offenders.add(signature);
                }
            }
        }

        // Chống "xanh rỗng": nếu cách quét hỏng (layout classpath đổi) thì danh sách trống và test
        // phải đỏ — neo bằng chính controller từng thủng ở F-H1.
        assertThat(adminMappings)
                .as("phép quét bytecode phải thấy được các controller admin")
                .contains("com.deutschflow.vocabulary.controller.VocabularyImageReviewController"
                        + " -> /api/v2/admin/vocabulary/images/review");
        assertThat(offenders)
                .as("controller namespace admin nằm ngoài backstop URL: quên @PreAuthorize là mọi "
                        + "user đăng nhập gọi được. Thêm backstop trong SecurityConfig hoặc dời path.")
                .isEmpty();
    }
}
