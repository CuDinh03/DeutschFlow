package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.ai.EdgeTtsService;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.tts.XttsPersonaVoiceResolver;
import com.deutschflow.speaking.tts.XttsStreamClient;
import com.deutschflow.speaking.tts.XttsVoice;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link TtsController} one-shot TTS: prefer XTTS (audio/wav, same voice as streaming
 * chat), fall back to edge-tts (audio/mpeg), then 503 → on-device.
 */
@ExtendWith(MockitoExtension.class)
class TtsControllerUnitTest {

    private static final XttsVoice LUKAS = new XttsVoice("de-lukas_man", 1.0, 0.68, 5.0, "de");

    @Mock EdgeTtsService edgeTtsService;
    @Mock XttsStreamClient xttsStreamClient;
    @Mock XttsPersonaVoiceResolver voiceResolver;

    TtsController controller;

    @BeforeEach
    void setUp() {
        controller = new TtsController(edgeTtsService, xttsStreamClient, voiceResolver);
    }

    private static String contentType(ResponseEntity<byte[]> r) {
        return r.getHeaders().getContentType() == null ? null : r.getHeaders().getContentType().toString();
    }

    @Test
    @DisplayName("blank text → 400")
    void blankText() {
        ResponseEntity<byte[]> r = controller.synthesize(Map.of("text", "", "persona", "LUKAS"), null);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("prefers XTTS: synthesizes each sentence and returns a WAV (audio/wav), no edge-tts")
    void prefersXttsReturnsWav() {
        when(xttsStreamClient.isConfigured()).thenReturn(true);
        when(voiceResolver.resolve(SpeakingPersona.LUKAS)).thenReturn(Optional.of(LUKAS));
        when(xttsStreamClient.synthesize(eq(LUKAS), anyString(), any())).thenReturn(new byte[]{1, 2});

        ResponseEntity<byte[]> r = controller.synthesize(
                Map.of("text", "Hallo. Wie geht's?", "persona", "LUKAS"), null);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(contentType(r)).isEqualTo("audio/wav");
        assertThat(new String(r.getBody(), 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
        verifyNoInteractions(edgeTtsService);
    }

    @Test
    @DisplayName("falls back to edge-tts (audio/mpeg) when XTTS not configured")
    void edgeFallbackWhenXttsUnconfigured() {
        when(xttsStreamClient.isConfigured()).thenReturn(false);
        when(edgeTtsService.synthesize("Hallo", "LUKAS")).thenReturn(new byte[]{9});

        ResponseEntity<byte[]> r = controller.synthesize(Map.of("text", "Hallo", "persona", "LUKAS"), null);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(contentType(r)).isEqualTo("audio/mpeg");
        assertThat(r.getBody()).containsExactly(9);
    }

    @Test
    @DisplayName("falls back to edge-tts when persona has no XTTS voice (e.g. VN tutor)")
    void edgeFallbackWhenPersonaHasNoVoice() {
        when(xttsStreamClient.isConfigured()).thenReturn(true);
        when(voiceResolver.resolve(SpeakingPersona.TUAN)).thenReturn(Optional.empty());
        when(edgeTtsService.synthesize(anyString(), eq("TUAN"))).thenReturn(new byte[]{7});

        ResponseEntity<byte[]> r = controller.synthesize(Map.of("text", "Xin chao", "persona", "TUAN"), null);

        assertThat(contentType(r)).isEqualTo("audio/mpeg");
        assertThat(r.getBody()).containsExactly(7);
    }

    @Test
    @DisplayName("falls back to edge-tts when XTTS produced no audio")
    void edgeFallbackWhenXttsProducesNothing() {
        when(xttsStreamClient.isConfigured()).thenReturn(true);
        when(voiceResolver.resolve(SpeakingPersona.LUKAS)).thenReturn(Optional.of(LUKAS));
        when(xttsStreamClient.synthesize(eq(LUKAS), anyString(), any())).thenReturn(null);
        when(edgeTtsService.synthesize(anyString(), anyString())).thenReturn(new byte[]{5});

        ResponseEntity<byte[]> r = controller.synthesize(Map.of("text", "Hallo.", "persona", "LUKAS"), null);

        assertThat(contentType(r)).isEqualTo("audio/mpeg");
        assertThat(r.getBody()).containsExactly(5);
    }

    @Test
    @DisplayName("503 when neither XTTS nor edge-tts available → client uses on-device")
    void serviceUnavailableWhenNeither() {
        when(xttsStreamClient.isConfigured()).thenReturn(false);
        when(edgeTtsService.synthesize(anyString(), anyString())).thenReturn(null);

        ResponseEntity<byte[]> r = controller.synthesize(Map.of("text", "Hallo", "persona", "LUKAS"), null);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
