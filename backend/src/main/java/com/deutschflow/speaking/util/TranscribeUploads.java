package com.deutschflow.speaking.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;

/**
 * Validates multipart audio uploads for {@code /transcribe}.
 */
public final class TranscribeUploads {

    private static final Set<String> ALLOWED_BASE_TYPES = Set.of(
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
            "video/webm"
    );

    private TranscribeUploads() {
    }

    public static boolean isAllowedAudioContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return false;
        }
        String base = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return ALLOWED_BASE_TYPES.contains(base);
    }

    /**
     * Reads the stream until EOF or until more than {@code maxBytesInclusive} bytes would be read.
     *
     * @throws IllegalArgumentException if the stream exceeds the limit
     */
    public static byte[] readAtMost(InputStream in, long maxBytesInclusive) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        long total = 0;
        int n;
        while ((n = in.read(buf)) >= 0) {
            total += n;
            if (total > maxBytesInclusive) {
                throw new IllegalArgumentException("Audio exceeds maximum allowed size");
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }
}
