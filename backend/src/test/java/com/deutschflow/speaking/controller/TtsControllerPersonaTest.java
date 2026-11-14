package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.speaking.dto.TtsPersonasDto;
import com.deutschflow.speaking.dto.TtsRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Persona bài nghe ở tầng controller (14/11/2026): sidecar đang chạy chưa có persona {@code HOER_*}
 * thì trả 422 và KHÔNG gọi tổng hợp (không để bản audio sai giọng vào cache); hợp đồng cũ giữ nguyên.
 */
@ExtendWith(MockitoExtension.class)
class TtsControllerPersonaTest {

    @Mock
    EdgeTtsService ttsService;

    @InjectMocks
    TtsController controller;

    @Test
    @DisplayName("persona HOER_* mà sidecar chưa có → 422, không gọi synthesize")
    void unsupportedHoerenPersonaIsRejected() {
        when(ttsService.isUnsupportedHoerenPersona("HOER_F1")).thenReturn(true);

        ResponseEntity<byte[]> resp = controller.synthesize(new TtsRequest("Guten Tag.", "HOER_F1"), null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        verify(ttsService, never()).synthesize(anyString(), anyString());
    }

    @Test
    @DisplayName("persona HOER_* mà sidecar đã có → 200 audio/mpeg đúng persona đó")
    void supportedHoerenPersonaIsSynthesized() {
        when(ttsService.isUnsupportedHoerenPersona("HOER_M2")).thenReturn(false);
        when(ttsService.synthesize("Guten Tag.", "HOER_M2")).thenReturn(new byte[] {1, 2, 3});

        ResponseEntity<byte[]> resp = controller.synthesize(new TtsRequest("Guten Tag.", "HOER_M2"), null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getHeaders().getContentType()).hasToString("audio/mpeg");
        assertThat(resp.getBody()).containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("hợp đồng cũ không đổi: thiếu persona → DEFAULT; không có audio → 503")
    void legacyContractUnchanged() {
        when(ttsService.isUnsupportedHoerenPersona("DEFAULT")).thenReturn(false);
        when(ttsService.synthesize("Hallo.", "DEFAULT")).thenReturn(null);

        ResponseEntity<byte[]> resp = controller.synthesize(new TtsRequest("Hallo.", null), null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(controller.synthesize(new TtsRequest(" ", "ANNA"), null).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("GET /tts/personas trả danh sách persona sidecar đang biết")
    void personasEndpointReturnsSidecarList() {
        when(ttsService.supportedPersonas()).thenReturn(List.of("ANNA", "HOER_F1", "THOMAS"));

        ResponseEntity<TtsPersonasDto> resp = controller.personas();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().personas()).containsExactly("ANNA", "HOER_F1", "THOMAS");
    }
}
