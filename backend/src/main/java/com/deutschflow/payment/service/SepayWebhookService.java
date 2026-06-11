package com.deutschflow.payment.service;

import com.deutschflow.organization.entity.OrgInvoice;
import com.deutschflow.organization.entity.OrgPaymentEvent;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrgInvoiceRepository;
import com.deutschflow.organization.repository.OrgPaymentEventRepository;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.organization.service.AdminOrgService;
import com.deutschflow.payment.dto.SepayWebhookPayload;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Processes SePay bank-transfer webhooks to auto-settle org invoices (checklist C3).
 *
 * <p>On an incoming transfer it parses the invoice payment-code from the memo, marks the matching
 * {@link OrgInvoice} PAID, and activates the org's licence (status ACTIVE + extend {@code validUntil}
 * + re-grant member entitlements via {@link AdminOrgService#activateEntitlements}). Every delivery is
 * logged in {@code org_payment_events}; the UNIQUE {@code sepay_id} makes redeliveries idempotent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SepayWebhookService {

    private static final String TRANSFER_IN = "in";
    private static final String STATUS_PAID = "PAID";
    private static final String STATUS_ACTIVE = "ACTIVE";
    /** Statuses a transfer may settle. PAID/VOID are NOT settleable (a late transfer must not
     *  re-pay a settled invoice nor revive a voided one). */
    private static final Set<String> SETTLEABLE_STATUSES = Set.of("DRAFT", "SENT");
    /** Invoice payment-code shape (see OrgBillingService.newPaymentCode): DFINV + 12 hex, uppercase. */
    private static final Pattern PAYMENT_CODE = Pattern.compile("DFINV[0-9A-F]{12}");

    private final OrgInvoiceRepository invoiceRepo;
    private final OrgPaymentEventRepository eventRepo;
    private final OrganizationRepository organizationRepository;
    private final AdminOrgService adminOrgService;

    @Transactional
    public void handle(SepayWebhookPayload payload) {
        if (payload == null || payload.id() == null) {
            log.warn("[SePay] webhook missing transaction id — ignored");
            return;
        }
        String sepayId = String.valueOf(payload.id());
        if (eventRepo.existsBySepayId(sepayId)) {
            log.info("[SePay] duplicate webhook txn={} — no-op", sepayId);
            return; // idempotent
        }
        long amount = payload.transferAmount() == null ? 0L : payload.transferAmount();

        // Only money received can settle an invoice.
        if (!TRANSFER_IN.equalsIgnoreCase(payload.transferType())) {
            recordEvent(sepayId, null, null, amount, payload, false);
            return;
        }

        String code = extractPaymentCode(payload);
        OrgInvoice invoice = code == null ? null
                : invoiceRepo.findByPaymentCode(code).orElse(null);

        if (invoice == null) {
            log.warn("[SePay] no invoice matched (code={}, content='{}', amount={})", code, payload.content(), amount);
            recordEvent(sepayId, null, null, amount, payload, false);
            return;
        }

        recordEvent(sepayId, invoice.getId(), invoice.getOrgId(), amount, payload, true);

        if (!SETTLEABLE_STATUSES.contains(invoice.getStatus())) {
            log.info("[SePay] invoice {} status={} not settleable — transfer recorded only",
                    invoice.getId(), invoice.getStatus());
            return;
        }
        if (amount < invoice.getAmountVnd()) {
            log.warn("[SePay] underpaid invoice {} ({} < {}) — left unpaid", invoice.getId(), amount, invoice.getAmountVnd());
            return;
        }

        invoice.setStatus(STATUS_PAID);
        invoiceRepo.save(invoice);
        activateOrg(invoice);
        log.info("[SePay] invoice {} PAID, org {} activated (amount={})", invoice.getId(), invoice.getOrgId(), amount);
    }

    private void activateOrg(OrgInvoice invoice) {
        Organization org = organizationRepository.findById(invoice.getOrgId()).orElse(null);
        if (org == null) {
            log.warn("[SePay] paid invoice {} references missing org {}", invoice.getId(), invoice.getOrgId());
            return;
        }
        org.setStatus(STATUS_ACTIVE);
        // Extend the licence to the paid period end; never shorten a longer existing licence.
        if (invoice.getPeriodEnd() != null) {
            Instant newEnd = invoice.getPeriodEnd().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            if (org.getValidUntil() == null || newEnd.isAfter(org.getValidUntil())) {
                org.setValidUntil(newEnd);
            }
        }
        organizationRepository.save(org);
        adminOrgService.activateEntitlements(org.getId());
    }

    private void recordEvent(String sepayId, Long invoiceId, Long orgId, long amount,
                             SepayWebhookPayload payload, boolean matched) {
        eventRepo.save(OrgPaymentEvent.builder()
                .sepayId(sepayId)
                .invoiceId(invoiceId)
                .orgId(orgId)
                .amountVnd(amount)
                .content(payload.content())
                .gateway(payload.gateway())
                .matched(matched)
                .build());
    }

    /** Prefer SePay's pre-parsed {@code code}, else scan the raw memo. */
    private String extractPaymentCode(SepayWebhookPayload payload) {
        String fromCode = matchPaymentCode(payload.code());
        return fromCode != null ? fromCode : matchPaymentCode(payload.content());
    }

    private String matchPaymentCode(String value) {
        if (value == null) {
            return null;
        }
        Matcher matcher = PAYMENT_CODE.matcher(value.toUpperCase(Locale.ROOT));
        return matcher.find() ? matcher.group() : null;
    }
}
