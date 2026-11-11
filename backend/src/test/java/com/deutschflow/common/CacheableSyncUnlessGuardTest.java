package com.deutschflow.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.TypeFilter;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Canh một lỗi chỉ lộ lúc CHẠY: Spring không cho {@code @Cacheable(sync = true)} đi kèm
 * {@code unless} và ném {@code IllegalStateException} ở mỗi lời gọi, không phải lúc khởi động.
 * Lỗi này từng làm {@code /api/ai-speaking/tts} trả 500 suốt từ 02/09 tới 11/11/2026 mà không
 * test nào bắt, vì các unit test gọi thẳng lớp thật, không đi qua proxy cache.
 *
 * <p>Test quét mọi lớp dưới {@code com.deutschflow} bằng reflection — không dựng Spring context,
 * không cần DB.
 */
class CacheableSyncUnlessGuardTest {

    @Test
    @DisplayName("không @Cacheable nào ghép sync=true với unless")
    void noCacheableCombinesSyncWithUnless() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        TypeFilter everything = (reader, factory) -> true;
        scanner.addIncludeFilter(everything);

        List<String> offenders = new ArrayList<>();
        int cacheableMethods = 0;
        for (BeanDefinition def : scanner.findCandidateComponents("com.deutschflow")) {
            Class<?> type;
            try {
                type = Class.forName(def.getBeanClassName(), false, getClass().getClassLoader());
            } catch (Throwable ignored) {
                continue; // lớp không nạp được trong môi trường test thì bỏ qua
            }
            Method[] methods;
            try {
                methods = type.getDeclaredMethods();
            } catch (Throwable ignored) {
                continue;
            }
            for (Method method : methods) {
                Cacheable cacheable = AnnotatedElementUtils.findMergedAnnotation(method, Cacheable.class);
                if (cacheable == null) {
                    continue;
                }
                cacheableMethods++;
                if (cacheable.sync() && !cacheable.unless().isBlank()) {
                    offenders.add(type.getName() + "#" + method.getName());
                }
            }
        }

        assertThat(cacheableMethods)
                .as("phải quét thấy các phương thức @Cacheable — nếu bằng 0 thì bộ quét hỏng, test vô nghĩa")
                .isGreaterThan(5);
        assertThat(offenders)
                .as("@Cacheable(sync = true) không được có unless — Spring ném lỗi ở mỗi lời gọi")
                .isEmpty();
    }
}
