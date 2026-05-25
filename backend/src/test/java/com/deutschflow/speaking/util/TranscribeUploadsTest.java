package com.deutschflow.speaking.util;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TranscribeUploadsTest {

    @Test
    void isAllowedAudioContentType_acceptsWebmAndVideoWebm() {
        assertThat(TranscribeUploads.isAllowedAudioContentType("audio/webm")).isTrue();
        assertThat(TranscribeUploads.isAllowedAudioContentType("video/webm; codecs=opus")).isTrue();
        assertThat(TranscribeUploads.isAllowedAudioContentType("text/plain")).isFalse();
    }

    @Test
    void readAtMost_rejectsOverflow() {
        byte[] big = new byte[20];
        assertThatThrownBy(() -> TranscribeUploads.readAtMost(new ByteArrayInputStream(big), 10))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void readAtMost_readsWithinLimit() throws IOException {
        byte[] data = new byte[]{1, 2, 3};
        byte[] out = TranscribeUploads.readAtMost(new ByteArrayInputStream(data), 10);
        assertThat(out).hasSize(3);
    }
}
