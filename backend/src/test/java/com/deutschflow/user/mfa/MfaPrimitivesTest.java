package com.deutschflow.user.mfa;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("2FA — Base32, mã hoá bí mật, mã khôi phục, khoá")
class MfaPrimitivesTest {

    private static byte[] randomKey() {
        byte[] k = new byte[32];
        new SecureRandom().nextBytes(k);
        return k;
    }

    @Nested
    @DisplayName("Base32 (RFC 4648, không đệm)")
    class Base32Test {

        @ParameterizedTest(name = "\"{0}\" ↔ {1}")
        @CsvSource(value = {
                "'',       ''",
                "f,        MY",
                "fo,       MZXQ",
                "foo,      MZXW6",
                "foob,     MZXW6YQ",
                "fooba,    MZXW6YTB",
                "foobar,   MZXW6YTBOI",
        })
        @DisplayName("vectơ RFC 4648 §10 (bỏ '=')")
        void rfcVectors(String plain, String encoded) {
            assertThat(Base32.encode(plain.getBytes(StandardCharsets.US_ASCII))).isEqualTo(encoded);
            assertThat(new String(Base32.decode(encoded), StandardCharsets.US_ASCII)).isEqualTo(plain);
        }

        @Test
        @DisplayName("giải mã dễ tính: chữ thường, khoảng trắng, gạch, đệm =")
        void lenientDecode() {
            assertThat(new String(Base32.decode("mzxw 6ytb-oi======"), StandardCharsets.US_ASCII)).isEqualTo("foobar");
        }

        @Test
        @DisplayName("ký tự ngoài bảng chữ → lỗi")
        void rejectsInvalid() {
            assertThatThrownBy(() -> Base32.decode("MZXW1")).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("khứ hồi bí mật 20 byte (32 ký tự)")
        void roundTrip() {
            byte[] secret = new byte[20];
            new SecureRandom().nextBytes(secret);
            String enc = Base32.encode(secret);
            assertThat(enc).hasSize(32).matches("[A-Z2-7]+");
            assertThat(Base32.decode(enc)).isEqualTo(secret);
        }
    }

    @Nested
    @DisplayName("MfaSecretCipher (AES-256-GCM, AAD = user id)")
    class CipherTest {

        @Test
        @DisplayName("khứ hồi; định dạng v1:<keyId>:<base64>; mỗi lần mã hoá một IV khác")
        void roundTrip() {
            MfaSecretCipher c = new MfaSecretCipher("k1", randomKey());
            byte[] secret = "totp-secret-20-bytes".getBytes(StandardCharsets.US_ASCII);
            String a = c.encrypt(42L, secret);
            String b = c.encrypt(42L, secret);
            assertThat(a).startsWith("v1:k1:");
            assertThat(a).isNotEqualTo(b);
            assertThat(c.decrypt(42L, a)).isEqualTo(secret);
            assertThat(a).doesNotContain("totp-secret");
        }

