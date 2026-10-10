package com.deutschflow.common.async;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Logic dọn job {@code async_jobs} bị bỏ rơi, TÁCH khỏi entry point @Scheduled của
 * {@link StaleAsyncJobExpirer} (cùng lý do với {@code StaleAiJobMaintenance}: IT gọi thẳng bean này,
 * không đi qua @SchedulerLock).
 *
 * <p>Vì sao cần: mọi loại job trong bảng này chạy TRONG BỘ NHỚ của tiến trình backend
 * ({@code CompletableFuture.runAsync} trên {@code aiExecutor}, hoặc {@code @Async} trên
 * {@code taskExecutor}). Restart/deploy cắt ngang giữa chừng, hoặc executor đầy từ chối nhận việc,
 * thì không ai quay lại ghi kết quả — job nằm PENDING/PROCESSING vĩnh viễn và client poll tới hết
 * kiên nhẫn. Ví dụ rõ nhất là {@code FINISH_EXAM} của thi thử.
 *
 * <p>Đo theo {@code updated_at} chứ không theo {@code created_at}: job chuyển PROCESSING lúc bắt đầu
 * chạy thì đồng hồ tính lại từ đó, nên thời gian chờ trong hàng và thời gian chạy được giới hạn
 * riêng. Deploy blue-green chạy hai bản song song ~1 phút nên KHÔNG thể dùng mốc "trước lúc boot".
 *
 * <p>Đánh FAILED một job thật ra vẫn đang chạy (vượt ngưỡng) không làm mất kết quả: khi nó xong,
 * {@link AsyncJobService#completeJob} ghi đè lại COMPLETED. Ngưỡng vì thế chỉ cần đủ rộng để không
 * báo lỗi sớm cho người đang chờ.
 */
@Component
@Slf4j
public class StaleAsyncJobMaintenance {

    /** Hiện thẳng cho người dùng (web đọc {@code errorMessage}) — tra cứu: WHERE error_message = hằng này. */
    public static final String EXPIRED_MESSAGE =
            "Hệ thống bị gián đoạn khi đang xử lý nên yêu cầu này đã dừng giữa chừng. Bạn hãy thử lại.";

    static final int MIN_STALE_MINUTES = 10;

    private static final String EXPIRE_SQL = """
        UPDATE async_jobs
        SET status = 'FAILED', error_message = ?, updated_at = NOW()
        WHERE status IN ('PENDING', 'PROCESSING')
          AND updated_at < NOW() - make_interval(mins => ?)
          AND %s
        RETURNING id
        """;

    private final JdbcTemplate jdbcTemplate;
    private final AsyncJobSseService sseService;
    private final boolean enabled;
    private final int staleMinutes;
    private final Map<String, Integer> staleMinutesByType;

    public StaleAsyncJobMaintenance(
            JdbcTemplate jdbcTemplate,
            AsyncJobSseService sseService,
            @Value("${app.async-jobs.expire-enabled:true}") boolean enabled,
            @Value("${app.async-jobs.stale-minutes:30}") int staleMinutes,
            @Value("${app.async-jobs.stale-minutes-by-type:CURRICULUM_IMPORT_PREVIEW=120,VIDEO_RENDER_VOCAB=120}")
            String staleMinutesByType) {
        this.jdbcTemplate = jdbcTemplate;
        this.sseService = sseService;
        this.enabled = enabled;
        this.staleMinutes = Math.max(MIN_STALE_MINUTES, staleMinutes);
        this.staleMinutesByType = parseOverrides(staleMinutesByType);
    }

    /**
     * Đánh FAILED mọi job PENDING/PROCESSING không được cập nhật quá ngưỡng của loại nó, rồi báo
     * qua SSE cho client đang nghe. Không mở transaction: mỗi UPDATE tự commit trước khi phát SSE,
     * để client nhận sự kiện xong GET lại job là đọc được FAILED.
     *
     * @return số job vừa bị đánh FAILED
     */
    public int expireStale() {
        if (!enabled) {
            return 0;
        }
        List<UUID> expired = new ArrayList<>();
        staleMinutesByType.forEach((type, minutes) ->
                expired.addAll(expire("job_type = ?", minutes, type)));
        expired.addAll(expire("NOT (job_type = ANY(?))", staleMinutes,
                staleMinutesByType.keySet().toArray(String[]::new)));

        expired.forEach(id -> sseService.failJob(id, EXPIRED_MESSAGE));
        if (!expired.isEmpty()) {
            log.warn("[StaleAsyncJobMaintenance] Đã đánh FAILED {} job async bị bỏ rơi (ngưỡng {}′, riêng {}): {}",
                    expired.size(), staleMinutes, staleMinutesByType, expired);
        }
        return expired.size();
    }

    private List<UUID> expire(String typeFilter, int minutes, Object typeParam) {
        return jdbcTemplate.query(con -> {
            PreparedStatement ps = con.prepareStatement(EXPIRE_SQL.formatted(typeFilter));
            ps.setString(1, EXPIRED_MESSAGE);
            ps.setInt(2, minutes);
            if (typeParam instanceof String[] types) {
                ps.setArray(3, con.createArrayOf("text", types));
            } else {
                ps.setString(3, (String) typeParam);
            }
            return ps;
        }, (rs, n) -> rs.getObject(1, UUID.class));
    }

    /**
     * {@code "LOAI_A=120,LOAI_B=90"} → map. Mục hỏng bị bỏ qua kèm cảnh báo — cấu hình sai không
     * được làm sập việc dọn của mọi loại còn lại. Ngưỡng dưới {@value #MIN_STALE_MINUTES}′ bị nâng lên sàn.
     */
    static Map<String, Integer> parseOverrides(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyMap();
        }
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String entry : raw.split(",")) {
            String[] kv = entry.split("=");
            if (kv.length != 2 || kv[0].isBlank()) {
                if (!entry.isBlank()) log.warn("[StaleAsyncJobMaintenance] Bỏ qua mục cấu hình hỏng '{}'", entry);
                continue;
            }
            try {
                int minutes = Integer.parseInt(kv[1].trim());
                out.put(kv[0].trim().toUpperCase(Locale.ROOT), Math.max(MIN_STALE_MINUTES, minutes));
            } catch (NumberFormatException e) {
                log.warn("[StaleAsyncJobMaintenance] Bỏ qua mục cấu hình hỏng '{}'", entry);
            }
        }
        return Collections.unmodifiableMap(out);
    }
}
