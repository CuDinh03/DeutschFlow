package com.deutschflow.feedback.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.common.quota.PlanBadge;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.feedback.FeedbackEnums.Area;
import com.deutschflow.feedback.FeedbackEnums.Source;
import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.FeedbackEnums.Type;
import com.deutschflow.feedback.dto.FeedbackDtos.AdminAttachment;
import com.deutschflow.feedback.dto.FeedbackDtos.AdminDetail;
import com.deutschflow.feedback.dto.FeedbackDtos.AdminListItem;
import com.deutschflow.feedback.dto.FeedbackDtos.AdminListPage;
import com.deutschflow.feedback.dto.FeedbackDtos.ReplyDto;
import com.deutschflow.feedback.dto.FeedbackDtos.StatusChangeResult;
import com.deutschflow.feedback.entity.FeedbackItem;
import com.deutschflow.feedback.entity.FeedbackReply;
import com.deutschflow.feedback.repository.FeedbackAttachmentRepository;
import com.deutschflow.feedback.repository.FeedbackItemRepository;
import com.deutschflow.feedback.repository.FeedbackReplyRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Hộp góp ý của ADMIN (FBK-15…23, 28, 69). Quyền ADMIN kiểm ở controller ({@code hasRole('ADMIN')}).
 *
 * <p>Vết thao tác chỉ ghi định danh và số lượng, KHÔNG chép nội dung góp ý (FBK-69).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminFeedbackService {

    public static final int PAGE_SIZE = 50;
    static final int EXCERPT = 160;
    static final Duration ATTACHMENT_URL_TTL = Duration.ofMinutes(10);

    static final String EVENT_STATUS = "admin.feedback.status_changed";
    static final String EVENT_REPLY = "admin.feedback.replied";
    static final String EVENT_NOTE = "admin.feedback.note_updated";

    public enum Sort { NEWEST, LOW_SCORE }

    /** Bộ lọc danh sách. {@code role} là STUDENT, TEACHER hoặc ORG (OWNER + MANAGER). */
    public record Filter(Status status, Type type, Area area, Source source, String role, String q) {}

    private final FeedbackItemRepository items;
    private final FeedbackAttachmentRepository attachments;
    private final FeedbackReplyRepository replies;
    private final UserRepository users;
    private final UserLearningProfileRepository profiles;
    private final QuotaService quotaService;
    private final S3StorageService storage;
    private final FeedbackNotifier notifier;
    private final AuditLogService audit;
    private final NamedParameterJdbcTemplate jdbc;

    // ── Đọc ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminListPage list(Filter filter, Sort sort, int page) {
        int safePage = Math.max(0, page);
        MapSqlParameterSource params = new MapSqlParameterSource();
        String where = where(filter, params, true);

        // BR-11: ở bộ lọc Chưa đọc, góp ý Điểm thấp (1–2) luôn đứng trước rồi mới áp kiểu sắp.
        String lowFirst = filter.status() == Status.NEW
                ? "CASE WHEN f.satisfaction IN (1, 2) THEN 0 ELSE 1 END, " : "";
        String order = sort == Sort.LOW_SCORE
                ? lowFirst + "f.satisfaction ASC NULLS LAST, f.created_at DESC, f.id DESC"
                : lowFirst + "f.created_at DESC, f.id DESC";

        params.addValue("limit", PAGE_SIZE).addValue("offset", (long) safePage * PAGE_SIZE);
        List<AdminListItem> rows = jdbc.query("""
                SELECT f.id, f.type, f.area, f.source, f.satisfaction, f.title, LEFT(f.content, %d) AS excerpt,
                       f.status, f.created_at, f.role_at_submit, u.display_name,
                       p.current_level,
                       (SELECT count(*) FROM feedback_attachments a WHERE a.feedback_id = f.id) AS attachment_count,
                       (SELECT count(*) FROM feedback_replies r WHERE r.feedback_id = f.id) AS reply_count
                FROM feedback_items f
                JOIN users u ON u.id = f.user_id
                LEFT JOIN user_learning_profiles p ON p.user_id = f.user_id
                %s
                ORDER BY %s
                LIMIT :limit OFFSET :offset
                """.formatted(EXCERPT, where, order), params, AdminFeedbackService::mapListRow);

        Long total = jdbc.queryForObject("""
                SELECT count(*) FROM feedback_items f JOIN users u ON u.id = f.user_id %s
                """.formatted(where), params, Long.class);

        // Số đếm từng trạng thái theo các bộ lọc khác (bỏ bộ lọc trạng thái) cho các nút trạng thái.
        MapSqlParameterSource countParams = new MapSqlParameterSource();
        String countWhere = where(filter, countParams, false);
        Map<Status, Long> counts = new EnumMap<>(Status.class);
        for (Status s : Status.values()) counts.put(s, 0L);
        jdbc.query("""
                SELECT f.status, count(*) AS n FROM feedback_items f JOIN users u ON u.id = f.user_id %s
                GROUP BY f.status
                """.formatted(countWhere), countParams,
                rs -> { counts.put(Status.valueOf(rs.getString("status")), rs.getLong("n")); });

        return new AdminListPage(rows, total == null ? 0 : total, safePage, PAGE_SIZE, counts);
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return items.countByStatus(Status.NEW);
    }

    /**
     * Cố ý KHÔNG bọc giao dịch chỉ đọc: {@code resolvePlanBadge} có thể GHI (đóng gói hết hạn), nên chạy
     * trong giao dịch read-only của ta sẽ làm hỏng cả lượt đọc.
     */
    public AdminDetail detail(Long id) {
        FeedbackItem f = find(id);
        User author = users.findById(f.getUserId()).orElse(null);
        String level = profiles.findByUserId(f.getUserId())
                .map(p -> p.getCurrentLevel() == null ? null : p.getCurrentLevel().name())
                .orElse(null);
        String plan = planOf(f.getUserId());
        String orgName = f.getOrgIdAtSubmit() == null ? null : jdbc.query(
                "SELECT name FROM organizations WHERE id = :id",
                new MapSqlParameterSource("id", f.getOrgIdAtSubmit()),
                rs -> rs.next() ? rs.getString(1) : null);
        List<AdminAttachment> files = attachments.findByFeedbackIdOrderByIdAsc(f.getId()).stream()
                .filter(a -> a.getPurgedAt() == null)
                .map(a -> new AdminAttachment(a.getId(), signedUrl(a.getObjectKey()), a.getWidth(), a.getHeight()))
                .toList();
        List<ReplyDto> r = replies.findByFeedbackIdOrderByCreatedAtAsc(f.getId()).stream()
                .map(FeedbackService::toReplyDto).toList();
        return new AdminDetail(
                f.getId(), f.getType(), f.getArea(), f.getSource(), satisfactionOf(f), isLowScore(f),
                f.getTitle(), f.getContent(), f.getStatus(), f.getCreatedAt(), f.getReadAt(), f.getStatusChangedAt(),
                f.getUserId(),
                author == null ? null : author.getDisplayName(),
                f.getRoleAtSubmit(),
                level,
                plan,
                author == null || author.getCreatedAt() == null ? null
                        : author.getCreatedAt().atZone(java.time.ZoneId.systemDefault()).toInstant(),
                orgName,
                f.isAllowContact(),
                f.isAllowContact() && author != null ? author.getEmail() : null,
                f.getTechInfo(),
                files, r, f.getInternalNote());
    }

    // ── Ghi ───────────────────────────────────────────────────────────────

    /** FBK-20: mở chi tiết một góp ý NEW thì nó thành READ. Không vết (không phải quyết định của admin). */
    @Transactional
    public int markRead(List<Long> ids) {
        int changed = 0;
        Instant now = Instant.now();
        for (FeedbackItem f : items.findAllById(new LinkedHashSet<>(ids))) {
            if (f.getStatus() == Status.NEW) {
                f.setStatus(Status.READ);
                f.setReadAt(now);
                f.setStatusChangedAt(now);
                changed++;
            }
        }
        return changed;
    }

    /**
     * FBK-21: đổi trạng thái một hoặc nhiều góp ý theo bảng ở mục 9. Có một chuyển không hợp lệ thì
     * không đổi gì (400). DECLINED bắt buộc lời giải thích, lưu thành lời trả lời + tin
     * {@code FEEDBACK_REPLIED} (BR-07). SHIPPED gửi {@code FEEDBACK_SHIPPED} tối đa một lần mỗi góp ý (BR-08).
     */
    @Transactional
    public StatusChangeResult changeStatus(User admin, List<Long> ids, Status target, String explanation) {
        if (target == Status.NEW) {
            throw new BadRequestException("Không chuyển góp ý về trạng thái Đã gửi.");
        }
        String reason = explanation == null ? "" : explanation.strip();
        if (target == Status.DECLINED) {
            int len = reason.codePointCount(0, reason.length());
            if (len < 10 || len > 1000) {
                throw new BadRequestException("Chọn \"Chưa làm lúc này\" cần lời giải thích 10–1000 ký tự.");
            }
        }
        List<FeedbackItem> found = items.findAllById(new LinkedHashSet<>(ids));
        if (found.size() != new LinkedHashSet<>(ids).size()) {
            throw new NotFoundException("Không tìm thấy góp ý.");
        }
        for (FeedbackItem f : found) {
            if (!f.getStatus().canMoveTo(target)) {
                throw new BadRequestException("Không chuyển được góp ý từ \"" + label(f.getStatus())
                        + "\" sang \"" + label(target) + "\".");
            }
        }

        Instant now = Instant.now();
        int updated = 0;
        for (FeedbackItem f : found) {
            if (f.getStatus() == target) continue;
            f.setStatus(target);
            f.setStatusChangedAt(now);
            if (f.getReadAt() == null) f.setReadAt(now);
            updated++;
            if (target == Status.SHIPPED) {
                notifier.shipped(f);
            } else if (target == Status.DECLINED) {
                FeedbackReply reply = replies.save(reply(f.getId(), reason, admin, now));
                notifier.replied(f, reply.getId());
            }
        }
        items.saveAll(found);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("count", updated);
        meta.put("status", target.name());
        meta.put("ids", found.stream().map(FeedbackItem::getId).toList());
        audit.log(EVENT_STATUS, AuditActor.of(admin), "feedback", idsTarget(found), meta);
        return new StatusChangeResult(updated, found.size() - updated);
    }

    /** FBK-22: lời trả lời người gửi đọc được + tin {@code FEEDBACK_REPLIED}. Góp ý NEW thành READ. */
    @Transactional
    public ReplyDto reply(User admin, Long id, String body) {
        String text = body == null ? "" : body.strip();
        int len = text.codePointCount(0, text.length());
        if (len < 1 || len > 1000) {
            throw new BadRequestException("Lời trả lời dài 1–1000 ký tự.");
        }
        FeedbackItem f = find(id);
        Instant now = Instant.now();
        if (f.getStatus() == Status.NEW) {
            f.setStatus(Status.READ);
            f.setReadAt(now);
            f.setStatusChangedAt(now);
            items.save(f);
        }
        FeedbackReply saved = replies.save(reply(f.getId(), text, admin, now));
        notifier.replied(f, saved.getId());
        audit.log(EVENT_REPLY, AuditActor.of(admin), "feedback", String.valueOf(f.getId()),
                Map.of("replyId", saved.getId()));
        return FeedbackService.toReplyDto(saved);
    }

    /** FBK-23: ghi chú nội bộ, không bao giờ có trong API của người gửi. */
    @Transactional
    public void updateNote(User admin, Long id, String note) {
        String text = note == null ? null : note.strip();
        if (text != null && text.isEmpty()) text = null;
        if (text != null && text.codePointCount(0, text.length()) > 2000) {
            throw new BadRequestException("Ghi chú nội bộ dài tối đa 2000 ký tự.");
        }
        FeedbackItem f = find(id);
        f.setInternalNote(text);
        items.save(f);
        audit.log(EVENT_NOTE, AuditActor.of(admin), "feedback", String.valueOf(f.getId()),
                Map.of("length", text == null ? 0 : text.length()));
    }

    // ── nội bộ ────────────────────────────────────────────────────────────

    private FeedbackItem find(Long id) {
        return items.findById(id).orElseThrow(() -> new NotFoundException("Không tìm thấy góp ý."));
    }

    private static FeedbackReply reply(Long feedbackId, String body, User admin, Instant at) {
        return FeedbackReply.builder()
                .feedbackId(feedbackId)
                .body(body)
                .authorId(admin == null ? null : admin.getId())
                .createdAt(at)
                .build();
    }

    private String planOf(Long userId) {
        try {
            PlanBadge badge = quotaService.resolvePlanBadge(userId, Instant.now());
            return badge == null ? null : badge.tier();
        } catch (RuntimeException e) {
            log.warn("[feedback] could not resolve plan for user {}: {}", userId, e.getMessage());
            return null;
        }
    }

    private String signedUrl(String key) {
        try {
            return storage.presignedGetUrl(key, ATTACHMENT_URL_TTL);
        } catch (RuntimeException e) {
            log.warn("[feedback] could not sign attachment {}: {}", key, e.getMessage());
            return null;
        }
    }

    /** Mệnh đề WHERE với tham số bind; không bao giờ ghép chuỗi người dùng nhập. */
    static String where(Filter filter, MapSqlParameterSource params, boolean withStatus) {
        List<String> clauses = new ArrayList<>();
        if (withStatus && filter.status() != null) {
            clauses.add("f.status = :status");
            params.addValue("status", filter.status().name());
        }
        if (filter.type() != null) {
            clauses.add("f.type = :type");
            params.addValue("type", filter.type().name());
        }
        if (filter.area() != null) {
            clauses.add("f.area = :area");
            params.addValue("area", filter.area().name());
        }
        if (filter.source() != null) {
            clauses.add("f.source = :source");
            params.addValue("source", filter.source().name());
        }
        if (filter.role() != null) {
            switch (filter.role()) {
                case "STUDENT", "TEACHER" -> {
                    clauses.add("f.role_at_submit = :role");
                    params.addValue("role", filter.role());
                }
                case "ORG" -> clauses.add("f.role_at_submit IN ('OWNER', 'MANAGER')");
                default -> throw new BadRequestException("Vai trò lọc không hợp lệ.");
            }
        }
        if (filter.q() != null && !filter.q().isBlank()) {
            String q = filter.q().strip();
            if (q.length() > 100) q = q.substring(0, 100);
            String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            clauses.add("(f.content ILIKE :q ESCAPE '\\' OR u.email ILIKE :q ESCAPE '\\' "
                    + "OR u.display_name ILIKE :q ESCAPE '\\')");
            params.addValue("q", like);
        }
        return clauses.isEmpty() ? "" : "WHERE " + String.join(" AND ", clauses);
    }

    private static AdminListItem mapListRow(ResultSet rs, int i) throws SQLException {
        int sat = rs.getInt("satisfaction");
        Integer satisfaction = rs.wasNull() ? null : sat;
        String excerpt = rs.getString("excerpt");
        return new AdminListItem(
                rs.getLong("id"),
                Type.valueOf(rs.getString("type")),
                Area.valueOf(rs.getString("area")),
                Source.valueOf(rs.getString("source")),
                satisfaction,
                satisfaction != null && satisfaction <= 2,
                rs.getString("title"),
                excerpt == null ? "" : excerpt.replaceAll("\\s+", " ").strip(),
                Status.valueOf(rs.getString("status")),
                rs.getString("display_name"),
                rs.getString("role_at_submit"),
                rs.getString("current_level"),
                rs.getInt("attachment_count"),
                rs.getInt("reply_count"),
                toInstant(rs.getTimestamp("created_at")));
    }

    private static Instant toInstant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private static Integer satisfactionOf(FeedbackItem f) {
        return f.getSatisfaction() == null ? null : f.getSatisfaction().intValue();
    }

    private static boolean isLowScore(FeedbackItem f) {
        return f.getSatisfaction() != null && f.getSatisfaction() <= 2;
    }

    private static String idsTarget(List<FeedbackItem> found) {
        return found.size() == 1 ? String.valueOf(found.get(0).getId()) : found.size() + " items";
    }

    /** Nhãn người đọc được cho câu lỗi (không lộ mã máy ra giao diện). */
    static String label(Status s) {
        return switch (s) {
            case NEW -> "Đã gửi";
            case READ -> "Đã đọc";
            case IN_PROGRESS -> "Đang làm";
            case SHIPPED -> "Đã ra mắt";
            case DECLINED -> "Chưa làm lúc này";
        };
    }
}
