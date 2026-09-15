package com.deutschflow.common.retention;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.minor.MinorPolicy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Dọn BẢN GHI ÂM của học viên chưa thành niên sau {@code app.minor.audio-retention-days} ngày
 * (owner chốt 09/09/2026: giữ 30 ngày; bản chuyển chữ và điểm giữ lâu dài theo hồ sơ học tập).
 *
 * <h2>Vì sao ở {@code common.retention} chứ không {@code common.minor}</h2>
 * Phần khó của job này KHÔNG phải "xoá dòng cũ" mà là ba việc chạm vào ba gói khác nhau:
 * {@code common.minor} (phân loại tuổi), {@code examspeaking} (purge audio thi nói) và
 * {@code media}/{@code teacher} (file bài nộp). Đặt ở {@code common.minor} sẽ tạo VÒNG PHỤ THUỘC
 * NGƯỢC ở tầng gói: {@code examspeaking} đã gọi {@code MinorGate} của {@code common.minor}, nên
 * {@code common.minor} gọi ngược {@code ExamGoldenService} là khoá hai gói vào nhau. Còn
 * {@code common.retention} thì chưa ai phụ thuộc vào — nó là điểm cuối của đồ thị, đúng chỗ cho một
 * job nền cần kéo nhiều gói lại. Cộng thêm: đây đã là nhà của họ job dọn đêm
 * ({@code DataRetentionJob} 03:30, {@code UserNotificationRetentionJob} 04:00), dùng chung quy ước
 * cron/ShedLock/zone.
 *
 * <h2>Chế độ ĐẾM (dry-run) — mặc định BẬT</h2>
 * Đây là job xoá KHÔNG HOÀN LẠI trên ba kho mà chưa kho nào từng bị dọn tự động. Mặc định
 * {@code app.minor.audio-retention.dry-run: true} nghĩa là lần deploy đầu tiên job chạy đủ mọi bước
 * — nạp ứng viên, phân loại, kiểm chốt an toàn của khoá S3, ghi vết — nhưng KHÔNG xoá gì. Owner đọc
 * con số của một đêm thật rồi mới lật cờ.
 *
 * <p>Mặc định ngược lại (xoá ngay khi merge) sẽ đánh cược rằng câu SQL nạp ứng viên và luật so tuổi
 * đều đúng ngay lần đầu, trên dữ liệu production mà chưa ai nhìn thấy — và cái giá của việc sai là
 * bản ghi âm không lấy lại được. Cờ này chỉ tốn một đêm.
 *
 * <h2>Khoảng mù phải kêu thành tiếng</h2>
 * Chủ thể {@code UNKNOWN} (chưa khai ngày sinh) KHÔNG bị dọn — xem {@link MinorAudioRetentionPlanner}.
 * Nhưng số lượng đó được {@code log.warn} mỗi lượt chạy và vào metadata của vết: nó là phần dữ liệu
 * mà job này KHÔNG bảo vệ được, và nó co lại đúng bằng nhịp trung tâm nhập ngày sinh.
 */
@Slf4j
@Service
public class MinorAudioRetentionService {

    /** Vết của lượt xoá thật. */
    static final String EVENT_PURGED = "minor.audio.retention.purged";
    /** Vết của lượt chỉ ĐẾM — cố ý khác tên để không ai đọc nhầm bản xem trước thành việc đã làm. */
    static final String EVENT_PREVIEWED = "minor.audio.retention.previewed";

    static final String TARGET_TYPE = "MINOR_AUDIO_RETENTION";

    /** Job nền, không phải người. Để trống cả ba trường actor thì sổ đọc ra như một dòng khuyết. */
    private static final String ACTOR_ROLE_SYSTEM = "SYSTEM";

    private final MinorAudioRetentionCandidates candidates;
    private final MinorAudioRetentionPurger purger;
    private final MinorAudioOrgSnapshotResolver orgResolver;
    private final AuditLogService auditLogService;
    private final MinorAudioRetentionPlanner planner;
    private final boolean dryRun;
    private final int maxObjectsPerRun;