        @Test
        @DisplayName("sai AAD (dòng của người khác) → không giải mã được")
        void wrongAadFails() {
            MfaSecretCipher c = new MfaSecretCipher("k1", randomKey());
            String enc = c.encrypt(42L, new byte[]{1, 2, 3});
            assertThatThrownBy(() -> c.decrypt(43L, enc)).isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("sai khoá (cùng keyId) → không giải mã được")
        void wrongKeyFails() {
            String enc = new MfaSecretCipher("k1", randomKey()).encrypt(42L, new byte[]{1, 2, 3});
            MfaSecretCipher other = new MfaSecretCipher("k1", randomKey());
            assertThatThrownBy(() -> other.decrypt(42L, enc)).isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("keyId khác khoá đang nạp → báo rõ, không thử bừa")
        void keyIdMismatchFails() {
            byte[] key = randomKey();
            String enc = new MfaSecretCipher("k1", key).encrypt(42L, new byte[]{1});
            assertThatThrownBy(() -> new MfaSecretCipher("k2", key).decrypt(42L, enc))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("k1");
        }

        @Test
        @DisplayName("dữ liệu bị sửa một byte → thẻ GCM sai → lỗi")
        void tamperedFails() {
            MfaSecretCipher c = new MfaSecretCipher("k1", randomKey());
            String enc = c.encrypt(42L, new byte[]{1, 2, 3, 4});
            String[] parts = enc.split(":", 3);
            byte[] raw = Base64.getDecoder().decode(parts[2]);
            raw[raw.length - 1] ^= 0x01;
            String tampered = parts[0] + ":" + parts[1] + ":" + Base64.getEncoder().encodeToString(raw);
            assertThatThrownBy(() -> c.decrypt(42L, tampered)).isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("khoá không đúng 32 byte → từ chối dựng")
        void rejectsShortKey() {
            assertThatThrownBy(() -> new MfaSecretCipher("k1", new byte[16])).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("RecoveryCodes")
    class RecoveryCodesTest {

        @Test
        @DisplayName("10 mã, dạng XXXXX-XXXXX, Base32, không trùng")
        void generatesTenUniqueCodes() {
            List<String> codes = RecoveryCodes.generate();
            assertThat(codes).hasSize(10);
            assertThat(new HashSet<>(codes)).hasSize(10);
            codes.forEach(c -> assertThat(c).matches("[A-Z2-7]{5}-[A-Z2-7]{5}"));
        }

        @Test
        @DisplayName("băm: ổn định, không chứa mã thô, phụ thuộc user id và pepper; chuẩn hoá cách nhập")
        void hashing() {
            byte[] pepper = "pepper".getBytes(StandardCharsets.UTF_8);
            String code = "ABCDE-FGHIJ";
            String h = RecoveryCodes.hash(pepper, 7L, code);
            assertThat(h).hasSize(64).doesNotContain("ABCDE");
            assertThat(RecoveryCodes.hash(pepper, 7L, "abcde fghij")).isEqualTo(h);
            assertThat(RecoveryCodes.hash(pepper, 7L, "ABCDEFGHIJ")).isEqualTo(h);
            assertThat(RecoveryCodes.hash(pepper, 8L, code)).isNotEqualTo(h);
            assertThat(RecoveryCodes.hash("other".getBytes(StandardCharsets.UTF_8), 7L, code)).isNotEqualTo(h);
        }

        @Test
        @DisplayName("0/1/8 gõ nhầm được đổi thành O/I/B (bảng Base32 không có các số đó)")
        void normalizesLookalikes() {
            assertThat(RecoveryCodes.normalize("0O1I8-B2345")).isEqualTo("OOIIBB2345");
        }

        @Test
        @DisplayName("sai độ dài / ký tự lạ → null (không băm)")
        void rejectsInvalid() {
            byte[] pepper = new byte[]{1};
            assertThat(RecoveryCodes.hash(pepper, 1L, "ABCDE")).isNull();
            assertThat(RecoveryCodes.hash(pepper, 1L, "ABCDE-FGHI!")).isNull();
            assertThat(RecoveryCodes.hash(pepper, 1L, null)).isNull();
        }
    }

    @Nested
    @DisplayName("MfaKeyMaterial")
    class KeyMaterialTest {

        @Test
        @DisplayName("thiếu khoá: không ném lúc dựng (backend vẫn boot), mọi thao tác → 503 MFA_NOT_CONFIGURED")
        void missingKeyFailsClosed() {
            MfaKeyMaterial km = new MfaKeyMaterial("", "k1", "");
            assertThat(km.isConfigured()).isFalse();
            assertThatThrownBy(km::cipher).isInstanceOf(MfaException.class)
                    .extracting(e -> ((MfaException) e).getCode()).isEqualTo(MfaException.MFA_NOT_CONFIGURED);
        }

        @Test
        @DisplayName("khoá không phải 32 byte → coi như thiếu")
        void wrongLengthKey() {
            String b64 = Base64.getEncoder().encodeToString(new byte[16]);
            assertThat(new MfaKeyMaterial(b64, "k1", "").isConfigured()).isFalse();
            assertThat(new MfaKeyMaterial("not-base64!!", "k1", "").isConfigured()).isFalse();
        }

        @Test
        @DisplayName("thiếu MFA_RECOVERY_PEPPER: pepper dẫn xuất từ khoá, khác khoá và khác pepper mã email")
        void derivedPeppers() {
            byte[] key = randomKey();
            MfaKeyMaterial km = new MfaKeyMaterial(Base64.getEncoder().encodeToString(key), "k1", "");
            assertThat(km.isConfigured()).isTrue();
            assertThat(km.recoveryPepper()).isNotEqualTo(key).hasSize(32);
            assertThat(km.recoveryPepper()).isNotEqualTo(km.emailCodePepper());
            MfaKeyMaterial explicit = new MfaKeyMaterial(Base64.getEncoder().encodeToString(key), "k1", "my-pepper");
            assertThat(explicit.recoveryPepper()).isEqualTo("my-pepper".getBytes(StandardCharsets.UTF_8));
        }
    }

    @Test
    @DisplayName("otpauth URI: issuer DeutschFlow, nhãn là email, tham số chuẩn")
    void otpauthUri() {
        String uri = MfaService.otpauthUri("a+b@x.com", "JBSWY3DPEHPK3PXP");
        assertThat(uri).isEqualTo("otpauth://totp/DeutschFlow:a%2Bb%40x.com?secret=JBSWY3DPEHPK3PXP"
                + "&issuer=DeutschFlow&algorithm=SHA1&digits=6&period=30");
    }

    @Test
    @DisplayName("gợi ý email che phần giữa")
    void emailHint() {
        assertThat(MfaService.emailHint("owner@deutschflow.app")).isEqualTo("o***@deutschflow.app");
        assertThat(MfaService.emailHint("bad")).isEqualTo("***");
    }
}
