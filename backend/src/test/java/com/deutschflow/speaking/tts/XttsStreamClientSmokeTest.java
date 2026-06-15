package com.deutschflow.speaking.tts;

import com.deutschflow.common.http.RestTemplates;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Gated integration smoke test against a REAL XTTS server. Runs only when {@code XTTS_BASE_URL} is
 * set (so it never runs in CI / on machines without the server); verifies the live contract end to
 * end: one German sentence → non-empty PCM.
 */
@EnabledIfEnvironmentVariable(named = "XTTS_BASE_URL", matches = ".+")
class XttsStreamClientSmokeTest {

    @Test
    @DisplayName("[gated] real XTTS server synthesizes a German sentence to non-empty PCM")
    void realServerReturnsPcm() {
        XttsProperties props = new XttsProperties();
        props.setBaseUrl(System.getenv("XTTS_BASE_URL"));
        XttsStreamClient client = new XttsStreamClient(
                props, RestTemplates.withTimeouts(props.getConnectTimeoutMs(), props.getReadTimeoutMs()));

        XttsVoice lukas = new XttsVoice("de-lukas_man", 1.0, 0.68, 5.0, "de");
        byte[] pcm = client.synthesize(lukas, "Guten Morgen, wie geht es Ihnen heute?", null);

        assertThat(pcm).isNotNull();
        // PCM16 @ 24kHz: a short sentence is well over 0.2s of audio.
        assertThat(pcm.length).isGreaterThan(24000 * 2 / 5);
    }
}
