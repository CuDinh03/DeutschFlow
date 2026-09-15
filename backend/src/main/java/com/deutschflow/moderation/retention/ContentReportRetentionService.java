package com.deutschflow.moderation.retention;

import com.deutschflow.common.audit.AuditLogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Hạn lưu NỘI DUNG báo cáo kiểm duyệt (owner chốt 10/09/2026, quyết định 5 + B4): <b>90 ngày sau
 * RESOLVED/DISMISSED</b>, xoá {@code snapshot_body} + {@code details}, GIỮ dòng, đóng dấu
 * {@code content_purged_at}. PENDING không bao giờ bị dọn — nhưng tồn đọng quá
 * {@value #PENDING_BACKLOG_DAYS} ngày thì {@code log.warn} mỗi lượt: hàng đợi không ai xử lý là
 * lỗi vận hành, không phải lỗi dữ liệu.
 *
 * <h2>Vì sao xoá nội dung mà giữ dòng</h2>
 * Dòng là bằng chứng "đã có báo cáo, ai phán quyết, lúc nào" (Apple Guideline 1.2 hỏi đúng câu đó);
 * nội dung là bản sao tin nhắn của NGƯỜI KHÁC, chỉ có lý do tồn tại chừng nào còn cần để xét. Xét
 * xong 90 ngày thì lý do hết. Cùng khuôn với {@code AccountDeletionService}: chủ thể xoá tài khoản
 * cũng ẩn danh nội dung mà giữ dòng.
 *
 * <h2>Chế độ ĐẾM (dry-run) — mặc định BẬT</h2>
 * Theo khuôn {@code MinorAudioRetentionService} (PR-1C): lần deploy đầu job chạy đủ mọi bước —
 * đếm ứng viên, đếm tồn đọng, ghi vết — nhưng KHÔNG UPDATE. Vết mang tên
 * {@value #EVENT_PREVIEWED} thay vì {@value #EVENT_PURGED} để không ai đọc nhầm bản xem trước thành
 * việc đã làm. Owner đọc con số một đêm thật rồi mới lật {@code app.moderation.retention.dry-run}.
 *
 * <h2>UPDATE theo lô</h2>
 * {@code ctid IN (SELECT ... LIMIT n)} — khuôn {@code DataRetentionJob}: mỗi câu là một transaction
 * ngắn, không khoá cả bảng, không phình WAL. Vị từ ứng viên khớp đúng partial index
 * {@code idx_content_reports_retention_due} (V321) nên phần đã dọn không bao giờ bị quét lại.
 *
 * <p>Vết ghi {@code org_id = NULL} — đây là job nền tảng, chạy trên mọi trung tâm cùng lúc; số liệu
 * theo từng trung tâm là việc của đợt mở sổ moderation cho giám đốc (B3, đợt sau).
 */
@Slf4j
@Service
public class ContentReportRetentionService {

    /** Vết của lượt xoá thật. */
    static final String EVENT_PURGED = "moderation.report.retention.purged";
    /** Vết của lượt chỉ ĐẾM — cố ý khác tên (xem javadoc lớp). */
    static final String EVENT_PREVIEWED = "moderation.report.retention.previewed";

    static final String TARGET_TYPE = "CONTENT_REPORT_RETENTION";
    static final int PENDING_BACKLOG_DAYS = 30;

    /** Job nền, không phải người. Để trống cả ba trường actor thì sổ đọc ra như một dòng khuyết. */
    private static final String ACTOR_ROLE_SYSTEM = "SYSTEM";

    /** Vị từ ứng viên — PHẢI khớp partial index idx_content_reports_retention_due (V321). */
    private static final String DUE_PREDICATE = " status IN ('RESOLVED', 'DISMISSED')"
            + " AND content_purged_at IS NULL"
            + " AND (snapshot_body IS NOT NULL OR details IS NOT NULL)"
            + " AND resolved_at < ?";

    /** Số đếm của một lượt — cho log, vết và ca test. */
    public record Tally(long candidates, long purged, long pendingBacklogOver30d, boolean dryRun, Instant cutoff) {}

    private final JdbcTemplate jdbc;
    private final AuditLogService auditLogService;
    private final int retentionDays;
    private final boolean dryRun;
    private final int batchSize;
    private final long maxRowsPerRun;

    public ContentReportRetentionService(
            JdbcTemplate jdbc,
            AuditLogService auditLogService,
            @Value("${app.moderation.retention.days:90}") int retentionDays,
            @Value("${app.moderation.retention.dry-run:true}") boolean dryRun,
            @Value("${app.moderation.retention.batch-size:500}") int batchSize,
            @Value("${app.moderation.retention.max-rows-per-run:5000}") long maxRowsPerRun) {
        this.jdbc = jdbc;
        this.auditLogService = auditLogService;
        this.retentionDays = Math.max(1, retentionDays);
        this.dryRun = dryRun;
        this.batchSize = Math.max(50, batchSize);
        this.maxRowsPerRun = Math.max(this.batchSize, maxRowsPerRun);
        log.info("[ContentReportRetention] hạn lưu {} ngày sau phán quyết · chế độ {} · lô {} · trần {} dòng/lượt",
                this.retentionDays, dryRun ? "ĐẾM (không dọn)" : "DỌN THẬT", this.batchSize, this.maxRowsPerRun);
    }

    /**
     * Một lượt dọn. {@code now} là tham số để ca test ghim được mốc thời gian (bẫy đã ghi trong repo:
     * "test ngày cứng + now() tự đỏ theo lịch").
     */
    public Tally purgeOnce(Instant now) {
        Instant cutoff = now.minus(retentionDays, ChronoUnit.DAYS);
        OffsetDateTime cutoffTs = cutoff.atOffset(ZoneOffset.UTC);

        long candidates = count("SELECT count(*) FROM content_reports WHERE" + DUE_PREDICATE, cutoffTs);
        long purged = dryRun ? 0L : purgeInBatches(cutoffTs, now.atOffset(ZoneOffset.UTC));
        long backlog = count(
                "SELECT count(*) FROM content_reports WHERE status = 'PENDING' AND created_at < ?",
                now.minus(PENDING_BACKLOG_DAYS, ChronoUnit.DAYS).atOffset(ZoneOffset.UTC));

        Tally tally = new Tally(candidates, purged, backlog, dryRun, cutoff);
        report(tally);
        writeLedger(tally);
        return tally;
    }

    /** UPDATE theo lô tới khi hết ứng viên hoặc chạm trần {@code max-rows-per-run}. */
    private long purgeInBatches(OffsetDateTime cutoff, OffsetDateTime purgedAt) {
        // batchSize là hằng cấu hình, không phải input người dùng — nối chuỗi ở đây là an toàn.
        String sql = "UPDATE content_reports SET snapshot_body = NULL, details = NULL, content_purged_at = ?"
                + " WHERE ctid IN (SELECT ctid FROM content_reports WHERE" + DUE_PREDICATE
                + " LIMIT " + batchSize + ")";
        long total = 0;
        int updated;
        do {
            updated = jdbc.update(sql, purgedAt, cutoff);
            total += updated;
        } while (updated == batchSize && total < maxRowsPerRun);
        if (total >= maxRowsPerRun) {
            log.warn("[ContentReportRetention] chạm trần {} dòng/lượt — còn tồn đọng, lượt sau dọn tiếp", maxRowsPerRun);
        }
        return total;
    }

    private long count(String sql, OffsetDateTime arg) {
        Long n = jdbc.queryForObject(sql, Long.class, arg);
        return n == null ? 0L : n;
    }

    private void report(Tally t) {
        if (t.pendingBacklogOver30d() > 0) {
            // B4: PENDING không bị dọn, nhưng tồn đọng là điều phải kêu thành tiếng mỗi lượt — im
            // lặng thì không ai biết hàng đợi kiểm duyệt đang bị bỏ rơi.
            log.warn("[ContentReportRetention] {} báo cáo PENDING tồn đọng quá {} ngày — chưa ai phán quyết, "
                    + "job KHÔNG dọn nhóm này; cần admin xử lý hàng đợi.", t.pendingBacklogOver30d(), PENDING_BACKLOG_DAYS);
        }
        if (t.candidates() == 0) {
            log.debug("[ContentReportRetention] không có nội dung quá hạn (mốc {})", t.cutoff());
            return;
        }
        log.info("[ContentReportRetention] {} — mốc {} · ứng viên {} · đã dọn nội dung {}",
                t.dryRun() ? "CHẾ ĐỘ ĐẾM (chưa dọn gì)" : "đã dọn", t.cutoff(), t.candidates(), t.purged());
    }

    /**
     * Một vết khi có gì để dọn (hoặc để xem trước). ⛔ Metadata chỉ có SỐ LƯỢNG — không id báo cáo,
     * không id người, không nội dung. {@code touchedOrgId} null: job nền tảng (xem javadoc lớp).
     */
    private void writeLedger(Tally t) {
        if (t.candidates() == 0) {
            return;
        }
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("candidates", t.candidates());
        metadata.put("purged", t.purged());
        metadata.put("pendingBacklogOver30d", t.pendingBacklogOver30d());
        metadata.put("dryRun", t.dryRun());
        metadata.put("retentionDays", retentionDays);
        metadata.put("cutoff", t.cutoff().toString());
        try {
            auditLogService.log(t.dryRun() ? EVENT_PREVIEWED : EVENT_PURGED,
                    null, null, ACTOR_ROLE_SYSTEM, TARGET_TYPE, null, null, metadata);
        } catch (RuntimeException e) {
            // Vết hỏng không được nuốt lượt dọn đã làm xong — nhưng cũng không được im lặng.
            log.warn("[ContentReportRetention] không ghi được vết: {}", e.getMessage());
        }
    }
}
