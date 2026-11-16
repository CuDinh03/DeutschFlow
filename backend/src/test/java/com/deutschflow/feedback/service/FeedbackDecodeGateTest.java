package com.deutschflow.feedback.service;

import com.deutschflow.common.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Cổng giải mã ảnh góp ý: trần số lượt cùng lúc và trần dung lượng sau khi mã hoá lại")
class FeedbackDecodeGateTest {

    @Test
    @DisplayName("Hết chỗ giải mã quá thời gian chờ → 503, và chỗ được trả lại sau mỗi lượt")
    void busy_returns503() throws IOException {
        FeedbackDecodeGate gate = new FeedbackDecodeGate(1, 0, 10_000_000);
        gate.permits().acquireUninterruptibly();

        assertThatThrownBy(() -> gate.decode(png(10, 10)))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("503");

        gate.permits().release();
        assertThat(gate.decode(png(10, 10)).width()).isEqualTo(10);
        assertThat(gate.permits().availablePermits()).isEqualTo(1);
    }

    @Test
    @DisplayName("Ảnh hỏng vẫn trả chỗ giải mã")
    void failure_releasesPermit() {
        FeedbackDecodeGate gate = new FeedbackDecodeGate(1, 0, 10_000_000);

        assertThatThrownBy(() -> gate.decode("not an image at all".getBytes())).isInstanceOf(BadRequestException.class);
        assertThat(gate.permits().availablePermits()).isEqualTo(1);
    }

    @Test
    @DisplayName("Ảnh sau khi mã hoá lại vượt trần dung lượng → 400")
    void oversizedOutput_isRejected() throws IOException {
        FeedbackDecodeGate gate = new FeedbackDecodeGate(2, 1000, 50);

        assertThatThrownBy(() -> gate.decode(png(40, 40))).isInstanceOf(BadRequestException.class);
    }

    private static byte[] png(int w, int h) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }
}
