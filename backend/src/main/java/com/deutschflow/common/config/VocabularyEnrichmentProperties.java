package com.deutschflow.common.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Knobs cho Smart Free: auto-stop corpus, DeepL monthly cap (free tier), strict-free (stub). */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.vocabulary")
public class VocabularyEnrichmentProperties {

    /**
     * Khi corpus đủ lớn ({@link #enrichmentAutoStopMinTotalWords}) và không còn từ thiếu EN hoặc VI hợp lệ → tất cả scheduler enrich đứng lại cho đến restart.
     */
    private boolean enrichmentAutoStopEnabled = true;

    /** Ngưỡng tối thiểu số lemma trong DB để auto-stop được kích hoạt (mặc định 10000 như SRS). */
    private int enrichmentAutoStopMinTotalWords = 10000;

    /** Chu kỳ đánh giá auto-stop trong {@link EnrichmentSuspendGate}. */
    private long enrichmentAutoStopScanMs = 90000L;

    /** Trần DeepL API Free (billing month UTC), dưới 500k ký tự đầu vào. */
    private long deeplFreeMonthlyCharCap = 490_000L;

    /**
     * Khi true: không gọi endpoint có SKU trả phí (áp giai đoạn sau cho Azure/non-free); luôn có thể tắt DeepL không key.
     */
    private boolean strictFreeMode = true;
}
