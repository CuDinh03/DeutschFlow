package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.organization.dto.CreateInvoiceRequest;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.entity.OrgInvoice;
import com.deutschflow.organization.repository.OrgInvoiceRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
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

    private final OrgInvoiceRepository invoiceRepo;
    private final OrganizationRepository organizationRepository;

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
                .seats(req.seats())
                .amountVnd(req.amountVnd())
                .status(STATUS_DRAFT)
                .note(req.note())
                .createdBy(createdBy)
                .build();
        return toDto(invoiceRepo.save(invoice));
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

    private OrgInvoiceDto toDto(OrgInvoice invoice) {
        return new OrgInvoiceDto(
                invoice.getId(),
                invoice.getOrgId(),
                invoice.getPeriodStart(),
                invoice.getPeriodEnd(),
                invoice.getSeats(),
                invoice.getAmountVnd(),
                invoice.getStatus(),
                invoice.getNote(),
                invoice.getCreatedAt());
    }
}
