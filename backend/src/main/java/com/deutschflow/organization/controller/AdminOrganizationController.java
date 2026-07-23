package com.deutschflow.organization.controller;

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
@PreAuthorize("hasRole('ADMIN')")
public class AdminOrganizationController {

    private final AdminOrgService adminOrgService;
    private final OrgBillingService billingService;

    @PostMapping
    public OrgDto createOrganization(@RequestBody CreateOrgRequest request) {
        return adminOrgService.createOrganization(request);
    }

    @GetMapping
    public Page<OrgDto> listOrganizations(Pageable pageable) {
        return adminOrgService.listOrganizations(pageable);
    }

    @GetMapping("/{id}")
    public OrgDetailDto getOrganization(@PathVariable Long id) {
        return adminOrgService.getOrganization(id);
    }

    @PatchMapping("/{id}")
    public OrgDto updateOrganization(@PathVariable Long id, @RequestBody UpdateOrgRequest request) {
        return adminOrgService.updateOrganization(id, request);
    }

    @GetMapping("/{id}/members")
    public List<OrgMemberDto> listMembers(@PathVariable("id") Long orgId) {
        return adminOrgService.listMembers(orgId);
    }

    @PostMapping("/{id}/members")
    public OrgMemberDto addMember(@PathVariable("id") Long orgId, @RequestBody AddMemberRequest request) {
        return adminOrgService.addMember(orgId, request.email(), request.role());
    }

    @PostMapping("/{id}/activate-entitlements")
    public Map<String, Integer> activateEntitlements(@PathVariable("id") Long orgId) {
        return Map.of("granted", adminOrgService.activateEntitlements(orgId));
    }

    @PostMapping("/{id}/invoices")
    public OrgInvoiceDto createInvoice(@PathVariable("id") Long orgId,
                                       @RequestBody CreateInvoiceRequest request,
                                       @AuthenticationPrincipal User admin) {
        return billingService.createInvoice(orgId, request, admin.getId());
    }

    @GetMapping("/{id}/invoices")
    public List<OrgInvoiceDto> listInvoices(@PathVariable("id") Long orgId) {
        return billingService.listInvoices(orgId);
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
}
