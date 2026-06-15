package com.deutschflow.speaking.tts;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Unit tests for {@link XttsStreamClient} using {@link MockRestServiceServer} — verifies the request
 * shape (URL, ngrok header, per-voice body fields), PCM passthrough, gating when unconfigured, and
 * fail-soft on errors.
 */
class XttsStreamClientTest {

    private static final XttsVoice LUKAS = new XttsVoice("de-lukas_man", 1.0, 0.68, 5.0, "de");
    private static final String BASE = "https://example.ngrok-free.dev";

    private XttsProperties props;
    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private XttsStreamClient client;

    @BeforeEach
    void setUp() {
        props = new XttsProperties();
        props.setBaseUrl(BASE);
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.createServer(restTemplate);
        client = new XttsStreamClient(props, restTemplate);
    }

    @Test
    @DisplayName("posts the right URL + ngrok header + per-voice body, returns PCM bytes")
    void postsCorrectRequestAndReturnsPcm() {
        byte[] pcm = {1, 2, 3, 4, 5, 6};
        server.expect(requestTo(BASE + "/v1/text-to-speech/de-lukas_man/stream"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("ngrok-skip-browser-warning", "true"))
                .andExpect(jsonPath("$.text").value("Hallo, wie geht es dir?"))
                .andExpect(jsonPath("$.language_code").value("de"))
                .andExpect(jsonPath("$.seed").value(420))
                .andExpect(jsonPath("$.temperature").value(0.68))
                .andExpect(jsonPath("$.repetition_penalty").value(5.0))
                .andExpect(jsonPath("$.voice_settings.speed").value(1.0))
                .andExpect(jsonPath("$.enable_text_splitting").value(false))
                .andExpect(jsonPath("$.previous_text").value("Guten Morgen."))
                .andRespond(withSuccess(pcm, MediaType.parseMediaType("audio/L16")));

        byte[] out = client.synthesize(LUKAS, "Hallo, wie geht es dir?", "Guten Morgen.");

        assertThat(out).containsExactly(1, 2, 3, 4, 5, 6);
        server.verify();
    }

    @Test
    @DisplayName("omits previous_text when it is null/blank")
    void omitsPreviousTextWhenAbsent() {
        server.expect(requestTo(BASE + "/v1/text-to-speech/de-lukas_man/stream"))
                .andExpect(jsonPath("$.previous_text").doesNotExist())
                .andRespond(withSuccess(new byte[]{9}, MediaType.parseMediaType("audio/L16")));

        assertThat(client.synthesize(LUKAS, "Erster Satz.", null)).containsExactly(9);
        server.verify();
    }

    @Test
    @DisplayName("returns null without any HTTP call when base-url is not configured")
    void returnsNullWhenNotConfigured() {
        props.setBaseUrl("");   // no expectations registered → any call would fail the mock server
        assertThat(client.synthesize(LUKAS, "Hallo.", null)).isNull();
        server.verify();
    }

    @Test
    @DisplayName("returns null on blank text or null voice (no call)")
    void returnsNullOnInvalidInput() {
        assertThat(client.synthesize(LUKAS, "   ", null)).isNull();
        assertThat(client.synthesize(null, "Hallo.", null)).isNull();
        server.verify();
    }

    @Test
    @DisplayName("fails soft (null) on server error instead of throwing")
    void failsSoftOnServerError() {
        server.expect(requestTo(BASE + "/v1/text-to-speech/de-lukas_man/stream"))
                .andRespond(withServerError());

        assertThat(client.synthesize(LUKAS, "Hallo.", null)).isNull();
        server.verify();
    }
}
