package com.deutschflow.speaking.tts;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class WavEncoderTest {

    @Test
    @DisplayName("wraps PCM in a canonical 44-byte WAV header with correct format fields")
    void wrapsPcmWithCorrectHeader() {
        byte[] pcm = {1, 2, 3, 4, 5, 6, 7, 8}; // 4 s16 samples
        byte[] wav = WavEncoder.pcm16ToWav(pcm, 24000, 1);

        assertThat(wav).hasSize(44 + pcm.length);
        assertThat(new String(wav, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
        assertThat(new String(wav, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("WAVE");
        assertThat(new String(wav, 12, 4, StandardCharsets.US_ASCII)).isEqualTo("fmt ");
        assertThat(new String(wav, 36, 4, StandardCharsets.US_ASCII)).isEqualTo("data");

        ByteBuffer b = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN);
        assertThat(b.getInt(4)).isEqualTo(36 + pcm.length); // ChunkSize
        assertThat(b.getShort(20)).isEqualTo((short) 1);    // PCM
        assertThat(b.getShort(22)).isEqualTo((short) 1);    // channels
        assertThat(b.getInt(24)).isEqualTo(24000);          // sample rate
        assertThat(b.getInt(28)).isEqualTo(24000 * 2);      // byte rate
        assertThat(b.getShort(34)).isEqualTo((short) 16);   // bits/sample
        assertThat(b.getInt(40)).isEqualTo(pcm.length);     // data size

        // PCM data appended verbatim after the header
        assertThat(java.util.Arrays.copyOfRange(wav, 44, 44 + pcm.length)).containsExactly(pcm);
    }

    @Test
    @DisplayName("empty PCM → header-only WAV")
    void emptyPcm() {
        byte[] wav = WavEncoder.pcm16ToWav(new byte[0], 24000, 1);
        assertThat(wav).hasSize(44);
        assertThat(ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN).getInt(40)).isZero();
    }
}
