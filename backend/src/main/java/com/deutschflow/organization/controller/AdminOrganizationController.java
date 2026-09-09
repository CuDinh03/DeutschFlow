package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.organization.dto.AddMemberRequest;
import com.deutschflow.organization.dto.CreateInvoiceRequest;
import com.deutschflow.organization.dto.CreateOrgRequest;
import com.deutschflow.organization.dto.OrgDetailDto;
import com.deutschflow.organization.dto.OrgDto;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.dto.OrgMemberDto;
import com.deutschflow.organization.dto.UpdateInvoiceStatusRequest;
import com.deutschflow.organization.dto.UpdateOrgRequest;
import com.deutschflow.organization.service.AdminOrgService;
import com.deutschflow.organization.service.OrgBillingService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Platform-admin provisioning of organizations. ADMIN-only; mirrors the thin-controller style of
 * {@code TeacherReportController} (delegates all logic to {@link AdminOrgService}).
 */
@RestController
@RequestMapping("/api/admin/organizations")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasRole('ADMIN')")
public class AdminOrganizationController {

    private final AdminOrgService adminOrgService;
    private final OrgBillingService billingService;
    private final AuditLogService auditLogService;

    @PostMapping
    public OrgDto createOrganization(@RequestBody CreateOrgRequest request,
                                     @AuthenticationPrincipal User actor) {
        return adminOrgService.createOrganization(request, AuditActor.of(actor));
    }

    @GetMapping
    public Page<OrgDto> listOrganizations(Pageable pageable) {
        return adminOrgService.listOrganizations(pageable);
    }

    @GetMapping("/{id}")
    public OrgDetailDto getOrganization(@PathVariable Long id, @AuthenticationPrincipal User actor) {
        OrgDetailDto org = adminOrgService.getOrganization(id);
        // DEC-13: hồ sơ một trung tâm cụ thể — gói, số ghế, sĩ số, hạn mức token. Ở đây không cần
        // AuditOrgResolver: {id} CHÍNH LÀ trung tâm bị chạm, khỏi tra lại. Metadata để trống vì mọi
        // con số trong DTO là của chính trung tâm đó, giám đốc vốn đọc được ở màn hình của mình.
        auditRead(() -> auditLogService.log("admin.org.detail.read", AuditActor.of(actor),
                "ORG", String.valueOf(id), id, Map.of()));
        return org;
    }

    @PatchMapping("/{id}")
    public OrgDto updateOrganization(@PathVariable Long id, @RequestBody UpdateOrgRequest request,
                                     @AuthenticationPrincipal User actor) {
        return adminOrgService.updateOrganization(id, request, AuditActor.of(actor));
    }

    @GetMapping("/{id}/members")
    public List<OrgMemberDto> listMembers(@PathVariable("id") Long orgId,
                                          @AuthenticationPrincipal User actor) {
        List<OrgMemberDto> members = adminOrgService.listMembers(orgId);
        // Mỗi dòng là PII thành viên (email + tên thật + vai trò). Đọc trọn danh sách là một lần
        // truy xuất PII, cùng lằn ranh với admin.marketing.leads.read: ghi SỐ dòng đọc được, không
        // chép email hay tên vào vết.
        auditRead(() -> auditLogService.log("admin.org.members.read", AuditActor.of(actor),
                "ORG", String.valueOf(orgId), orgId, Map.of("returnedCount", members.size())));
        return members;
    }

    @PostMapping("/{id}/members")
    public OrgMemberDto addMember(@PathVariable("id") Long orgId,
                                  @RequestBody AddMemberRequest request,
                                  @AuthenticationPrincipal User actor) {
        return adminOrgService.addMember(orgId, request.email(), request.role(), AuditActor.of(actor));
    }

    @PostMapping("/{id}/activate-entitlements")
    public Map<String, Integer> activateEntitlements(@PathVariable("id") Long orgId,
                                                     @AuthenticationPrincipal User actor) {
        return Map.of("granted", adminOrgService.activateEntitlements(orgId, AuditActor.of(actor)));
    }

    @PostMapping("/{id}/invoices")
    public OrgInvoiceDto createInvoice(@PathVariable("id") Long orgId,
                                       @RequestBody CreateInvoiceRequest request,
                                       @AuthenticationPrincipal User admin) {
        return billingService.createInvoice(orgId, request, AuditActor.of(admin));
    }

    @GetMapping("/{id}/invoices")
    public List<OrgInvoiceDto> listInvoices(@PathVariable("id") Long orgId,
                                            @AuthenticationPrincipal User actor) {
        List<OrgInvoiceDto> invoices = billingService.listInvoices(orgId);
        // Sổ hoá đơn của một trung tâm: số tiền, kỳ hạn, trạng thái thanh toán. Không nằm trong danh
        // sách được giao nhưng cùng loại "dữ liệu của MỘT trung tâm" như hai đường trên, và các
        // đường GHI hoá đơn đã ghi vết từ trước — để đường đọc câm thì sổ khuyết đúng nửa câu chuyện.
        auditRead(() -> auditLogService.log("admin.org.invoices.read", AuditActor.of(actor),
                "ORG", String.valueOf(orgId), orgId, Map.of("returnedCount", invoices.size())));
        return invoices;
    }

    @PatchMapping("/{id}/invoices/{invoiceId}/status")
    public OrgInvoiceDto updateInvoiceStatus(@PathVariable("id") Long orgId,
                                             @PathVariable Long invoiceId,
                                             @RequestBody UpdateInvoiceStatusRequest request,
                                             @AuthenticationPrincipal User admin) {
        // L-10: audit trail cần danh tính người chuyển trạng thái (PAID = kích hoạt org).
        return billingService.updateStatus(orgId, invoiceId, request.status(),
                admin.getId(), admin.getEmail(), String.valueOf(admin.getRole()));
    }

    /**
     * Ghi vết cho một đường ĐỌC — mọi lỗi ghi vết bị nuốt, kèm {@code log.error} (DEC-13, owner
     * chốt 09/09/2026: đường đọc chạm dữ liệu một trung tâm cũng phải để lại vết giám đốc đọc được).
     *
     * <p><b>Fail-open có tiếng, cố ý.</b> {@code audit_logs.org_id} có KHOÁ NGOẠI tới
     * {@code organizations(id)} (V315); một orgId hỏng ném ngay ở INSERT và biến một lần ĐỌC ĐÃ
     * THÀNH CÔNG thành 500 trả về client. Cùng lựa chọn với nhánh ghi vết blocked-attempt trong
     * {@code GlobalExceptionHandler}: lỗi ghi vết không được đổi response của client.
     *
     * <p>🪤 <b>Ghi ở CONTROLLER, đừng đẩy xuống service cho "đúng chuẩn".</b> {@code AuditActor} nêu
     * quy ước ngược lại, nhưng quy ước đó dành cho MUTATION. {@code getOrganization} /
     * {@code listMembers} / {@code listInvoices} đều là {@code @Transactional(readOnly = true)}, mà
     * {@code AuditLogService} dùng chung connection qua {@code DataSourceUtils} ⇒ INSERT bên trong
     * sẽ nổ <em>"cannot execute INSERT in a read-only transaction"</em> và giết chính endpoint.
     *
     * <p>Bản sao của {@code AdminManagementController.auditRead}: gom vào một lớp dùng chung là việc
     * của đợt sau, khi đã biết có bao nhiêu controller cần đến nó.
     */
    private void auditRead(Runnable auditWrite) {
        try {
            auditWrite.run();
        } catch (Exception e) {
            log.error("Không ghi được vết đường đọc admin (organizations): {}", e.getMessage(), e);
        }
    }
}
