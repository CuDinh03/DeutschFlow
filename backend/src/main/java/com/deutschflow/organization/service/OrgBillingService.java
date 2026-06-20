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
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
    private static final Set<String> VALID_STATUSES = Set.of("DRAFT", "SENT", "PAID", "VOID");

    private static final String ROLE_STUDENT = "STUDENT";
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final OrgInvoiceRepository invoiceRepo;
    private final OrganizationRepository organizationRepository;
    private final OrgMemberRepository memberRepo;

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

    /** Transitions an invoice's status; rejects cross-org access and unknown statuses. */
    @Transactional
    public OrgInvoiceDto updateStatus(Long orgId, Long invoiceId, String status) {
        OrgInvoice invoice = invoiceRepo.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy hoá đơn"));
        if (!invoice.getOrgId().equals(orgId)) {
            throw new ForbiddenException("hoá đơn không thuộc tổ chức");
        }
        if (status == null || !VALID_STATUSES.contains(status)) {
            throw new BadRequestException("Trạng thái hoá đơn không hợp lệ");
        }
        invoice.setStatus(status);
        return toDto(invoiceRepo.save(invoice));
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
