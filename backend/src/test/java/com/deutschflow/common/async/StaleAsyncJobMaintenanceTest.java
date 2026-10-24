package com.deutschflow.common.async;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class StaleAsyncJobMaintenanceTest {

    @Test
    @DisplayName("đọc cấu hình ngưỡng theo loại: chuẩn hoá tên, nâng ngưỡng lên sàn, bỏ mục hỏng")
    void parseOverrides_normalisesAndSkipsBrokenEntries() {
        Map<String, Integer> parsed = StaleAsyncJobMaintenance.parseOverrides(
                " curriculum_import_preview = 120 ,VIDEO_RENDER_VOCAB=3,BROKEN,=50,GENERATE_PPTX=abc,");

        assertThat(parsed).containsExactly(
                Map.entry("CURRICULUM_IMPORT_PREVIEW", 120),
                Map.entry("VIDEO_RENDER_VOCAB", StaleAsyncJobMaintenance.MIN_STALE_MINUTES));
    }

    @Test
    @DisplayName("cấu hình rỗng ⇒ mọi loại dùng ngưỡng chung")
    void parseOverrides_blankMeansNoOverride() {
        assertThat(StaleAsyncJobMaintenance.parseOverrides("")).isEmpty();
        assertThat(StaleAsyncJobMaintenance.parseOverrides(null)).isEmpty();
    }
}
