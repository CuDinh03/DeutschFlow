package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.CreateInvoiceRequest;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.dto.PaymentInfoDto;
import com.deutschflow.organization.entity.OrgInvoice;
import com.deutschflow.organization.repository.OrgInvoiceRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.common.audit.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Org billing: DRAFT invoice creation, listing, and status transitions.
 *
 * <p>Authorization is enforced by the callers ({@code AdminOrganizationController}
 * for platform admins, {@code OrgController} via {@code OrgGuard} for org admins);
 * this service trusts the {@code orgId} it receives but guards cross-org invoice
 * access in {@link #updateStatus}.
 */
@Service
@RequiredArgsConstructor
public class OrgBillingService {

    private static final String STATUS_DRAFT = "DRAFT";
    private static final String STATUS_PAID = "PAID";
    private static final Set<String> VALID_STATUSES = Set.of("DRAFT", "SENT", "PAID", "VOID");

    /**
     * Forward-only invoice lifecycle (audit M-15): a status may only move to itself (idempotent)
     * or forward. PAID and VOID are terminal — a settled or voided invoice can never be reopened
     * (prevents un-paying a paid invoice or reviving a voided one). DRAFT→PAID stays allowed so an
     * admin can manually reconcile an off-band transfer.
     */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            "DRAFT", Set.of("DRAFT", "SENT", "PAID", "VOID"),
            "SENT", Set.of("SENT", "PAID", "VOID"),
            "PAID", Set.of("PAID"),
            "VOID", Set.of("VOID"));

    private static final String ROLE_STUDENT = "STUDENT";
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final OrgInvoiceRepository invoiceRepo;
    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository memberRepo;
    private final UserNotificationService userNotificationService;
    private final AdminOrgService adminOrgService;
    private final AuditLogService auditLogService;

    @Value("${app.payment.sepay.bank-account:}")
    private String bankAccount;
    @Value("${app.payment.sepay.bank-name:}")
    private String bankName;
    @Value("${app.payment.sepay.account-name:}")
    private String accountName;

    /** Bank-transfer instructions for the org to pay invoices (VietQR memo = invoice paymentCode). */
    public PaymentInfoDto getPaymentInfo() {
        return new PaymentInfoDto(bankAccount, bankName, accountName);
    }

    /** Creates a DRAFT invoice for the org. */
    @Transactional
    public OrgInvoiceDto createInvoice(Long orgId, CreateInvoiceRequest req, Long createdBy) {
        if (!organizationRepository.existsById(orgId)) {
            throw new NotFoundException("Không tìm thấy tổ chức");
        }
        // Audit M-14: reject non-positive amounts — a 0₫/âm invoice would auto-settle on ANY
        // positive transfer (webhook gate is `amount < invoice.amountVnd`) and grant a free licence.
        if (req.amountVnd() <= 0) {
            throw new BadRequestException("Số tiền hoá đơn phải lớn hơn 0");
        }
        OrgInvoice invoice = OrgInvoice.builder()
                .orgId(orgId)
                .periodStart(req.periodStart())
                .periodEnd(req.periodEnd())
                .seats(resolveSeats(orgId, req.seats()))
                .amountVnd(req.amountVnd())
                .status(STATUS_DRAFT)
                .paymentCode(newPaymentCode())
                .note(req.note())
                .createdBy(createdBy)
                .build();
        return toDto(invoiceRepo.save(invoice));
    }

    /**
     * D-3/G: nếu admin không nhập seats ({@code <= 0}), tự snapshot số HỌC VIÊN ACTIVE của org
     * tại thời điểm tạo invoice — chống gõ sai và gắn hoá đơn với sĩ số thực. Admin nhập tay
     * {@code > 0} thì tôn trọng giá trị đó (vd hợp đồng chốt số ghế khác sĩ số hiện tại).
     * Chưa làm proration giữa kỳ (cần khi chuyển sang self-serve month-to-month — xem REMEDIATION D-3/G).
     */
    private int resolveSeats(Long orgId, int requestedSeats) {
        if (requestedSeats > 0) {
            return requestedSeats;
        }
        return (int) memberRepo.countByIdOrgIdAndRoleAndStatus(orgId, ROLE_STUDENT, STATUS_ACTIVE);
    }

    /** Lists an org's invoices, newest first. */
    @Transactional(readOnly = true)
    public List<OrgInvoiceDto> listInvoices(Long orgId) {
        return invoiceRepo.findByOrgIdOrderByCreatedAtDesc(orgId).stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Transitions an invoice's status; rejects cross-org access and unknown statuses.
     *
     * <p>L-10 (audit B2B 07-04): đổi trạng thái hoá đơn là thao tác TIỀN (PAID kích hoạt org) nên
     * mỗi lần chuyển được ghi audit trail ({@code org_invoice_status_changed}) kèm actor + from→to —
     * trước đây không ai trả lời được "ai đã đánh dấu hoá đơn này PAID".
     */
    @Transactional
    public OrgInvoiceDto updateStatus(Long orgId, Long invoiceId, String status,
                                      Long actorId, String actorEmail, String actorRole) {
        OrgInvoice invoice = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hoá đơn"));
        if (!invoice.getOrgId().equals(orgId)) {
            throw new ForbiddenException("hoá đơn không thuộc tổ chức");
        }
        if (status == null || !VALID_STATUSES.contains(status)) {
            throw new BadRequestException("Trạng thái hoá đơn không hợp lệ");
        }
        // Audit M-15: enforce the forward-only lifecycle — reject backward/terminal-reopen moves.
        String current = invoice.getStatus();
        if (!ALLOWED_TRANSITIONS.getOrDefault(current, Set.of()).contains(status)) {
            throw new BadRequestException(
                    "Không thể chuyển trạng thái hoá đơn từ " + current + " sang " + status);
        }
        boolean nowPaid = STATUS_PAID.equals(status) && !STATUS_PAID.equals(current);
        invoice.setStatus(status);
        OrgInvoiceDto dto = toDto(invoiceRepo.save(invoice));
        Map<String, Object> auditMeta = new HashMap<>();
        auditMeta.put("orgId", orgId);
        auditMeta.put("from", current);
        auditMeta.put("to", status);
        if (invoice.getPaymentCode() != null) {
            auditMeta.put("paymentCode", invoice.getPaymentCode());
        }
        auditLogService.log("org_invoice_status_changed", actorId, actorEmail, actorRole,
                "ORG_INVOICE", String.valueOf(invoiceId), auditMeta);
        if (nowPaid) {
            // Audit M-16: a manually-reconciled payment must provision the org identically to the
            // SePay webhook path (org ACTIVE + validUntil + re-grant entitlements), not just notify.
            adminOrgService.activateForPaidInvoice(invoice);
            String orgName = organizationRepository.findById(orgId)
                    .map(org -> org.getName()).orElse("");
            userNotificationService.onOrgInvoicePaid(orgId, orgName, invoice.getPaymentCode(), invoice.getAmountVnd());
        }
        return dto;
    }

    /** Memo code embedded in the VietQR transfer; the SePay webhook matches the payment by it (C3).
     *  12 hex (48-bit) so birthday collisions stay negligible at any realistic invoice volume; the
     *  UNIQUE index on payment_code is the final backstop. Keep in sync with SepayWebhookService regex. */
    private String newPaymentCode() {
        return "DFINV" + java.util.UUID.randomUUID().toString()
                .replace("-", "").substring(0, 12).toUpperCase(java.util.Locale.ROOT);
    }

    private OrgInvoiceDto toDto(OrgInvoice invoice) {
        return new OrgInvoiceDto(
                invoice.getId(),
                invoice.getOrgId(),
                invoice.getPeriodStart(),
                invoice.getPeriodEnd(),
                invoice.getSeats(),
                invoice.getAmountVnd(),
                invoice.getStatus(),
                invoice.getPaymentCode(),
                invoice.getNote(),
                invoice.getCreatedAt());
    }
}
