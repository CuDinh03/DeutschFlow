package com.deutschflow.system.service;

import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.repository.MaintenanceWindowRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Cache in-memory trạng thái bảo trì — lớp đọc DUY NHẤT mà filter/status endpoint
 * đụng tới trên đường nóng. Mỗi node tự refresh (KHÔNG ShedLock — cache per-node
 * là chủ đích, xem javadoc ShedLockConfig về nhóm job cố ý không khoá); mặc định
 * 15s ⇒ thao tác admin có hiệu lực trên node khác trễ tối đa 15s, node xử lý
 * request admin thì {@link #refreshNow()} ngay.
 *
 * <p>Fail-open có chủ đích: DB lỗi lúc refresh → GIỮ snapshot cũ (log warn), không
 * bao giờ để lỗi hạ tầng phụ tự bật/tắt chặn người dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MaintenanceStateService {

    /** Lịch SCHEDULED xa nhất còn coi là "sắp tới" trong payload status. */
    private static final int UPCOMING_HORIZON_DAYS = 7;

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DISPLAY_FORMAT = DateTimeFormatter.ofPattern("HH:mm 'ngày' dd/MM");

    public record Snapshot(MaintenanceWindow active, MaintenanceWindow upcoming) {}

    private final MaintenanceWindowRepository repository;
    private final MeterRegistry meterRegistry;

    private final AtomicReference<Snapshot> snapshot = new AtomicReference<>();

    @PostConstruct
    void registerGauge() {
        // 1 = đang có window ACTIVE mode FULL (đang chặn). Alert rule đọc metric này
        // (DeutschFlow-deploy/docker/prometheus/alert.rules.yml).
        Gauge.builder("deutschflow_maintenance_active", snapshot, ref -> {
                    Snapshot s = ref.get();
                    return s != null && s.active() != null
                            && s.active().getMode() == MaintenanceWindow.Mode.FULL ? 1.0 : 0.0;
                })
                .description("1 khi có cửa sổ bảo trì FULL đang ACTIVE (đang chặn API)")
                .register(meterRegistry);
    }

    @Scheduled(
            fixedDelayString = "${app.maintenance.state-refresh-ms:15000}",
            initialDelayString = "${app.maintenance.state-initial-delay-ms:2000}")
    public void refresh() {
        try {
            LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
            MaintenanceWindow active = repository
                    .findFirstByStatus(MaintenanceWindow.Status.ACTIVE)
                    .orElse(null);
            MaintenanceWindow upcoming = repository
                    .findFirstByStatusAndStartsAtLessThanEqualOrderByStartsAtAsc(
                            MaintenanceWindow.Status.SCHEDULED, now.plusDays(UPCOMING_HORIZON_DAYS))
                    .orElse(null);
            snapshot.set(new Snapshot(active, upcoming));
        } catch (Exception e) {
            // Giữ snapshot cũ — trạng thái bảo trì không được nhấp nháy theo sức khoẻ DB.
            log.warn("[MaintenanceState] refresh thất bại — giữ snapshot cũ: {}", e.getMessage());
        }
    }

    /**
     * Gọi sau mỗi mutation admin để node hiện tại áp dụng tức thì. Trong transaction
     * thì hoãn tới afterCommit — snapshot không bao giờ giữ dữ liệu chưa commit
     * (rollback giữa chừng không làm cả node chặn/mở nhầm 15 giây).
     */
    public void refreshNow() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    refresh();
                }
            });
        } else {
            refresh();
        }
    }

    /** Window ACTIVE bất kỳ mode nào (payload status). */
    public Optional<MaintenanceWindow> activeWindow() {
        return Optional.ofNullable(ensure().active());
    }

    /** Window ACTIVE mode FULL — điều kiện chặn của {@code MaintenanceModeFilter}. */
    public Optional<MaintenanceWindow> activeFullWindow() {
        return activeWindow().filter(w -> w.getMode() == MaintenanceWindow.Mode.FULL);
    }

    /** Lịch SCHEDULED gần nhất trong {@value #UPCOMING_HORIZON_DAYS} ngày tới. */
    public Optional<MaintenanceWindow> upcomingWindow() {
        return Optional.ofNullable(ensure().upcoming());
    }

    private Snapshot ensure() {
        Snapshot s = snapshot.get();
        if (s != null) {
            return s;
        }
        // Request đến trước lần refresh đầu (boot) — nạp lazy một lần; lỗi thì coi như
        // không bảo trì (fail-open, nhất quán với refresh()).
        synchronized (this) {
            s = snapshot.get();
            if (s == null) {
                refresh();
                s = snapshot.get();
            }
        }
        return s != null ? s : new Snapshot(null, null);
    }

    /** {@code 2026-09-10T16:30 UTC → "23:30 ngày 10/09"} (giờ Việt Nam, cho copy thông báo/detail 503). */
    public static String displayVn(LocalDateTime utc) {
        if (utc == null) {
            return "";
        }
        return utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(VN_ZONE).format(DISPLAY_FORMAT);
    }
}
