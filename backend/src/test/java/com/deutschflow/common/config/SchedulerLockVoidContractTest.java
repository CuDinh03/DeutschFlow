package com.deutschflow.common.config;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.type.MethodMetadata;
import org.springframework.core.type.classreading.CachingMetadataReaderFactory;
import org.springframework.core.type.classreading.MetadataReaderFactory;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Khoá hợp đồng ShedLock: MỌI method mang {@code @SchedulerLock} phải trả {@code void}.
 *
 * <p>Vì sao cần bài test này: ShedLock chỉ chặn method trả kiểu khác void lúc CHẠY
 * (LockingNotSupportedException) — compiler không bắt, còn lỗi thì chỉ nổ khi scheduler thật sự
 * tick trên môi trường chạy dài. Trước đây ràng buộc này được phủ "ké" bằng cách cho
 * {@code StaleAiJobGuardIntegrationTest} gọi tay entry point
 * {@code StaleAiJobExpirer.expireStalePendingJobs()}; nhưng trên DB Testcontainers dùng chung giữa
 * mọi Spring context của suite CI, khoá 'staleAiJobExpire' (lockAtLeastFor=PT1M) có thể đang bị
 * context khác giữ — cron 03:15 UTC, hoặc lần chạy suite trước đó &lt;60s — làm lời gọi tay bị skip
 * im lặng và test đỏ giả. Integration test giờ gọi bean logic ({@code StaleAiJobMaintenance});
 * ràng buộc void chuyển về đây: quét bytecode toàn bộ com.deutschflow nên entry point MỚI cũng tự
 * động bị kiểm — không đụng DB, không đụng ShedLock, không flaky.
 */
class SchedulerLockVoidContractTest {

    private static final String SCHEDULER_LOCK = SchedulerLock.class.getName();

    @Test
    @DisplayName("mọi method @SchedulerLock trong com.deutschflow đều trả void")
    void allSchedulerLockMethodsReturnVoid() throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        MetadataReaderFactory metadataFactory = new CachingMetadataReaderFactory(resolver);
        Resource[] classFiles = resolver.getResources("classpath*:com/deutschflow/**/*.class");

        List<String> lockedMethods = new ArrayList<>();
        List<String> offenders = new ArrayList<>();
        for (Resource classFile : classFiles) {
            for (MethodMetadata method : metadataFactory.getMetadataReader(classFile)
                    .getAnnotationMetadata().getAnnotatedMethods(SCHEDULER_LOCK)) {
                String signature = method.getDeclaringClassName() + "." + method.getMethodName();
                lockedMethods.add(signature);
                if (!"void".equals(method.getReturnTypeName())) {
                    offenders.add(signature + " trả " + method.getReturnTypeName());
                }
            }
        }

        // Chống "xanh rỗng": nếu cách quét hỏng (layout classpath đổi) thì danh sách trống và test
        // phải đỏ — neo bằng chính entry point mà bài IT cũ từng phủ.
        assertThat(lockedMethods)
                .contains("com.deutschflow.ai.queue.StaleAiJobExpirer.expireStalePendingJobs");
        assertThat(offenders)
                .as("method @SchedulerLock trả khác void sẽ nổ LockingNotSupportedException lúc scheduler tick")
                .isEmpty();
    }
}
