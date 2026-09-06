package com.deutschflow.moderation.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.moderation.dto.ModerationDtos.ReportDto;
import com.deutschflow.moderation.dto.ModerationDtos.ReportRequest;
import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.entity.ContentReport.Status;
import com.deutschflow.moderation.repository.ContentReportRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * User-filed content/user reports (Apple Guideline 1.2), triaged by admins. The reported text is
 * snapshotted so moderation can review it even if the message is later deleted.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ContentReportService {

    private final ContentReportRepository reportRepository;
    private final MessageRepository messageRepository;
    private final ClassChannelMessageRepository classChannelMessageRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassTeacherRepository classTeacherRepository;

    /** Files a report by {@code reporterId}. Returns the created report id. */
    @Transactional
    public Long report(Long reporterId, ReportRequest req) {
        ContextResolution resolved = resolve(reporterId, req);
        ContentReport saved = reportRepository.save(ContentReport.builder()
                .reporterId(reporterId)
                .reportedUserId(resolved.reportedUserId())
                .context(req.context())
                .messageId(req.messageId())
                .classMessageId(req.classMessageId())
                .reason(req.reason())
                .details(req.details())
                .snapshotBody(resolved.snapshotBody())
                .status(Status.PENDING)
                .createdAt(Instant.now())
                .build());
        log.info("[moderation] report {} filed by {} (context={}, reason={})",
                saved.getId(), reporterId, req.context(), req.reason());
        return saved.getId();
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

    /** Reported target user id + a snapshot of the reported text (null for USER reports). */
    private record ContextResolution(Long reportedUserId, String snapshotBody) {}

    // Resolves the reported target's user id + a snapshot of the reported text.
    private ContextResolution resolve(Long reporterId, ReportRequest req) {
        return switch (req.context()) {
            case DIRECT_MESSAGE -> {
                if (req.messageId() == null) {
                    throw new BadRequestException("Thiếu messageId cho báo cáo tin nhắn.");
                }
                var m = messageRepository.findById(req.messageId())
                        .orElseThrow(() -> new NotFoundException("Không tìm thấy tin nhắn."));
                if (!reporterId.equals(m.getRecipientId()) && !reporterId.equals(m.getSenderId())) {
                    throw new BadRequestException("Bạn không có quyền báo cáo tin nhắn này.");
                }
                yield new ContextResolution(m.getSenderId(), m.getBody());
            }
            case CLASS_MESSAGE -> {
                if (req.classMessageId() == null) {
                    throw new BadRequestException("Thiếu classMessageId cho báo cáo tin lớp.");
                }
                var m = classChannelMessageRepository.findById(req.classMessageId())
                        .orElseThrow(() -> new NotFoundException("Không tìm thấy tin nhắn lớp."));
                // Cùng phép kiểm thành viên với kênh lớp (ClassChannelService.assertMember): người
                // ngoài lớp không được report tin của lớp — report sao chép nội dung tin vào
                // snapshot, nên thiếu bước này là một đường đọc tin lớp khác bằng ID (GAP-12).
                boolean member = classStudentRepository.existsByIdClassIdAndIdStudentId(m.getClassId(), reporterId)
                        || classTeacherRepository.existsByIdClassIdAndIdTeacherId(m.getClassId(), reporterId);
                if (!member) {
                    throw new BadRequestException("Bạn không có quyền báo cáo tin nhắn này.");
                }
                yield new ContextResolution(m.getSenderId(), m.getBody());
            }
            case USER -> {
                if (req.targetUserId() == null) {
                    throw new BadRequestException("Thiếu targetUserId cho báo cáo người dùng.");
                }
                yield new ContextResolution(req.targetUserId(), null);
            }
        };
    }
}
