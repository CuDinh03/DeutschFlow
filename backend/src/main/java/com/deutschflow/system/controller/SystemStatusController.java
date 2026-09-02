package com.deutschflow.system.controller;

import com.deutschflow.system.dto.SystemStatusResponse;
import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.service.MaintenanceStateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Trạng thái hệ thống công khai — nguồn duy nhất cho banner đếm ngược + màn bảo trì
 * của web và mobile. Nằm dưới {@code /api/public/**}: permitAll sẵn (SecurityConfig)
 * VÀ được {@code PublicApiRateLimitFilter} gác 30 req/phút/IP sẵn — không thêm bề mặt
 * cấu hình mới. Đọc từ cache RAM của {@link MaintenanceStateService} (không chạm DB
 * mỗi request) nên chịu được cả nghìn client poll 30s lúc chờ hết bảo trì.
 *
 * <p>{@code Cache-Control: no-store}: không để CDN/proxy giữ bản cũ làm client kẹt
 * trạng thái bảo trì sau khi đã tắt (nếu cần giảm tải sau này, hạ xuống max-age=15).
 */
@RestController
@RequestMapping("/api/public/system")
@RequiredArgsConstructor
public class SystemStatusController {

    private final MaintenanceStateService maintenanceStateService;

    @GetMapping("/status")
    public ResponseEntity<SystemStatusResponse> status() {
        MaintenanceWindow active = maintenanceStateService.activeWindow().orElse(null);
        MaintenanceWindow upcoming = maintenanceStateService.upcomingWindow().orElse(null);

        boolean blocking = active != null && active.getMode() == MaintenanceWindow.Mode.FULL;
        var body = new SystemStatusResponse(
                blocking ? "MAINTENANCE" : "OK",
                Instant.now(),
                SystemStatusResponse.MaintenanceWindowPublicDto.from(active),
                SystemStatusResponse.MaintenanceWindowPublicDto.from(upcoming));

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(body);
    }
}
