package com.deutschflow.feedback.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.feedback.FeedbackEnums.Area;
import com.deutschflow.feedback.FeedbackEnums.Audience;
import com.deutschflow.feedback.FeedbackEnums.Source;
import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.dto.FeedbackDtos.AttachmentUploaded;
import com.deutschflow.feedback.dto.FeedbackDtos.CreateFeedbackRequest;
import com.deutschflow.feedback.dto.FeedbackDtos.FormOptions;
import com.deutschflow.feedback.dto.FeedbackDtos.MyFeedbackDto;
import com.deutschflow.feedback.dto.FeedbackDtos.ReplyDto;
import com.deutschflow.feedback.dto.FeedbackDtos.TechInfo;
import com.deutschflow.feedback.entity.FeedbackAttachment;
import com.deutschflow.feedback.entity.FeedbackItem;
import com.deutschflow.feedback.entity.FeedbackReply;
import com.deutschflow.feedback.repository.FeedbackAttachmentRepository;
import com.deutschflow.feedback.repository.FeedbackItemRepository;
import com.deutschflow.feedback.repository.FeedbackReplyRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.moderation.service.ModerationRateLimiterService.Decision;
import com.deutschflow.user.entity.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Phía người gửi góp ý (đặc tả gopycapnhat, FBK-01…11, 13, 68). Mọi vai trò đăng nhập trừ ADMIN.
 *
 * <p>Thứ tự kiểm khi gửi (BR-05): quyền → chống trùng {@code clientRequestId} → hạn mức → ghi. Lượt trùng
 * không tiêu hạn mức, kể cả ca hai POST đua nhau (chỉ một dòng qua được chỉ mục duy nhất, lượt kia trả lại).
 */
@Slf4j
@Service
public class FeedbackService {

    static final int MIN_CONTENT = 10;
    static final int MAX_CONTENT = 2000;
    static final int TITLE_MAX = 80;
    static final int MAX_ATTACHMENTS = 3;
    static final String OBJECT_PREFIX = "feedback/";

    private final FeedbackItemRepository items;
    private final FeedbackAttachmentRepository attachments;
    private final FeedbackReplyRepository replies;
    private final FeedbackRateLimits limits;
    private final S3StorageService storage;
    private final FeedbackDecodeGate decodeGate;
    private final TransactionTemplate insertTx;

    public FeedbackService(FeedbackItemRepository items,
                           FeedbackAttachmentRepository attachments,
                           FeedbackReplyRepository replies,
                           FeedbackRateLimits limits,
                           S3StorageService storage,
                           FeedbackDecodeGate decodeGate,
                           PlatformTransactionManager transactionManager) {
        this.items = items;
        this.attachments = attachments;
        this.replies = replies;
        this.limits = limits;
        this.storage = storage;
        this.decodeGate = decodeGate;
        // Giao dịch tường minh thay vì @Transactional(REQUIRES_NEW) gọi trong cùng bean (tự-gọi bị proxy
        // bỏ qua) — cùng khuôn ContentReportService.
        this.insertTx = new TransactionTemplate(transactionManager);
        this.insertTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public FormOptions formOptions(User user) {
        Audience audience = audienceOf(user);
        return new FormOptions(audience, List.copyOf(Area.forAudience(audience)));
    }

    @Transactional(readOnly = true)
    public List<MyFeedbackDto> mine(User user) {
        audienceOf(user);
        List<FeedbackItem> list = items.findByUserIdOrderByCreatedAtDesc(user.getId());
        if (list.isEmpty()) return List.of();
        List<Long> ids = list.stream().map(FeedbackItem::getId).toList();
        Map<Long, List<ReplyDto>> repliesById = replies.findByFeedbackIdInOrderByCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(FeedbackReply::getFeedbackId, LinkedHashMap::new,
                        Collectors.mapping(FeedbackService::toReplyDto, Collectors.toList())));
        Map<Long, Long> attachmentCounts = attachments.findByFeedbackIdIn(ids).stream()
                .collect(Collectors.groupingBy(FeedbackAttachment::getFeedbackId, Collectors.counting()));
        return list.stream()
                .map(f -> toMine(f, repliesById.getOrDefault(f.getId(), List.of()),
                        attachmentCounts.getOrDefault(f.getId(), 0L).intValue()))
                .toList();
    }

