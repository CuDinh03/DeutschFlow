package com.deutschflow.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Phân giải IP client an toàn sau proxy, dùng cho rate-limit/abuse.
 *
 * <p>X-Forwarded-For được nối trái→phải khi request đi qua các proxy, nên token TRÁI NHẤT là giá
 * trị client tự khai — kẻ tấn công có thể giả mạo để xoay IP né rate-limit. Chỉ các entry phải nhất
 * mới do proxy tin cậy của ta thêm vào. Vì vậy đọc entry tại {@code (length - trustedProxyCount)} —
 * hop mà proxy tin cậy ngoài cùng thực sự thấy. {@code trustedProxyCount=0} bỏ qua XFF, dùng địa chỉ
 * socket (đúng khi app được gọi trực tiếp, không qua proxy).
 */
@Component
public class ClientIpResolver {

    private final int trustedProxyCount;

    public ClientIpResolver(@Value("${app.security.trusted-proxy-count:1}") int trustedProxyCount) {
        this.trustedProxyCount = trustedProxyCount;
    }

    public String resolve(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        if (trustedProxyCount > 0) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] parts = forwarded.split(",");
                int idx = parts.length - trustedProxyCount;
                if (idx < 0) idx = 0;
                String ip = parts[idx].trim();
                if (!ip.isBlank()) {
                    return ip;
                }
            }
        }
        return request.getRemoteAddr();
    }
}
