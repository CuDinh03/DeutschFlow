package com.deutschflow.examstudio;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Lỗi tải nguồn nói bằng lời thường: không lộ tên lớp lỗi, mã HTTP có kèm nghĩa (owner yêu cầu 13/11/2026). */
class SourceFetcherMessagesTest {

    @Test
    @DisplayName("lỗi kết nối: nói vì sao, không lộ tên lớp lỗi")
    void connectionReasons() {
        assertThat(SourceFetcher.connectionReason(new SocketTimeoutException("x"))).isEqualTo("trang phản hồi quá chậm");
        assertThat(SourceFetcher.connectionReason(new UnknownHostException("x"))).contains("không tìm thấy máy chủ", "kiểm tra lại đường dẫn");
        assertThat(SourceFetcher.connectionReason(new ConnectException("x"))).contains("từ chối kết nối");
        assertThat(SourceFetcher.connectionReason(new javax.net.ssl.SSLHandshakeException("x"))).contains("kết nối bảo mật");
        // Lỗi bọc nhiều lớp: lấy nguyên nhân gốc.
        assertThat(SourceFetcher.connectionReason(new RuntimeException(new IOException(new SocketTimeoutException("x")))))
                .isEqualTo("trang phản hồi quá chậm");
        for (Throwable t : List.of(new SocketTimeoutException("x"), new IOException("x"), new IllegalStateException("x"))) {
            assertThat(SourceFetcher.connectionReason(t)).doesNotContain("Exception").isNotBlank();
        }
    }

    @Test
    @DisplayName("mã HTTP khác 200: kèm nghĩa của mã và việc nên làm; luôn mở đầu bằng \"Trang\"")
    void statusReasons() {
        assertThat(SourceFetcher.statusReason(403)).isEqualTo("Trang từ chối cho máy tải bài (mã 403)");
        assertThat(SourceFetcher.statusReason(404)).contains("không còn ở đường dẫn này", "mã 404", "kiểm tra lại đường dẫn");
        assertThat(SourceFetcher.statusReason(429)).contains("thử lại sau vài phút");
        assertThat(SourceFetcher.statusReason(503)).contains("lỗi phía máy chủ", "mã 503", "thử lại sau");
        assertThat(SourceFetcher.statusReason(204)).contains("mã 204");
        for (int code : List.of(204, 401, 403, 404, 410, 429, 500, 503)) {
            assertThat(SourceFetcher.statusReason(code)).startsWith("Trang ");
        }
    }
}