    public MyFeedbackDto submit(User user, CreateFeedbackRequest req) {
        Audience audience = audienceOf(user);
        String content = normalizeContent(req.content());
        if (!Area.forAudience(audience).contains(req.area())) {
            throw new BadRequestException("Phần đã chọn không có trong danh sách.");
        }
        List<Long> attachmentIds = distinct(req.attachmentIds());
        if (attachmentIds.size() > MAX_ATTACHMENTS) {
            throw new BadRequestException("Chỉ đính kèm được 3 ảnh.");
        }
        String clientRequestId = blankToNull(req.clientRequestId());

        if (clientRequestId != null) {
            var existing = items.findByUserIdAndClientRequestId(user.getId(), clientRequestId);
            if (existing.isPresent()) return mineOf(existing.get());
        }

        Decision decision = limits.submit().decide(user.getId());
        if (!decision.allowed()) {
            int minutes = Math.max(1, (decision.retryAfterSeconds() + 59) / 60);
            throw new RateLimitExceededException(
                    "Bạn đã gửi nhiều góp ý trong giờ qua. Thử lại sau " + minutes + " phút.",
                    decision.retryAfterSeconds());
        }

        try {
            FeedbackItem saved = insertTx.execute(status -> insert(user, req, content, attachmentIds, clientRequestId));
            log.info("[feedback] user {} sent feedback {} ({} / {})", user.getId(), saved.getId(), saved.getType(),
                    saved.getArea());
            return mineOf(saved);
        } catch (DataIntegrityViolationException race) {
            // Hai POST cùng clientRequestId đua nhau: chỉ mục duy nhất chặn dòng thứ hai.
            limits.submit().refund(user.getId(), decision);
            if (clientRequestId != null) {
                var winner = items.findByUserIdAndClientRequestId(user.getId(), clientRequestId);
                if (winner.isPresent()) return mineOf(winner.get());
            }
            throw race;
        } catch (RuntimeException e) {
            // Đầu vào sai (ảnh không phải của mình…) không phải lạm dụng: trả lại lượt.
            limits.submit().refund(user.getId(), decision);
            throw e;
        }
    }

