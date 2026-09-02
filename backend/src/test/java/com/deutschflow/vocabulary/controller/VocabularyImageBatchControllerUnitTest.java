package com.deutschflow.vocabulary.controller;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.dto.VocabularyImageBatchGenerateRequest;
import com.deutschflow.vocabulary.service.VocabularyImageBatchService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit F-H4 (03/09/2026): batch sinh ảnh từ vựng nhận {@code limit} thẳng từ client và truyền
 * xuống service không qua chặn nào — {@code limit=100000} là một lượt sinh ảnh AI khổng lồ, tốn
 * tiền nhà cung cấp và chiếm hàng đợi. Thao tác cũng không để lại vết audit nào.
 *
 * <p>Sau A1 endpoint đã ADMIN-only, nhưng "chỉ admin gọi được" không phải là trần chi phí: một cú
 * bấm nhầm hoặc một tài khoản admin bị chiếm vẫn đốt được. Trần cứng + vết audit là thứ chặn.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("VocabularyImageBatchController — trần limit và vết audit (F-H4)")
class VocabularyImageBatchControllerUnitTest {

    @Mock
    private VocabularyImageBatchService batchService;
    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private VocabularyImageBatchController controller;

    private static User admin() {
        return User.builder().id(1L).email("admin@x.com").displayName("Admin")
                .passwordHash("h").role(User.Role.ADMIN).build();
    }

    @Test
    @DisplayName("generate: limit khổng lồ bị hạ xuống trần 20")
    void generateClampsHugeLimit() {
        when(batchService.generateBatch(eq(20), anyString(), any(), any(), any(), any())).thenReturn(20);

        var response = controller.generate(
                new VocabularyImageBatchGenerateRequest(100_000, "DEFAULT", null, null, null, null),
                20, null, null, null, "DEFAULT", admin());

        verify(batchService).generateBatch(eq(20), anyString(), any(), any(), any(), any());
        assertThat(response.getBody().limit()).isEqualTo(20);
    }

    @Test
    @DisplayName("generate: limit âm bị nâng lên 1 (không cho 0/âm chui xuống service)")
    void generateClampsNegativeLimit() {
        when(batchService.generateBatch(eq(1), anyString(), any(), any(), any(), any())).thenReturn(0);

        controller.generate(
                new VocabularyImageBatchGenerateRequest(-5, "DEFAULT", null, null, null, null),
                20, null, null, null, "DEFAULT", admin());

        verify(batchService).generateBatch(eq(1), anyString(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("generate: limit hợp lệ đi qua nguyên vẹn")
    void generateKeepsValidLimit() {
        when(batchService.generateBatch(eq(7), anyString(), any(), any(), any(), any())).thenReturn(7);

        controller.generate(
                new VocabularyImageBatchGenerateRequest(7, "DEFAULT", null, null, null, null),
                20, null, null, null, "DEFAULT", admin());

        verify(batchService).generateBatch(eq(7), anyString(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("generate: ghi vết audit kèm actor thật, limit đã kẹp và số ảnh tạo được")
    @SuppressWarnings("unchecked")
    void generateWritesAuditWithRealActor() {
        when(batchService.generateBatch(eq(20), anyString(), any(), any(), any(), any())).thenReturn(13);

        controller.generate(
                new VocabularyImageBatchGenerateRequest(100_000, "DEFAULT", "B1", null, null, null),
                20, null, null, null, "DEFAULT", admin());

        var actorCaptor = ArgumentCaptor.forClass(com.deutschflow.common.audit.AuditActor.class);
        var metaCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).log(
                eq("admin.vocabulary.image.batch"), actorCaptor.capture(),
                eq("VOCABULARY"), eq(null), metaCaptor.capture());

        // actor_user_id phải là id thật — vết chỉ có email thì không nối được sang bảng users.
        assertThat(actorCaptor.getValue().id()).isEqualTo(1L);
        assertThat(actorCaptor.getValue().email()).isEqualTo("admin@x.com");
        assertThat(actorCaptor.getValue().role()).isEqualTo("ADMIN");
        Map<String, Object> meta = metaCaptor.getValue();
        assertThat(meta.get("limit")).isEqualTo(20);   // giá trị ĐÃ kẹp, không phải 100000
        assertThat(meta.get("created")).isEqualTo(13);
        assertThat(meta.get("cefr")).isEqualTo("B1");
    }

    @Test
    @DisplayName("preview: limit cũng bị kẹp và trả về đúng giá trị đã kẹp")
    void previewClampsLimit() {
        when(batchService.listMissingWordIds(eq(20), any(), any(), any())).thenReturn(List.of(1L, 2L));
        when(batchService.countMissingImages(any(), any(), any())).thenReturn(500);

        var response = controller.preview(100_000, null, null, null, "DEFAULT", admin());

        verify(batchService).listMissingWordIds(eq(20), any(), any(), any());
        assertThat(response.getBody().limit()).isEqualTo(20);
    }

    @Test
    @DisplayName("word-info: quá 200 id thì từ chối thay vì dựng truy vấn IN (…) dài vô hạn")
    void wordInfoRejectsOversizedIdList() {
        List<Long> tooMany = LongStream.rangeClosed(1, 201).boxed().toList();

        assertThatThrownBy(() -> controller.wordInfo(tooMany))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("word-info: đúng 200 id vẫn cho qua (ranh giới)")
    void wordInfoAcceptsBoundary() {
        List<Long> exactly = LongStream.rangeClosed(1, 200).boxed().toList();
        when(batchService.getWordInfoByIds(exactly)).thenReturn(List.of());

        assertThatCode(() -> controller.wordInfo(exactly)).doesNotThrowAnyException();
    }
}
