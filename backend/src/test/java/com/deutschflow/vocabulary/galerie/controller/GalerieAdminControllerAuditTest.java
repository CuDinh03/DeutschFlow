package com.deutschflow.vocabulary.galerie.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.user.entity.User;
import com.deutschflow.vocabulary.galerie.service.GalerieConceptService;
import com.deutschflow.vocabulary.galerie.service.GalerieSvgGenerationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit R-M4 (03/09/2026): {@code /decision} là CỔNG PUBLISH artwork ra Galerie công khai
 * (APPROVE/REGENERATE/REJECT) và {@code /artwork} nạp nội dung sẽ hiển thị — cả controller trước
 * đây không có AuditLogService, không để lại vết ai/khi nào.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GalerieAdminController — vết audit cổng publish (R-M4)")
class GalerieAdminControllerAuditTest {

    @Mock private GalerieSvgGenerationService svgGenerationService;
    @Mock private AuditLogService auditLogService;

    private static User admin() {
        return User.builder().id(3L).email("admin@x.com").displayName("Admin")
                .passwordHash("h").role(User.Role.ADMIN).build();
    }

    private GalerieAdminController controller() {
        return new GalerieAdminController(mock(GalerieConceptService.class), svgGenerationService,
                mock(JdbcTemplate.class), auditLogService);
    }

    @SuppressWarnings("unchecked")
    private static ArgumentCaptor<Map<String, Object>> metaCaptor() {
        return ArgumentCaptor.forClass(Map.class);
    }

    @Test
    @DisplayName("decide APPROVE khi đổi trạng thái: ghi admin.vocabulary.galerie.decided")
    void decide_changed_writesAudit() {
        when(svgGenerationService.decide(5L, GalerieSvgGenerationService.Decision.APPROVE)).thenReturn(true);

        controller().decide(5L, new GalerieAdminController.GalerieDecisionRequest("APPROVE"), admin());

        var actor = ArgumentCaptor.forClass(AuditActor.class);
        var meta = metaCaptor();
        verify(auditLogService).log(eq("admin.vocabulary.galerie.decided"), actor.capture(),
                eq("GALERIE_ARTWORK"), eq("5"), meta.capture());
        assertThat(actor.getValue().id()).isEqualTo(3L);
        assertThat(meta.getValue()).containsEntry("decision", "APPROVE");
    }

    @Test
    @DisplayName("decide khi KHÔNG đổi trạng thái (409): không ghi vết")
    void decide_notChanged_writesNoAudit() {
        when(svgGenerationService.decide(5L, GalerieSvgGenerationService.Decision.APPROVE)).thenReturn(false);

        controller().decide(5L, new GalerieAdminController.GalerieDecisionRequest("APPROVE"), admin());

        verify(auditLogService, never()).log(any(), any(AuditActor.class), any(), any(), any());
    }

    @Test
    @DisplayName("importArtwork thành công: ghi admin.vocabulary.galerie.artwork_imported")
    void importArtwork_writesAudit() {
        when(svgGenerationService.importArtwork(eq(5L), any(), any()))
                .thenReturn(new GalerieSvgGenerationService.ImportResult(5L, "s3://art/5.svg", 12, 2048));

        controller().importArtwork(5L,
                new GalerieAdminController.GalerieArtworkImportRequest("<svg/>"), admin());

        var meta = metaCaptor();
        verify(auditLogService).log(eq("admin.vocabulary.galerie.artwork_imported"), any(AuditActor.class),
                eq("GALERIE_ARTWORK"), eq("5"), meta.capture());
        assertThat(meta.getValue()).containsEntry("elementCount", 12).containsEntry("sizeBytes", 2048);
    }
}
