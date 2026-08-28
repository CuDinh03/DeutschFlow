package com.deutschflow.common.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Xác định IP thật của client khi ứng dụng đứng sau reverse proxy (ALB/CloudFront/nginx).
 *
 * <p>Chống giả mạo bằng cách đếm ngược từ CUỐI chuỗi {@code X-Forwarded-For}: client
 * tự thêm header thì phần nó bịa nằm ở ĐẦU chuỗi, còn proxy tin cậy luôn nối IP thật
 * vào cuối. Lấy phần tử đầu (như nhiều ví dụ trên mạng) là để client tự khai IP —
 * tức là rate-limit theo IP bị vô hiệu hoàn toàn.
 *
 * <p>Tách ra thành component dùng chung thay vì để mỗi controller một bản sao: logic
 * chống giả mạo mà tồn tại hai bản thì sớm muộn chỉ một bản được vá.
 */
@Component
public class ClientIpResolver {

    private final int trustedProxyCount;

    public ClientIpResolver(@Value("${app.security.trusted-proxy-count:1}") int trustedProxyCount) {
        this.trustedProxyCount = trustedProxyCount;
    }

    /**
     * <p>X-Forwarded-For được nối trái→phải khi request đi qua từng proxy, nên token
     * TRÁI NHẤT là giá trị do client tự khai — kẻ tấn công bịa thoải mái để xoay IP
     * giả và né rate-limit. Chỉ các mục PHẢI NHẤT mới do proxy của ta nối vào. Vì
     * vậy đọc mục ở vị trí {@code (length - trustedProxyCount)} — chặng mà proxy
     * ngoài cùng của ta thật sự quan sát được. {@code trustedProxyCount=0} bỏ qua
     * XFF hoàn toàn và dùng địa chỉ socket (đúng khi app được gọi trực tiếp).
     */
    public String resolve(HttpServletRequest request) {
        if (request == null) return "";
        if (trustedProxyCount > 0) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] parts = forwarded.split(",");
                int idx = parts.length - trustedProxyCount;
                if (idx < 0) idx = 0;
                String ip = parts[idx].trim();
                if (!ip.isBlank()) return ip;
            }
        }
        return request.getRemoteAddr();
    }
}