    public MinorAudioRetentionService(
            MinorAudioRetentionCandidates candidates,
            MinorAudioRetentionPurger purger,
            MinorAudioOrgSnapshotResolver orgResolver,
            AuditLogService auditLogService,
            MinorPolicy minorPolicy,
            @Value("${app.minor.audio-retention-days:30}") int retentionDays,
            @Value("${app.minor.audio-retention.dry-run:true}") boolean dryRun,
            @Value("${app.minor.audio-retention.max-objects-per-run:500}") int maxObjectsPerRun) {
        this.candidates = candidates;
        this.purger = purger;
        this.orgResolver = orgResolver;
        this.auditLogService = auditLogService;
        this.planner = new MinorAudioRetentionPlanner(minorPolicy, retentionDays);
        this.dryRun = dryRun;
        this.maxObjectsPerRun = Math.max(1, maxObjectsPerRun);
        log.info("[MinorAudioRetention] hạn lưu {} ngày · chế độ {} · trần {} đối tượng mỗi kho mỗi lượt",
                retentionDays, dryRun ? "ĐẾM (không xoá)" : "XOÁ THẬT", this.maxObjectsPerRun);
    }

    /**
     * Một lượt dọn. {@code now} là tham số để ca test ghim được mốc thời gian (bẫy đã ghi trong repo:
     * "test ngày cứng + now() tự đỏ theo lịch").
     */
    public MinorAudioPurgeTally purgeOnce(Instant now) {
        Instant cutoff = planner.cutoff(now);

        List<MinorAudioCandidate> all = new ArrayList<>();
        all.addAll(loadCapped(candidates.examSpeaking(cutoff, maxObjectsPerRun),
                MinorAudioCandidate.Store.EXAM_SPEAKING_GOLDEN));
        all.addAll(loadCapped(candidates.assignmentUploads(cutoff, maxObjectsPerRun),
                MinorAudioCandidate.Store.ASSIGNMENT_UPLOAD));
        all.addAll(loadCapped(candidates.aiJobPayloads(cutoff, maxObjectsPerRun),
                MinorAudioCandidate.Store.AI_JOB_PAYLOAD));

        MinorAudioRetentionPlanner.Plan plan = planner.plan(all, now);
        MinorAudioOrgSnapshotResolver.Session orgs = orgResolver.newSession();
        Map<Long, MinorAudioPurgeTally> byOrg = new LinkedHashMap<>();

        // ai_jobs gom theo trung tâm rồi bóc bằng MỘT câu cho mỗi nhóm — không phải mỗi dòng một câu.
        Map<Long, List<Long>> aiJobIdsByOrg = new HashMap<>();

        for (MinorAudioCandidate c : plan.due()) {
            Long org = orgs.orgOf(c);
            switch (c.store()) {
                case EXAM_SPEAKING_GOLDEN -> add(byOrg, org, purger.purgeExamSpeakingSession(c, dryRun));
                case ASSIGNMENT_UPLOAD -> add(byOrg, org, purger.purgeAssignmentUpload(c, dryRun));
                case AI_JOB_PAYLOAD ->
                        aiJobIdsByOrg.computeIfAbsent(org, k -> new ArrayList<>()).add(c.rowId());
            }
        }
        aiJobIdsByOrg.forEach((org, ids) -> add(byOrg, org, purger.purgeAiJobPayloads(ids, dryRun)));

        for (MinorAudioCandidate c : plan.unclassified()) {
            add(byOrg, orgs.orgOf(c), MinorAudioPurgeTally.ofUnclassified(1));
        }

        MinorAudioPurgeTally total = byOrg.values().stream()
                .reduce(MinorAudioPurgeTally.EMPTY, MinorAudioPurgeTally::plus);

        writeLedger(byOrg, cutoff);
        report(plan, total, cutoff);
        return total;
    }

    /** Trần áp cho TỪNG kho — xem javadoc {@link MinorAudioRetentionCandidates}. */
    private List<MinorAudioCandidate> loadCapped(List<MinorAudioCandidate> loaded, MinorAudioCandidate.Store store) {
        if (loaded.size() >= maxObjectsPerRun) {
            log.warn("[MinorAudioRetention] kho {} chạm trần {} đối tượng — còn tồn đọng, lượt sau chạy tiếp",
                    store, maxObjectsPerRun);
        }
        return loaded;
    }

