package com.deutschflow.user.mfa;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Totp — RFC 6238 (HMAC-SHA1)")
class TotpTest {

    /** Khoá SHA1 của RFC 6238 Appendix B: chuỗi ASCII "12345678901234567890". */
    private static final byte[] RFC_KEY = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    @ParameterizedTest(name = "T={0}s → {1}")
    @CsvSource({
            "59,          94287082",
            "1111111109,  07081804",
            "1111111111,  14050471",
            "1234567890,  89005924",
            "2000000000,  69279037",
            "20000000000, 65353130",
    })
    @DisplayName("vectơ Appendix B (8 chữ số) — kiểm cả cắt động")
    void rfc6238Vectors8Digits(long epochSeconds, String expected) {
        long step = Totp.stepAt(Instant.ofEpochSecond(epochSeconds));
        assertThat(Totp.code(RFC_KEY, step, 8)).isEqualTo(expected);
    }

    @ParameterizedTest(name = "T={0}s → {1}")
    @CsvSource({
            "59,          287082",
            "1111111109,  081804",
            "1111111111,  050471",
            "1234567890,  005924",
            "2000000000,  279037",
            "20000000000, 353130",
    })
    @DisplayName("cùng vectơ ở 6 chữ số (đệm 0 bên trái) — dạng ứng dụng xác thực hiển thị")
    void rfc6238Vectors6Digits(long epochSeconds, String expected) {
        long step = Totp.stepAt(Instant.ofEpochSecond(epochSeconds));
        assertThat(Totp.code(RFC_KEY, step)).isEqualTo(expected);
    }

    @Test
    @DisplayName("RFC 4226 §5.4: ví dụ cắt động cho ra 0x50ef7f19 → 872921")
    void truncationExampleFromRfc4226() {
        byte[] hmac = new byte[]{
                (byte) 0x1f, (byte) 0x86, (byte) 0x98, (byte) 0x69, (byte) 0x0e, (byte) 0x02, (byte) 0xca,
                (byte) 0x16, (byte) 0x61, (byte) 0x85, (byte) 0x50, (byte) 0xef, (byte) 0x7f, (byte) 0x19,
                (byte) 0xda, (byte) 0x8e, (byte) 0x94, (byte) 0x5b, (byte) 0x55, (byte) 0x5a};
        assertThat(Totp.truncate(hmac, 6)).isEqualTo("872921");
        assertThat(Totp.truncate(hmac, 8)).isEqualTo(String.format("%08d", 0x50ef7f19 % 100_000_000));
    }

    @Test
    @DisplayName("chấp nhận bước hiện tại và ±1 bước, trả đúng bước khớp")
    void acceptsCurrentAndAdjacentSteps() {
        long now = 1_000_000L;
        for (long delta = -1; delta <= 1; delta++) {
            String code = Totp.code(RFC_KEY, now + delta);
            OptionalLong matched = Totp.verify(RFC_KEY, code, now, 1);
            assertThat(matched).hasValue(now + delta);
        }
    }

    @Test
    @DisplayName("từ chối mã của bước ±2 (ngoài cửa sổ)")
    void rejectsOutsideWindow() {
        long now = 1_000_000L;
        assertThat(Totp.verify(RFC_KEY, Totp.code(RFC_KEY, now - 2), now, 1)).isEmpty();
        assertThat(Totp.verify(RFC_KEY, Totp.code(RFC_KEY, now + 2), now, 1)).isEmpty();
    }

    @Test
    @DisplayName("từ chối mã sai định dạng / rỗng; chấp nhận khoảng trắng giữa các số")
    void rejectsMalformed() {
        long now = 1_000_000L;
        String code = Totp.code(RFC_KEY, now);
        assertThat(Totp.verify(RFC_KEY, null, now, 1)).isEmpty();
        assertThat(Totp.verify(RFC_KEY, "", now, 1)).isEmpty();
        assertThat(Totp.verify(RFC_KEY, "12345", now, 1)).isEmpty();
        assertThat(Totp.verify(RFC_KEY, "abcdef", now, 1)).isEmpty();
        assertThat(Totp.verify(RFC_KEY, code.substring(0, 3) + " " + code.substring(3), now, 1)).hasValue(now);
    }

    @Test
    @DisplayName("chống phát lại là việc của last_used_step: verify trả bước để người gọi so (bước đã dùng ≥ bước khớp ⇒ từ chối)")
    void replayGuardUsesReturnedStep() {
        long now = 1_000_000L;
        String code = Totp.code(RFC_KEY, now);
        long matched = Totp.verify(RFC_KEY, code, now, 1).orElseThrow();
        long lastUsedStep = matched; // lần đầu đã ghi nhận bước này
        // Lần thứ hai cùng mã (vẫn trong cửa sổ) khớp đúng bước đó — điều kiện UPDATE "last_used_step < ?" sai ⇒ từ chối.
        long again = Totp.verify(RFC_KEY, code, now + 1, 1).orElseThrow();
        assertThat(again).isEqualTo(matched);
        assertThat(lastUsedStep < again).isFalse();
    }

    @Test
    @DisplayName("bước = floor(epoch / 30)")
    void stepComputation() {
        assertThat(Totp.stepAt(Instant.ofEpochSecond(59))).isEqualTo(1L);
        assertThat(Totp.stepAt(Instant.ofEpochSecond(60))).isEqualTo(2L);
        assertThat(ByteBuffer.allocate(8).putLong(Totp.stepAt(Instant.ofEpochSecond(1111111109))).array())
                .containsExactly(0, 0, 0, 0, 0x02, 0x35, 0x23, (byte) 0xEC);
    }
}
