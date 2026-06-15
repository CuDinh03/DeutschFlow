package com.deutschflow.speaking.tts;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;

/**
 * Wraps raw PCM into a minimal canonical WAV (RIFF) container so a browser {@code <audio>} element
 * can play XTTS output (which is headerless PCM). Used by the one-shot {@code /api/ai-speaking/tts}
 * endpoint (greeting / on-device fallback); the per-sentence SSE streaming path sends raw PCM instead.
 */
public final class WavEncoder {

    private static final int HEADER_BYTES = 44;
    private static final int BITS_PER_SAMPLE = 16;

    private WavEncoder() {
    }

    /**
     * @param pcm        raw PCM {@code s16le} samples
     * @param sampleRate e.g. 24000
     * @param channels   e.g. 1 (mono)
     * @return a self-contained WAV file (44-byte header + data)
     */
    public static byte[] pcm16ToWav(byte[] pcm, int sampleRate, int channels) {
        int dataLen = pcm.length;
        int byteRate = sampleRate * channels * (BITS_PER_SAMPLE / 8);
        int blockAlign = channels * (BITS_PER_SAMPLE / 8);

        ByteBuffer buf = ByteBuffer.allocate(HEADER_BYTES + dataLen).order(ByteOrder.LITTLE_ENDIAN);
        buf.put(ascii("RIFF"));
        buf.putInt(36 + dataLen);          // ChunkSize
        buf.put(ascii("WAVE"));
        buf.put(ascii("fmt "));
        buf.putInt(16);                    // Subchunk1Size (PCM)
        buf.putShort((short) 1);           // AudioFormat = PCM
        buf.putShort((short) channels);
        buf.putInt(sampleRate);
        buf.putInt(byteRate);
        buf.putShort((short) blockAlign);
        buf.putShort((short) BITS_PER_SAMPLE);
        buf.put(ascii("data"));
        buf.putInt(dataLen);               // Subchunk2Size
        buf.put(pcm);
        return buf.array();
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }
}