    public AttachmentUploaded upload(User user, MultipartFile file) {
        audienceOf(user);
        if (file == null || file.isEmpty() || file.getSize() > FeedbackImageProcessor.MAX_BYTES) {
            throw new BadRequestException(FeedbackImageProcessor.WRONG_TYPE);
        }
        Decision decision = limits.upload().decide(user.getId());
        if (!decision.allowed()) {
            throw new RateLimitExceededException(
                    "Bạn đã tải lên nhiều ảnh trong giờ qua. Thử lại sau.", decision.retryAfterSeconds());
        }
        byte[] raw;
        try {
            raw = file.getBytes();
        } catch (IOException e) {
            // Lỗi đọc phần tải lên (mạng đứt giữa chừng), không phải người dùng làm sai: trả lượt.
            limits.upload().refund(user.getId(), decision);
            throw new BadRequestException(FeedbackImageProcessor.WRONG_TYPE);
        }
        // Ảnh hỏng/giả KHÔNG được trả lượt: giải mã là việc tốn bộ nhớ, lượt hỏng vẫn phải tính vào hạn mức.
        FeedbackImageProcessor.Processed image = decodeGate.decode(raw);

        String key = OBJECT_PREFIX + UUID.randomUUID() + "." + image.format().extension();
        try {
            storage.uploadBytes(image.bytes(), key, image.format().contentType());
        } catch (RuntimeException e) {
            log.error("[feedback] upload to storage failed for user {}: {}", user.getId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Chưa tải được ảnh. Bạn vẫn gửi được góp ý không có ảnh.");
        }
        try {
            FeedbackAttachment row = attachments.save(FeedbackAttachment.builder()
                    .uploaderId(user.getId())
                    .objectKey(key)
                    .contentType(image.format().contentType())
                    .sizeBytes(image.bytes().length)
                    .width(image.width())
                    .height(image.height())
                    .createdAt(Instant.now())
                    .build());
            return new AttachmentUploaded(row.getId(), row.getWidth(), row.getHeight(), row.getSizeBytes());
        } catch (RuntimeException e) {
            deleteObjectQuietly(key);
            throw e;
        }
    }

    /** Gỡ một ảnh CHƯA gắn vào góp ý (nút "gỡ" trên form). Ảnh của người khác hay đã gắn: 404. */
    @Transactional
    public void deleteUnattached(User user, Long attachmentId) {
        audienceOf(user);
        FeedbackAttachment a = attachments.findById(attachmentId)
                .filter(x -> x.getUploaderId().equals(user.getId()) && x.getFeedbackId() == null)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy ảnh."));
        attachments.delete(a);
        // File xoá SAU commit: commit hỏng thì dòng còn và file cũng còn.
        String key = a.getObjectKey();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteObjectQuietly(key);
                }
            });
        } else {
            deleteObjectQuietly(key);
        }
    }

    // ── nội bộ ────────────────────────────────────────────────────────────

    private FeedbackItem insert(User user, CreateFeedbackRequest req, String content, List<Long> attachmentIds,
                                String clientRequestId) {
        Instant now = Instant.now();
        FeedbackItem item = items.saveAndFlush(FeedbackItem.builder()
                .userId(user.getId())
                .roleAtSubmit(user.getRole().name())
                .orgIdAtSubmit(user.getOrgId())
                .source(Source.IN_APP)
                .type(req.type())
                .area(req.area())
                .satisfaction(req.satisfaction() == null ? null : req.satisfaction().shortValue())
                .content(content)
                .title(titleOf(content))
                .status(Status.NEW)
                .allowContact(req.allowContact())
                .techInfo(sanitizeTechInfo(req.techInfo()))
                .clientRequestId(clientRequestId)
                .createdAt(now)
                .statusChangedAt(now)
                .build());
        if (!attachmentIds.isEmpty()) {
            // Một lệnh có điều kiện: chỉ ảnh của chính người gửi và CHƯA gắn; hai lượt gửi đua nhau cùng ảnh
            // thì lượt sau đổi được 0 dòng và bị từ chối thay vì giành ảnh của lượt trước.
            int attached = attachments.attachUnattached(item.getId(), attachmentIds, user.getId());
            if (attached != attachmentIds.size()) {
                throw new BadRequestException("Ảnh đính kèm không còn dùng được. Hãy chọn lại ảnh.");
            }
        }
        return item;
    }

    private MyFeedbackDto mineOf(FeedbackItem item) {
        List<ReplyDto> r = replies.findByFeedbackIdOrderByCreatedAtAsc(item.getId()).stream()
                .map(FeedbackService::toReplyDto).toList();
        int count = attachments.findByFeedbackIdOrderByIdAsc(item.getId()).size();
        return toMine(item, r, count);
    }

    private static MyFeedbackDto toMine(FeedbackItem f, List<ReplyDto> replies, int attachmentCount) {
        return new MyFeedbackDto(
                f.getId(), f.getType(), f.getArea(), f.getSource(),
                f.getSatisfaction() == null ? null : f.getSatisfaction().intValue(),
                f.getTitle(), f.getContent(), f.getStatus(), attachmentCount,
                f.getCreatedAt(), f.getStatusChangedAt(), List.copyOf(replies));
    }

    static ReplyDto toReplyDto(FeedbackReply r) {
        return new ReplyDto(r.getId(), r.getBody(), r.getCreatedAt());
    }

    static Audience audienceOf(User user) {
        Audience audience = user == null || user.getRole() == null ? null : Audience.of(user.getRole());
        if (audience == null) {
            throw new ForbiddenException("Tài khoản quản trị không gửi góp ý. Hãy dùng ghi chú nội bộ.");
        }
        return audience;
    }

    /** BR-02: đếm theo ký tự Unicode sau khi bỏ khoảng trắng hai đầu. */
    static String normalizeContent(String raw) {
        String content = raw == null ? "" : raw.strip();
        int length = content.codePointCount(0, content.length());
        if (length < MIN_CONTENT) {
            throw new BadRequestException("Viết ít nhất 10 ký tự để gửi.");
        }
        if (length > MAX_CONTENT) {
            throw new BadRequestException("Góp ý dài tối đa 2000 ký tự.");
        }
        return content;
    }

    /** BR-01: dòng đầu của nội dung, cắt ở 80 ký tự Unicode, thêm "…" nếu cắt. */
    static String titleOf(String content) {
        String firstLine = content.strip().lines().findFirst().orElse("").strip();
        if (firstLine.codePointCount(0, firstLine.length()) <= TITLE_MAX) return firstLine;
        int end = firstLine.offsetByCodePoints(0, TITLE_MAX);
        return firstLine.substring(0, end).stripTrailing() + "…";
    }

    /** BR-04: chỉ các trường cho phép, đường dẫn bỏ query và mảnh #, cắt độ dài. */
    static Map<String, Object> sanitizeTechInfo(TechInfo info) {
        if (info == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        putIfPresent(out, "page", stripQuery(info.page()), 200);
        putIfPresent(out, "browser", info.browser(), 60);
        putIfPresent(out, "os", info.os(), 60);
        putIfPresent(out, "device", info.device(), 20);
        putIfPresent(out, "build", info.build(), 60);
        putIfPresent(out, "locale", info.locale(), 10);
        putIfPresent(out, "screen", info.screen(), 20);
        return out.isEmpty() ? null : out;
    }

    /**
     * Đoạn đường dẫn mà đoạn ngay sau nó là token một lần (khớp {@code TOKEN_PATH_SEGMENTS} của
     * {@code frontend/src/lib/analytics/scrubUrl.ts}). Lọc lại ở server để client nào quên lọc cũng không lọt token.
     */
    static final Set<String> TOKEN_PATH_SEGMENTS = Set.of(
            "phieu", "report", "certificate", "report-issues", "grade-report", "org-invitations");

    static String stripQuery(String page) {
        if (page == null) return null;
        int cut = page.length();
        int q = page.indexOf('?');
        int h = page.indexOf('#');
        if (q >= 0) cut = Math.min(cut, q);
        if (h >= 0) cut = Math.min(cut, h);
        String[] parts = page.substring(0, cut).split("/", -1);
        for (int i = 0; i + 1 < parts.length; i++) {
            if (TOKEN_PATH_SEGMENTS.contains(parts[i]) && !parts[i + 1].isEmpty()) {
                parts[i + 1] = ":token";
            }
        }
        return String.join("/", parts);
    }

    private static void putIfPresent(Map<String, Object> out, String key, String value, int max) {
        if (value == null) return;
        String v = value.strip();
        if (v.isEmpty()) return;
        out.put(key, v.length() > max ? v.substring(0, max) : v);
    }

    private static List<Long> distinct(List<Long> ids) {
        if (ids == null) return List.of();
        Set<Long> set = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) set.add(id);
        }
        return new ArrayList<>(set);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    void deleteObjectQuietly(String key) {
        try {
            storage.deleteFile(key);
        } catch (RuntimeException e) {
            log.error("[feedback] could not delete storage object {}: {}", key, e.getMessage());
        }
    }
}
