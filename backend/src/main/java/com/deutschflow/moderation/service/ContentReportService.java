package com.deutschflow.moderation.service;

import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.moderation.dto.ModerationDtos.ReportDto;
import com.deutschflow.moderation.dto.ModerationDtos.ReportRequest;
import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.entity.ContentReport.Context;
import com.deutschflow.moderation.entity.ContentReport.Status;
import com.deutschflow.moderation.repository.ContentReportRepository;
import com.deutschflow.moderation.service.ModerationRateLimiterService.Decision;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * User-filed content/user reports (Apple Guideline 1.2), triaged by admins. The reported text is
 * snapshotted so moderation can review it even if the message is later deleted.
 *
 * <p>Đường nộp báo cáo (owner chốt 10/09/2026, B2 + quyết định 3) đi đúng bốn bước, theo thứ tự:
 * <ol>
 *   <li><b>ngữ cảnh</b> — 400/404 như cũ, KHÔNG tính vào throttle (kẻ dò ID không được "mua" slot);</li>
 *   <li><b>khử trùng</b> — đã có báo cáo PENDING cùng khoá (người nộp, ngữ cảnh, đối tượng) thì trả
 *       id cũ, không tạo dòng, không tính vào throttle: bấm hai lần vì mạng chậm không phải lạm dụng;</li>
 *   <li><b>throttle</b> — 10/giờ + 30/ngày theo người; quá ⇒ 429 có {@code Retry-After};</li>
 *   <li><b>ghi</b> — kèm {@code orgId} ĐÓNG BĂNG của người bị tố cáo, trong transaction RIÊNG.</li>
 * </ol>
 *
 * <p><b>Ca đua (review 10/09):</b> bước 2 là "tra rồi mới ghi", nên hai POST đồng thời cùng khoá đều
 * tra trượt. Chốt cuối là ba unique partial index {@code uq_content_reports_pending_*} (V321): dòng
 * thứ hai vấp {@link DataIntegrityViolationException}, service tra lại và trả id dòng thắng cuộc với
 * {@code duplicate = true} — client thấy y hệt ca tra-trước, và lượt throttle vừa cấp được trả lại
 * ({@link ModerationRateLimiterService#refund}) vì lần trùng không "mua" slot nào. Câu INSERT chạy
 * trong transaction REQUIRES_NEW: cùng transaction thì Postgres đã đánh dấu aborted sau vi phạm, mọi
 * SELECT tra lại đều bị từ chối và EntityManager cũng không còn tin được. Giá phải trả: hai connection
 * trong vài mili-giây cho mỗi báo cáo — đường này throttle 10/giờ theo người, pool 30, chấp nhận được.
 */
@Slf4j
@Service
public class ContentReportService {

    private final ContentReportRepository reportRepository;
    private final MessageRepository messageRepository;
    private final ClassChannelMessageRepository classChannelMessageRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final AuditOrgResolver orgResolver;
    private final ModerationRateLimiterService rateLimiter;
    /** Transaction RIÊNG (REQUIRES_NEW) cho câu INSERT — xem {@link #report}. */
    private final TransactionTemplate insertTx;

    public ContentReportService(ContentReportRepository reportRepository,
                                MessageRepository messageRepository,
                                ClassChannelMessageRepository classChannelMessageRepository,
                                ClassStudentRepository classStudentRepository,
                                ClassTeacherRepository classTeacherRepository,
                                AuditOrgResolver orgResolver,
                                ModerationRateLimiterService rateLimiter,
                                PlatformTransactionManager transactionManager) {
        this.reportRepository = reportRepository;
        this.messageRepository = messageRepository;
        this.classChannelMessageRepository = classChannelMessageRepository;
        this.classStudentRepository = classStudentRepository;
        this.classTeacherRepository = classTeacherRepository;
        this.orgResolver = orgResolver;
        this.rateLimiter = rateLimiter;
        // TransactionTemplate tường minh thay vì @Transactional(REQUIRES_NEW) trên một method cùng bean:
        // gọi nội-bean là tự-gọi, proxy bỏ qua — cùng bẫy đã giết AiJobWorker.claimJobs và được
        // ExamGradingJobHandler ghi lại; khuôn này chép từ đó.
        this.insertTx = new TransactionTemplate(transactionManager);
        this.insertTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Kết quả nộp báo cáo: id (mới hoặc CŨ khi trùng) và cờ trùng. */
    public record ReportOutcome(Long id, boolean duplicate) {}

    /** Files a report by {@code reporterId}; idempotent on a pending duplicate (B2), kể cả khi đua. */
    @Transactional
    public ReportOutcome report(Long reporterId, ReportRequest req) {
        ContextResolution resolved = resolveContext(reporterId, req);

        Optional<ContentReport> pending = findPendingDuplicate(reporterId, req, resolved);
        if (pending.isPresent()) {
            log.info("[moderation] duplicate report by {} (context={}) → returning pending report {}",
                    reporterId, req.context(), pending.get().getId());
            return new ReportOutcome(pending.get().getId(), true);
        }

        Decision decision = rateLimiter.decide(reporterId);
        if (!decision.allowed()) {
            throw new RateLimitExceededException(
                    "Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.", decision.retryAfterSeconds());
        }

        ContentReport fresh = ContentReport.builder()
                .reporterId(reporterId)
                .reportedUserId(resolved.reportedUserId())
                .context(req.context())
                .messageId(req.messageId())
                .classMessageId(req.classMessageId())
                .reason(req.reason())
                .details(req.details())
                .snapshotBody(resolved.snapshotBody())
                .orgId(resolved.orgId())
                .status(Status.PENDING)
                .createdAt(Instant.now())
                .build();

        ContentReport saved;
        try {
            // saveAndFlush trong transaction con: vi phạm unique nổi lên NGAY TẠI ĐÂY (không đợi commit
            // của transaction ngoài), và chỉ transaction con bị huỷ — transaction ngoài còn nguyên để tra lại.
            saved = insertTx.execute(status -> reportRepository.saveAndFlush(fresh));
        } catch (DataIntegrityViolationException e) {
            // Chỉ MỘT cách đọc lỗi này là an toàn để hành động (cùng nguyên tắc CurriculumImportCommitService):
            // request song song cùng khoá đã thắng, dòng PENDING của nó đã commit và giờ tra thấy được.
            // Mọi vi phạm khác (FK, CHECK, cột quá dài) phải nổi lên đúng bản chất — cải trang thành
            // "trùng" là che một lỗi thật khỏi cả người dùng lẫn log.
            Optional<ContentReport> winner = findPendingDuplicate(reporterId, req, resolved);
            if (winner.isEmpty()) {
                log.error("[moderation] report by {} (context={}) failed on a data error unrelated to the "
                        + "pending-duplicate key", reporterId, req.context(), e);
                throw e;
            }
            // Thua cuộc đua với chính mình = bấm hai lần khi mạng chậm, không phải lạm dụng: lần trùng
            // không "mua" slot — trả lại lượt vừa cấp, cùng luật với nhánh tra-trước ở trên.
            rateLimiter.refund(reporterId, decision);
            log.info("[moderation] concurrent duplicate report by {} (context={}) lost the insert race → "
                    + "returning pending report {}", reporterId, req.context(), winner.get().getId());
            return new ReportOutcome(winner.get().getId(), true);
        }
        log.info("[moderation] report {} filed by {} (context={}, reason={}, org={})",
                saved.getId(), reporterId, req.context(), req.reason(), resolved.orgId());
        return new ReportOutcome(saved.getId(), false);
    }

    /** Admin: most recent reports (optionally filtered by status). */
    @Transactional(readOnly = true)
    public List<ReportDto> list(Status status) {
        List<ContentReport> reports = status == null
                ? reportRepository.findTop200ByOrderByCreatedAtDesc()
                : reportRepository.findTop200ByStatusOrderByCreatedAtDesc(status);
        return reports.stream().map(ReportDto::from).toList();
    }

    /** Admin: mark a report resolved or dismissed. */
    @Transactional
    public void resolve(Long adminId, Long reportId, Status status) {
        if (status == Status.PENDING) {
            throw new BadRequestException("Trạng thái phải là RESOLVED hoặc DISMISSED.");
        }
        ContentReport r = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy báo cáo."));
        r.setStatus(status);
        r.setResolvedAt(Instant.now());
        r.setResolvedBy(adminId);
        reportRepository.save(r);
    }

    /**
     * Khoá trùng theo ngữ cảnh: DM → {@code messageId}; tin lớp → {@code classMessageId}; người →
     * {@code reportedUserId}. Chỉ so với báo cáo còn PENDING: đã phán quyết rồi mà người dùng báo
     * lại thì đó là một sự việc mới, phải vào hàng đợi lần nữa. Cùng khoá với ba unique partial
     * index V321 ({@code uq_content_reports_pending_dm/class/user}) — hàm này vừa là bước tra-trước
     * vừa là bước tra-lại sau khi thua cuộc đua.
     */
    private Optional<ContentReport> findPendingDuplicate(Long reporterId, ReportRequest req,
                                                         ContextResolution resolved) {
        return switch (req.context()) {
            case DIRECT_MESSAGE -> reportRepository
                    .findFirstByReporterIdAndContextAndMessageIdAndStatusOrderByCreatedAtDesc(
                            reporterId, Context.DIRECT_MESSAGE, req.messageId(), Status.PENDING);
            case CLASS_MESSAGE -> reportRepository
                    .findFirstByReporterIdAndContextAndClassMessageIdAndStatusOrderByCreatedAtDesc(
                            reporterId, Context.CLASS_MESSAGE, req.classMessageId(), Status.PENDING);
            case USER -> reportRepository
                    .findFirstByReporterIdAndContextAndReportedUserIdAndStatusOrderByCreatedAtDesc(
                            reporterId, Context.USER, resolved.reportedUserId(), Status.PENDING);
        };
    }

    /**
     * Người bị tố cáo + bản chụp nội dung (null với USER) + trung tâm ĐÓNG BĂNG của người bị tố cáo.
     *
     * <p>{@code orgId} gán theo NGƯỜI BỊ TỐ CÁO (owner chốt 10/09/2026): tin lớp ⇒ trung tâm của
     * lớp; tin riêng / người ⇒ membership ACTIVE hiện tại của người đó, không có ⇒ null. Chụp một
     * lần lúc ghi và không bao giờ tính lại — 90 ngày sau người đó có thể đã rời trung tâm.
     */
    private record ContextResolution(Long reportedUserId, String snapshotBody, Long orgId) {}

    // Tên cũ là `resolve` — trùng tên với phán quyết của admin ở trên; đổi để hai việc không lẫn nhau.
    private ContextResolution resolveContext(Long reporterId, ReportRequest req) {
        return switch (req.context()) {
            case DIRECT_MESSAGE -> {
                if (req.messageId() == null) {
                    throw new BadRequestException("Thiếu messageId cho báo cáo tin nhắn.");
                }
                var m = messageRepository.findById(req.messageId())
                        .orElse(null);
                // Cùng lý do GAP-12b như nhánh CLASS_MESSAGE bên dưới: không xác nhận sự tồn tại
                // của một tin nhắn mà người gọi không có phần trong đó.
                if (m == null || (!reporterId.equals(m.getRecipientId()) && !reporterId.equals(m.getSenderId()))) {
                    throw new NotFoundException("Không tìm thấy tin nhắn.");
                }
                yield new ContextResolution(m.getSenderId(), m.getBody(), orgResolver.forActiveMember(m.getSenderId()));
            }
            case CLASS_MESSAGE -> {
                if (req.classMessageId() == null) {
                    throw new BadRequestException("Thiếu classMessageId cho báo cáo tin lớp.");
                }
                // Cùng phép kiểm thành viên với kênh lớp (ClassChannelService.assertMember): người
                // ngoài lớp không được report tin của lớp — report sao chép nội dung tin vào
                // snapshot, nên thiếu bước này là một đường đọc tin lớp khác bằng ID (GAP-12).
                //
                // GAP-12b: KHÔNG phân biệt "không tồn tại" với "tồn tại nhưng ngoài lớp". Ném lỗi
                // khác nhau cho hai ca đó biến endpoint thành máy dò ID: người ngoài quét ID tuần tự
                // sẽ biết ID nào có thật ở lớp khác. Cùng PR này đã chọn đúng nguyên tắc ấy cho
                // AsyncJobService (404 trước 403, không xác nhận sự tồn tại) — đây là chỗ còn sót.
                var m = classChannelMessageRepository.findById(req.classMessageId()).orElse(null);
                boolean member = m != null
                        && (classStudentRepository.existsByIdClassIdAndIdStudentId(m.getClassId(), reporterId)
                                || classTeacherRepository.existsByIdClassIdAndIdTeacherId(m.getClassId(), reporterId));
                if (!member) {
                    throw new NotFoundException("Không tìm thấy tin nhắn lớp.");
                }
                yield new ContextResolution(m.getSenderId(), m.getBody(), orgResolver.forClass(m.getClassId()));
            }
            case USER -> {
                if (req.targetUserId() == null) {
                    throw new BadRequestException("Thiếu targetUserId cho báo cáo người dùng.");
                }
                yield new ContextResolution(req.targetUserId(), null, orgResolver.forActiveMember(req.targetUserId()));
            }
        };
    }
}
