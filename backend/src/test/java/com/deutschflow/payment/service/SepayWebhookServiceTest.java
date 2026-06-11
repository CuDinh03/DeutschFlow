package com.deutschflow.payment.service;

import com.deutschflow.organization.entity.OrgInvoice;
import com.deutschflow.organization.entity.OrgPaymentEvent;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgInvoiceRepository;
import com.deutschflow.organization.repository.OrgPaymentEventRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.AdminOrgService;
import com.deutschflow.payment.dto.SepayWebhookPayload;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Khoá hành vi webhook SePay (C3): khớp invoice theo paymentCode → PAID + kích hoạt org;
 * idempotent theo sepayId; bỏ qua transfer ra / không khớp / thiếu tiền / đã PAID.
 */
@ExtendWith(MockitoExtension.class)
class SepayWebhookServiceTest {

    private static final String CODE = "DFINVA1B2C3D4"; // DFINV + 8 hex

    @Mock OrgInvoiceRepository invoiceRepo;
    @Mock OrgPaymentEventRepository eventRepo;
    @Mock OrganizationRepository organizationRepository;
    @Mock AdminOrgService adminOrgService;

    @InjectMocks SepayWebhookService service;

    private SepayWebhookPayload payload(long id, String type, long amount, String content) {
        return new SepayWebhookPayload(id, "VCB", "2026-06-11", "0123", null, content,
                type, amount, null, null, "REF" + id, content);
    }

    private OrgInvoice invoice(String status, long amount) {
        return OrgInvoice.builder()
                .id(7L).orgId(5L).status(status).amountVnd(amount).paymentCode(CODE)
                .periodEnd(LocalDate.of(2026, 12, 31)).build();
    }

    @Test
    @DisplayName("match → invoice PAID + org ACTIVE + extend validUntil + re-grant members + event matched")
    void handle_matchesAndActivates() {
        OrgInvoice inv = invoice("SENT", 1_000_000L);
        Organization org = Organization.builder().id(5L).name("TT ABC").slug("abc").status("SUSPENDED").build();
        when(eventRepo.existsBySepayId("100")).thenReturn(false);
        when(invoiceRepo.findByPaymentCode(CODE)).thenReturn(Optional.of(inv));
        when(organizationRepository.findById(5L)).thenReturn(Optional.of(org));

        service.handle(payload(100L, "in", 1_000_000L, "CK " + CODE + " thanh toan goi"));

        assertThat(inv.getStatus()).isEqualTo("PAID");
        assertThat(org.getStatus()).isEqualTo("ACTIVE");
        assertThat(org.getValidUntil()).isNotNull();
        verify(invoiceRepo).save(inv);
        verify(organizationRepository).save(org);
        verify(adminOrgService).activateEntitlements(5L);
        ArgumentCaptor<OrgPaymentEvent> ev = ArgumentCaptor.forClass(OrgPaymentEvent.class);
        verify(eventRepo).save(ev.capture());
        assertThat(ev.getValue().isMatched()).isTrue();
        assertThat(ev.getValue().getInvoiceId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("idempotent: sepayId đã xử lý → no-op hoàn toàn")
    void handle_duplicate_noOp() {
        when(eventRepo.existsBySepayId("100")).thenReturn(true);

        service.handle(payload(100L, "in", 1_000_000L, "CK " + CODE));

        verifyNoInteractions(invoiceRepo, organizationRepository, adminOrgService);
        verify(eventRepo, never()).save(any());
    }

    @Test
    @DisplayName("transfer ra (out) → ghi event không khớp, không động vào invoice")
    void handle_outgoing_recordedUnmatched() {
        when(eventRepo.existsBySepayId("101")).thenReturn(false);

        service.handle(payload(101L, "out", 1_000_000L, "phi dich vu"));

        ArgumentCaptor<OrgPaymentEvent> ev = ArgumentCaptor.forClass(OrgPaymentEvent.class);
        verify(eventRepo).save(ev.capture());
        assertThat(ev.getValue().isMatched()).isFalse();
        verifyNoInteractions(invoiceRepo, organizationRepository, adminOrgService);
    }

    @Test
    @DisplayName("không khớp invoice → event không khớp, không kích hoạt")
    void handle_noInvoice_recordedUnmatched() {
        when(eventRepo.existsBySepayId("102")).thenReturn(false);
        when(invoiceRepo.findByPaymentCode(CODE)).thenReturn(Optional.empty());

        service.handle(payload(102L, "in", 1_000_000L, "CK " + CODE));

        ArgumentCaptor<OrgPaymentEvent> ev = ArgumentCaptor.forClass(OrgPaymentEvent.class);
        verify(eventRepo).save(ev.capture());
        assertThat(ev.getValue().isMatched()).isFalse();
        verify(invoiceRepo, never()).save(any());
        verifyNoInteractions(organizationRepository, adminOrgService);
    }

    @Test
    @DisplayName("thiếu tiền (amount < hoá đơn) → KHÔNG đánh PAID, KHÔNG kích hoạt")
    void handle_underpaid_notPaid() {
        OrgInvoice inv = invoice("SENT", 2_000_000L);
        when(eventRepo.existsBySepayId("103")).thenReturn(false);
        when(invoiceRepo.findByPaymentCode(CODE)).thenReturn(Optional.of(inv));

        service.handle(payload(103L, "in", 1_000_000L, "CK " + CODE));

        assertThat(inv.getStatus()).isEqualTo("SENT");
        verify(invoiceRepo, never()).save(any());
        verifyNoInteractions(organizationRepository, adminOrgService);
    }

    @Test
    @DisplayName("hoá đơn đã PAID → ghi event, KHÔNG kích hoạt lại")
    void handle_alreadyPaid_noReactivate() {
        OrgInvoice inv = invoice("PAID", 1_000_000L);
        when(eventRepo.existsBySepayId("104")).thenReturn(false);
        when(invoiceRepo.findByPaymentCode(CODE)).thenReturn(Optional.of(inv));

        service.handle(payload(104L, "in", 1_000_000L, "CK " + CODE));

        verify(invoiceRepo, never()).save(any());
        verifyNoInteractions(organizationRepository, adminOrgService);
        verify(eventRepo).save(any());
    }
}