    /**
     * Một vết cho MỖI TRUNG TÂM có chuyện xảy ra.
     *
     * <p>{@code touchedOrgId} truyền TƯỜNG MINH (DEC-13). Job không có actor nên đường lùi
     * {@code users.org_id của actor} sẽ cho NULL, mà đường đọc của giám đốc lọc {@code AND org_id = ?}
     * — không truyền là lượt dọn vô hình với đúng người phải thấy nó.
     *
     * <p>⛔ Metadata chỉ có SỐ LƯỢNG. Không id học viên, không khoá S3, không ngày sinh, không
     * transcript — {@link MinorAudioPurgeTally#toMetadata()} là nơi duy nhất dựng nội dung này.
     */
    private void writeLedger(Map<Long, MinorAudioPurgeTally> byOrg, Instant cutoff) {
        String event = dryRun ? EVENT_PREVIEWED : EVENT_PURGED;
        byOrg.forEach((orgId, tally) -> {
            if (tally.isSilent()) {
                return;
            }
            Map<String, Object> metadata = tally.toMetadata();
            metadata.put("dryRun", dryRun);
            metadata.put("retentionDays", planner.retentionDays());
            metadata.put("cutoff", cutoff.toString());
            try {
                auditLogService.log(event, null, null, ACTOR_ROLE_SYSTEM, TARGET_TYPE,
                        orgId == null ? null : String.valueOf(orgId), orgId, metadata);
            } catch (RuntimeException e) {
                // Vết hỏng không được nuốt lượt dọn đã làm xong — nhưng cũng không được im lặng.
                log.warn("[MinorAudioRetention] không ghi được vết cho trung tâm {}: {}", orgId, e.getMessage());
            }
        });
    }

    private void report(MinorAudioRetentionPlanner.Plan plan, MinorAudioPurgeTally total, Instant cutoff) {
        if (plan.unclassifiedCount() > 0) {
            // KHOẢNG MÙ. Không phải lỗi, nhưng phải kêu thành tiếng mỗi lượt: đây là số bản ghi âm mà
            // job không dám đụng vì chưa biết chủ thể bao nhiêu tuổi. Con số này co lại khi trung tâm
            // nhập đủ ngày sinh; im lặng thì không ai biết nó đang lớn hay nhỏ.
            log.warn("[MinorAudioRetention] {} bản ghi quá hạn KHÔNG phân loại được (chủ thể chưa khai ngày sinh) "
                            + "— giữ nguyên, không xoá. Trung tâm nhập đủ ngày sinh thì con số này giảm.",
                    plan.unclassifiedCount());
        }
        if (total.skippedUnsafeKey() > 0) {
            log.warn("[MinorAudioRetention] {} dòng bài nộp có khoá S3 KHÔNG khớp chủ sở hữu — đã bỏ qua, "
                    + "cần soi bằng tay", total.skippedUnsafeKey());
        }
        if (total.touchedRows() == 0 && plan.unclassifiedCount() == 0) {
            log.debug("[MinorAudioRetention] không có gì quá hạn (mốc {})", cutoff);
            return;
        }
        log.info("[MinorAudioRetention] {} — mốc {} · phiên thi {} · file bài nộp {} · payload ai_jobs {} · "
                        + "object S3 xoá {} (thất bại {}) · giữ vì đủ tuổi {} · không phân loại được {}",
                dryRun ? "CHẾ ĐỘ ĐẾM (chưa xoá gì)" : "đã dọn",
                cutoff, total.sessions(), total.assignmentFiles(), total.aiJobPayloads(),
                total.objectsDeleted(), total.objectsFailed(), plan.keptAdult(), plan.unclassifiedCount());
    }

    private static void add(Map<Long, MinorAudioPurgeTally> byOrg, Long orgId, MinorAudioPurgeTally delta) {
        byOrg.merge(orgId, delta, MinorAudioPurgeTally::plus);
    }
}
