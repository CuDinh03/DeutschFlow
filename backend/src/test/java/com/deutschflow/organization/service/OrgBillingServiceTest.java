package com.deutschflow.organization.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.CreateInvoiceRequest;
import com.deutschflow.organization.dto.OrgInvoiceDto;
import com.deutschflow.organization.entity.OrgInvoice;
import com.deutschflow.organization.repository.OrgInvoiceRepository;
import com.deutschflow.organization.repository.OrgMemberRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.notification.service.UserNotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OrgBillingService Unit Tests")
class OrgBillingServiceTest {

    @Mock private OrgInvoiceRepository invoiceRepo;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private OrgMemberRepository memberRepo;
    @Mock private UserNotificationService userNotificationService;

    private OrgBillingService service;

    private static final Long ORG_ID = 1L;
    private static final Long OTHER_ORG_ID = 99L;
    private static final Long INVOICE_ID = 42L;
    private static final Long CREATED_BY = 7L;

    @BeforeEach
    void setUp() {
        service = new OrgBillingService(invoiceRepo, organizationRepository, memberRepo, userNotificationService);
    }

    // ------------------------------------------------------------------ helpers

    private CreateInvoiceRequest aRequest() {
        return new CreateInvoiceRequest(
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 3, 31),
                10,
                5_000_000L,
                "Q1 invoice"
        );
    }

    private OrgInvoice savedInvoice(Long id, Long orgId, String status) {
        OrgInvoice inv = new OrgInvoice();
        inv.setId(id);
        inv.setOrgId(orgId);
        inv.setPeriodStart(LocalDate.of(2026, 1, 1));
        inv.setPeriodEnd(LocalDate.of(2026, 3, 31));
        inv.setSeats(10);
        inv.setAmountVnd(5_000_000L);
        inv.setStatus(status);
        inv.setNote("Q1 invoice");
        inv.setCreatedBy(CREATED_BY);
        return inv;
    }

    // ------------------------------------------------------------------ createInvoice

    @Test
    @DisplayName("createInvoice: persists a DRAFT invoice with the given fields")
    void createInvoice_persistsDraftWithCorrectFields() {
        when(organizationRepository.existsById(ORG_ID)).thenReturn(true);
        OrgInvoice persisted = savedInvoice(INVOICE_ID, ORG_ID, "DRAFT");
        when(invoiceRepo.save(any(OrgInvoice.class))).thenReturn(persisted);

        CreateInvoiceRequest req = aRequest();
        OrgInvoiceDto dto = service.createInvoice(ORG_ID, req, CREATED_BY);

        ArgumentCaptor<OrgInvoice> captor = ArgumentCaptor.forClass(OrgInvoice.class);
        verify(invoiceRepo).save(captor.capture());

        OrgInvoice saved = captor.getValue();
        assertThat(saved.getOrgId()).isEqualTo(ORG_ID);
        assertThat(saved.getPeriodStart()).isEqualTo(req.periodStart());
        assertThat(saved.getPeriodEnd()).isEqualTo(req.periodEnd());
        assertThat(saved.getSeats()).isEqualTo(req.seats());
        assertThat(saved.getAmountVnd()).isEqualTo(req.amountVnd());
        assertThat(saved.getStatus()).isEqualTo("DRAFT");
        assertThat(saved.getNote()).isEqualTo(req.note());
        assertThat(saved.getCreatedBy()).isEqualTo(CREATED_BY);

        assertThat(dto.status()).isEqualTo("DRAFT");
        assertThat(dto.orgId()).isEqualTo(ORG_ID);
    }

    @Test
    @DisplayName("createInvoice: D-3/G — seats<=0 auto-snapshots ACTIVE student count")
    void createInvoice_autoSnapshotsSeatsWhenNotProvided() {
        when(organizationRepository.existsById(ORG_ID)).thenReturn(true);
        when(memberRepo.countByIdOrgIdAndRoleAndStatus(ORG_ID, "STUDENT", "ACTIVE")).thenReturn(37L);
        when(invoiceRepo.save(any(OrgInvoice.class))).thenReturn(savedInvoice(INVOICE_ID, ORG_ID, "DRAFT"));

        CreateInvoiceRequest req = new CreateInvoiceRequest(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), 0, 5_000_000L, "auto-seat");
        service.createInvoice(ORG_ID, req, CREATED_BY);

        ArgumentCaptor<OrgInvoice> captor = ArgumentCaptor.forClass(OrgInvoice.class);
        verify(invoiceRepo).save(captor.capture());
        assertThat(captor.getValue().getSeats()).isEqualTo(37);
    }

    @Test
    @DisplayName("createInvoice: D-3/G — admin-provided seats>0 are respected, no snapshot")
    void createInvoice_respectsExplicitSeats() {
        when(organizationRepository.existsById(ORG_ID)).thenReturn(true);
        when(invoiceRepo.save(any(OrgInvoice.class))).thenReturn(savedInvoice(INVOICE_ID, ORG_ID, "DRAFT"));

        CreateInvoiceRequest req = new CreateInvoiceRequest(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), 50, 5_000_000L, "explicit-seat");
        service.createInvoice(ORG_ID, req, CREATED_BY);

        ArgumentCaptor<OrgInvoice> captor = ArgumentCaptor.forClass(OrgInvoice.class);
        verify(invoiceRepo).save(captor.capture());
        assertThat(captor.getValue().getSeats()).isEqualTo(50);
        verify(memberRepo, org.mockito.Mockito.never())
                .countByIdOrgIdAndRoleAndStatus(any(), any(), any());
    }

    // ------------------------------------------------------------------ listInvoices

    @Test
    @DisplayName("listInvoices: maps repository rows to DTOs preserving order")
    void listInvoices_mapsRepoRows() {
        OrgInvoice inv1 = savedInvoice(10L, ORG_ID, "PAID");
        OrgInvoice inv2 = savedInvoice(11L, ORG_ID, "DRAFT");
        when(invoiceRepo.findByOrgIdOrderByCreatedAtDesc(ORG_ID)).thenReturn(List.of(inv1, inv2));

        List<OrgInvoiceDto> result = service.listInvoices(ORG_ID);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).id()).isEqualTo(10L);
        assertThat(result.get(0).status()).isEqualTo("PAID");
        assertThat(result.get(1).id()).isEqualTo(11L);
        assertThat(result.get(1).status()).isEqualTo("DRAFT");
    }

    @Test
    @DisplayName("listInvoices: returns empty list when org has no invoices")
    void listInvoices_empty() {
        when(invoiceRepo.findByOrgIdOrderByCreatedAtDesc(ORG_ID)).thenReturn(List.of());

        List<OrgInvoiceDto> result = service.listInvoices(ORG_ID);

        assertThat(result).isEmpty();
    }

    // ------------------------------------------------------------------ updateStatus — forbidden

    @Test
    @DisplayName("updateStatus: throws ForbiddenException when invoiceOrgId != caller orgId")
    void updateStatus_foreignOrgId_throwsForbidden() {
        OrgInvoice inv = savedInvoice(INVOICE_ID, ORG_ID, "DRAFT");
        when(invoiceRepo.findById(INVOICE_ID)).thenReturn(Optional.of(inv));

        // Caller claims OTHER_ORG_ID but invoice belongs to ORG_ID
        assertThatThrownBy(() -> service.updateStatus(OTHER_ORG_ID, INVOICE_ID, "SENT"))
                .isInstanceOf(ForbiddenException.class);
    }

    // ------------------------------------------------------------------ updateStatus — bad request

    @Test
    @DisplayName("updateStatus: throws BadRequestException for an unknown status string")
    void updateStatus_invalidStatus_throwsBadRequest() {
        OrgInvoice inv = savedInvoice(INVOICE_ID, ORG_ID, "DRAFT");
        when(invoiceRepo.findById(INVOICE_ID)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> service.updateStatus(ORG_ID, INVOICE_ID, "INVALID_STATUS"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("updateStatus: throws BadRequestException for null status")
    void updateStatus_nullStatus_throwsBadRequest() {
        OrgInvoice inv = savedInvoice(INVOICE_ID, ORG_ID, "DRAFT");
        when(invoiceRepo.findById(INVOICE_ID)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> service.updateStatus(ORG_ID, INVOICE_ID, null))
                .isInstanceOf(BadRequestException.class);
    }

    // ------------------------------------------------------------------ updateStatus — happy path

    @Test
    @DisplayName("updateStatus: happy path sets the new status and returns updated DTO")
    void updateStatus_happyPath_setsStatus() {
        OrgInvoice inv = savedInvoice(INVOICE_ID, ORG_ID, "DRAFT");
        when(invoiceRepo.findById(INVOICE_ID)).thenReturn(Optional.of(inv));
        when(invoiceRepo.save(any(OrgInvoice.class))).thenAnswer(i -> i.getArgument(0));

        OrgInvoiceDto dto = service.updateStatus(ORG_ID, INVOICE_ID, "SENT");

        assertThat(dto.status()).isEqualTo("SENT");
        assertThat(dto.id()).isEqualTo(INVOICE_ID);
        assertThat(dto.orgId()).isEqualTo(ORG_ID);
    }

    @Test
    @DisplayName("updateStatus: all valid statuses are accepted (DRAFT, SENT, PAID, VOID)")
    void updateStatus_allValidStatuses_accepted() {
        for (String status : List.of("DRAFT", "SENT", "PAID", "VOID")) {
            OrgInvoice inv = savedInvoice(INVOICE_ID, ORG_ID, "DRAFT");
            when(invoiceRepo.findById(INVOICE_ID)).thenReturn(Optional.of(inv));
            when(invoiceRepo.save(any(OrgInvoice.class))).thenAnswer(i -> i.getArgument(0));

            OrgInvoiceDto dto = service.updateStatus(ORG_ID, INVOICE_ID, status);
            assertThat(dto.status()).isEqualTo(status);
        }
    }
}
