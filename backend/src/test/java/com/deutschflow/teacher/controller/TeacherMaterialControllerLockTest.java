package com.deutschflow.teacher.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * B5 (khung AI tier 07/08): giáo án/PPTX tạm khoá theo quyết định owner #9 — flag tắt phải chặn
 * TRƯỚC mọi validate/quota/job (không tạo AsyncJob, không đụng Gemini), trả 403 FEATURE_DISABLED.
 */
class TeacherMaterialControllerLockTest {

    @Test
    @DisplayName("flag tắt (mặc định): generate-pptx trả 403 FEATURE_DISABLED, không tạo job")
    void disabledFlagBlocksGeneratePptx() {
        TeacherMaterialController controller = new TeacherMaterialController(
                mock(com.deutschflow.teacher.service.TeacherLessonPlanService.class),
                mock(com.deutschflow.teacher.service.DocumentParsingService.class),
                mock(com.deutschflow.common.async.AsyncJobService.class),
                mock(com.deutschflow.common.async.AsyncJobSseService.class),
                mock(com.deutschflow.teacher.service.PptxStore.class),
                mock(com.deutschflow.organization.service.OrgPoolGuard.class),
                mock(com.deutschflow.common.quota.FreeTierGuard.class));
        ReflectionTestUtils.setField(controller, "lessonPlanEnabled", false);

        var resp = controller.generatePptxAsync(null,
                new MockMultipartFile("file", "plan.docx", "application/vnd.openxmlformats", new byte[]{1}));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(((Map<?, ?>) resp.getBody()).get("error")).isEqualTo("FEATURE_DISABLED");
    }
}
