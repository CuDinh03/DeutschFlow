package com.deutschflow.payment.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
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
import java.util.Map;
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

    /** Actor cho đường webhook tự động — không có người bấm nút. */
    private static final AuditActor SEPAY_WEBHOOK_ACTOR =
            new AuditActor(null, "sepay-webhook", "SYSTEM");

    private static final String TRANSFER_IN = "in";
    private static final String STATUS_PAID = "PAID";
    private static final String STATUS_ACTIVE = "ACTIVE";
    /** Statuses a transfer may settle. PAID/VOID are NOT settleable (a late transfer must not
     *  re-pay a settled invoice nor revive a voided one). */
    private static final Set<String> SETTLEABLE_STATUSES = Set.of("DRAFT", "SENT");
    /** Invoice payment-code shape (see OrgBillingService.newPaymentCode): DFINV + 12 hex, uppercase. */
    private static final Pattern PAYMENT_CODE = Pattern.compile("DFINV[0-9A-F]{12}");
    /**
     * CÙNG một tên sự kiện với đường bấm tay ({@code AdminOrgService.activateForPaidInvoice}), có
     * chủ ý: với giám đốc thì "giấy phép của tôi được kích hoạt vì hoá đơn X đã thu" là MỘT sự kiện
     * nghiệp vụ, dù tiền vào qua ngân hàng hay do admin đối soát tay. Lọc một tên là ra đủ lịch sử
     * kích hoạt; ai làm thì đọc ở cột actor ({@code sepay-webhook/SYSTEM} so với email admin).
     */
    private static final String EVENT_LICENCE_ACTIVATED = "admin.org.licence.activated_by_invoice";

    private final OrgInvoiceRepository invoiceRepo;
    private final OrgPaymentEventRepository eventRepo;
    private final OrganizationRepository organizationRepository;
    private final AdminOrgService adminOrgService;
    private final AuditLogService auditLogService;

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
        org.changeStatus(STATUS_ACTIVE);
        // Extend the licence to the paid period end; never shorten a longer existing licence.
        if (invoice.getPeriodEnd() != null) {
            Instant newEnd = invoice.getPeriodEnd().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            if (org.getValidUntil() == null || newEnd.isAfter(org.getValidUntil())) {
                org.setValidUntil(newEnd);
            }
        }
        organizationRepository.save(org);
        // DEC-13 (09/09/2026) — LỖ HỔNG của đường TỰ ĐỘNG, vá tại đây.
        //
        // Đường bấm tay (AdminOrgService.activateForPaidInvoice) ghi một vết riêng cho việc KÍCH
        // HOẠT GIẤY PHÉP: hoá đơn nào, kỳ tới đâu, validUntil mới là bao giờ. Đường webhook thì
        // không — nó chỉ gọi activateEntitlements, tức chỉ để lại vết "đã cấp lại quyền lợi cho N
        // học viên". Hệ quả: khi tiền vào qua ngân hàng (đường THƯỜNG GẶP), giám đốc không đọc
        // được "cái gì đã kích hoạt giấy phép của tôi và gia hạn tới ngày nào" — đúng câu hỏi hay
        // phải trả lời nhất lúc tranh chấp thanh toán.
        //
        // Actor là SEPAY_WEBHOOK_ACTOR (id null) nên đường suy-từ-actor không có gì để suy; orgId
        // phải truyền tường minh, nếu không vết mới này cũng vô hình y như cũ.
        auditLogService.log(EVENT_LICENCE_ACTIVATED, SEPAY_WEBHOOK_ACTOR,
                "ORG", String.valueOf(org.getId()),
                org.getId(),
                Map.of(
                        "invoiceId", invoice.getId(),
                        "periodEnd", String.valueOf(invoice.getPeriodEnd()),
                        "validUntil", String.valueOf(org.getValidUntil()),
                        "paymentCode", String.valueOf(invoice.getPaymentCode())
                ));
        // Audit F-M3 (03/09/2026): đường TỰ ĐỘNG (webhook ngân hàng) không có người thao tác. Ghi
        // actor hệ thống thay vì để rỗng, để nhật ký phân biệt được "máy kích hoạt" với "admin
        // kích hoạt bằng tay" — hai việc có trách nhiệm rất khác nhau khi đối soát.
        adminOrgService.activateEntitlements(org.getId(), SEPAY_WEBHOOK_ACTOR);
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
