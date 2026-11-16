package com.deutschflow.feedback;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.feedback.service.FeedbackImageProcessor;
import com.deutschflow.feedback.service.FeedbackImageProcessor.Format;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Ảnh góp ý: nhận dạng theo byte đầu, chặn ảnh quá cỡ, mã hoá lại bỏ EXIF (BR-03, NFR-03)")
class FeedbackImageProcessorTest {

    @Test
    @DisplayName("PNG hợp lệ được mã hoá lại thành PNG cùng kích thước")
    void png_isReencoded() throws IOException {
        var out = FeedbackImageProcessor.process(encode(new BufferedImage(40, 30, BufferedImage.TYPE_INT_ARGB), "png"));

        assertThat(out.format()).isEqualTo(Format.PNG);
        assertThat(out.width()).isEqualTo(40);
        assertThat(out.height()).isEqualTo(30);
        assertThat(FeedbackImageProcessor.sniff(out.bytes())).isEqualTo(Format.PNG);
    }

    @Test
    @DisplayName("JPEG mang khối EXIF (có GPS) ra file mới không còn EXIF")
    void jpeg_exifIsStripped() throws IOException {
        byte[] withExif = insertExif(encode(new BufferedImage(20, 20, BufferedImage.TYPE_INT_RGB), "jpg"));
        assertThat(contains(withExif, "Exif")).isTrue();

        var out = FeedbackImageProcessor.process(withExif);

        assertThat(out.format()).isEqualTo(Format.JPEG);
        assertThat(contains(out.bytes(), "Exif")).isFalse();
        assertThat(contains(out.bytes(), "GPSLatitude")).isFalse();
    }

    @Test
    @DisplayName("File chữ đổi đuôi thành ảnh bị từ chối dù client khai image/png")
    void textFile_isRejected() {
        byte[] fake = "<script>alert(1)</script> not an image".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> FeedbackImageProcessor.process(fake))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("PNG, JPEG hoặc WebP");
    }

    @Test
    @DisplayName("HEIC (ftyp) không phải PNG/JPEG nên bị từ chối")
    void heic_isRejected() {
        byte[] heic = new byte[64];
        byte[] head = {0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'h', 'e', 'i', 'c'};
        System.arraycopy(head, 0, heic, 0, head.length);

        assertThatThrownBy(() -> FeedbackImageProcessor.process(heic)).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("PNG có byte đầu đúng nhưng thân hỏng bị từ chối")
    void truncatedPng_isRejected() throws IOException {
        byte[] png = encode(new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB), "png");
        byte[] cut = Arrays.copyOf(png, 20);

        assertThatThrownBy(() -> FeedbackImageProcessor.process(cut)).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("Cạnh dài hơn 8000 điểm ảnh bị từ chối trước khi giải mã")
    void tooWide_isRejected() throws IOException {
        byte[] wide = encode(new BufferedImage(8001, 1, BufferedImage.TYPE_BYTE_GRAY), "png");

        assertThatThrownBy(() -> FeedbackImageProcessor.process(wide))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("8000");
    }

    @Test
    @DisplayName("File trên 5 MB bị từ chối")
    void overFiveMegabytes_isRejected() {
        byte[] big = new byte[FeedbackImageProcessor.MAX_BYTES + 1];
        big[0] = (byte) 0x89;

        assertThatThrownBy(() -> FeedbackImageProcessor.process(big)).isInstanceOf(BadRequestException.class);
    }

    private static byte[] encode(BufferedImage image, String format) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    /** Chèn một đoạn APP1 "Exif" có chữ GPSLatitude ngay sau SOI — đủ để kiểm việc mã hoá lại bỏ nó. */
    private static byte[] insertExif(byte[] jpeg) {
        byte[] payload = "Exif\0\0GPSLatitude=21.0285".getBytes(StandardCharsets.ISO_8859_1);
        int len = payload.length + 2;
        byte[] out = new byte[jpeg.length + 4 + payload.length];
        out[0] = jpeg[0];
        out[1] = jpeg[1];
        out[2] = (byte) 0xFF;
        out[3] = (byte) 0xE1;
        out[4] = (byte) (len >> 8);
        out[5] = (byte) len;
        System.arraycopy(payload, 0, out, 6, payload.length);
        System.arraycopy(jpeg, 2, out, 6 + payload.length, jpeg.length - 2);
        return out;
    }

    private static boolean contains(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(needle);
    }
}
