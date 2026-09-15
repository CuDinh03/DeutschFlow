package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.OrgMinorMessageDtos.MinorConversationDto;
import com.deutschflow.organization.dto.OrgMinorMessageDtos.MinorThreadDto;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgMinorMessageService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Giám đốc trung tâm đọc tin nhắn riêng của học viên chưa thành niên — AC-ORG-CT-10 (DEC-22 mục
 * 18c, owner chốt 09/09/2026). Nghiệp vụ và phạm vi nằm ở {@link OrgMinorMessageService}; ở đây chỉ
 * có hai việc: xác định quyền, và GHI VẾT mỗi lượt đọc.
 *
 * <p><b>orgId lấy từ ngữ cảnh người gọi, không nhận qua tham số</b> — đúng khuôn
 * {@link OrgAuditController}. Nhận orgId từ client là mở đường cho một giám đốc đoán id của trung
 * tâm khác; ở đây thứ đoán được sẽ là tin nhắn riêng của trẻ em, nên khuôn đó không phải tuỳ chọn.
 *
 * <p><b>🔴 Ghi vết ở đây là FAIL-CLOSED — cố ý khác {@code AdminOrganizationController.auditRead}.</b>
 * Chỗ kia nuốt lỗi ghi vết để một lần đọc đã thành công không biến thành 500. Ở đây ngược lại: vết
 * audit KHÔNG phải một tiện ích quan sát mà là ĐIỀU KIỆN để lượt đọc này hợp lệ — AC-ORG-CT-10 phát
 * biểu "đọc được VÀ mỗi lượt đọc để lại vết", nên một lượt đọc không ghi được vết là một lượt đọc
 * không được phép. Ghi thất bại ⇒ ném, nội dung không rời khỏi máy chủ. Rủi ro thấp: {@code org_id}
 * ghi vào đã được {@code OrgGuard} chứng minh là một trung tâm có thật với thành viên ACTIVE, nên
 * khoá ngoại {@code audit_logs.org_id → organizations(id)} (V315) không thể vỡ vì dữ liệu.
 *
 * <p>🪤 Vẫn ghi ở CONTROLLER chứ không trong service: hai đường đọc đều
 * {@code @Transactional(readOnly = true)}, mà {@code AuditLogService} dùng chung connection qua
 * {@code DataSourceUtils} ⇒ INSERT bên trong sẽ nổ <em>"cannot execute INSERT in a read-only
 * transaction"</em>.
 *
 * <p>⛔ <b>Vết mang ĐỊNH DANH và SỐ LƯỢNG, không mang NỘI DUNG.</b> Không trích đoạn, không thân tin
 * nhắn, không ngày sinh thô — chỉ id hai bên, nhóm tuổi (căn cứ của quyền đọc) và số tin đã trả về.
 * Sổ hoạt động là thứ nhiều người trong trung tâm đọc được; chép nội dung vào đó là nhân bản đúng
 * dữ liệu mà endpoint này đang cố kiểm soát.
 */
@RestController
@RequestMapping("/api/org/minor-conversations")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgMinorMessageController {

    private final OrgMinorMessageService minorMessageService;
    private final AuditLogService auditLogService;
    private final OrgGuard orgGuard;

    /** Danh mục hội thoại có học viên chưa thành niên của trung tâm — không kèm nội dung tin nhắn. */
    @GetMapping
    public List<MinorConversationDto> list(@AuthenticationPrincipal User user) {
        Long orgId = requireOwnerOrg(user);
        List<MinorConversationDto> conversations = minorMessageService.listConversations(orgId);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("conversationCount", conversations.size());
        metadata.put("studentCount",
                conversations.stream().map(MinorConversationDto::studentUserId).distinct().count());
        auditLogService.log("org.minor.conversations.read", AuditActor.of(user),
                "ORG", String.valueOf(orgId), orgId, metadata);
        return conversations;
    }

    /**
     * Trọn hội thoại giữa một học viên chưa thành niên của trung tâm và một đối tác.
     *
     * <p>Vết ghi SAU khi đọc xong để mang được số tin thật sự trả về — "giám đốc đã mở hội thoại
     * này" và "đã thấy bao nhiêu tin" là hai nửa của cùng một câu, tách ra thì sổ không trả lời
     * được câu hỏi sáu tháng sau. Đọc xong mà ghi vết hỏng thì ném (xem javadoc lớp).
     */
    @GetMapping("/{studentUserId}/with/{counterpartUserId}")
    public MinorThreadDto thread(@AuthenticationPrincipal User user,
                                 @PathVariable Long studentUserId,
                                 @PathVariable Long counterpartUserId) {
        Long orgId = requireOwnerOrg(user);
        MinorThreadDto thread = minorMessageService.readThread(orgId, studentUserId, counterpartUserId);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("studentUserId", studentUserId);
        metadata.put("counterpartUserId", counterpartUserId);
        // Nhóm tuổi là CĂN CỨ của quyền đọc, không phải dữ liệu cá nhân thô: sổ phải trả lời được
        // "vì sao người này được đọc", mà ngày sinh thì tuyệt đối không vào vết.
        metadata.put("minorStatus", thread.minorStatus());
        metadata.put("messageCount", thread.messages().size());
        auditLogService.log("org.minor.conversation.read", AuditActor.of(user),
                "USER", String.valueOf(studentUserId), orgId, metadata);
        return thread;
    }

    /** OWNER của đúng trung tâm trong ngữ cảnh người gọi; xác minh lại từ {@code org_members}. */
    private Long requireOwnerOrg(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgOwner(user.getId(), orgId);
        return orgId;
    }
}
