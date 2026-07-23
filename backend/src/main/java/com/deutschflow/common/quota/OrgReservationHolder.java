package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService.OrgReservation;

import java.util.function.Consumer;

/**
 * Suất giữ chỗ pool org của REQUEST hiện tại (H-3 reserve-then-reconcile), truyền từ gate
 * ({@code QuotaService.assertAllowed} / {@code OrgPoolGuard}) tới charge
 * ({@code AiUsageLedgerService.chargeOrgPoolAndWallet}) mà không phải đổi chữ ký ~25 call-site
 * ở giữa.
 *
 * <p>Vòng đời một request:
 * <ol>
 *   <li>Gate reserve thành công → {@link #replace} (hoàn trả suất cũ nếu request đi qua 2 gate).</li>
 *   <li>Charge chạy CÙNG thread → {@link #take} → ghi delta = actual − reserved.</li>
 *   <li>Charge chạy Ở THREAD KHÁC (job async, SSE executor) → holder còn nguyên →
 *       {@code OrgReservationRefundFilter} hoàn trả ở cuối request; job charge đủ số thật —
 *       net vẫn đúng, không double-count.</li>
 *   <li>LLM ném exception / request chết giữa chừng → filter hoàn trả.</li>
 * </ol>
 *
 * <p>ThreadLocal LUÔN được filter {@code remove()} trong finally — an toàn với thread-pool reuse.
 */
public final class OrgReservationHolder {

    private static final ThreadLocal<OrgReservation> CURRENT = new ThreadLocal<>();

    private OrgReservationHolder() {
    }

    /**
     * Đặt suất giữ chỗ của request hiện tại; suất cũ còn treo (request đi qua cả OrgPoolGuard lẫn
     * assertAllowed) được hoàn trả qua {@code refunder} trước khi thay — chống giữ chỗ kép.
     */
    public static void replace(OrgReservation next, Consumer<OrgReservation> refunder) {
        OrgReservation prev = CURRENT.get();
        if (prev != null && prev.metered()) {
            refunder.accept(prev);
        }
        CURRENT.set(next);
    }

    /** Lấy VÀ xoá suất của thread hiện tại (charge tiêu thụ, hoặc filter hoàn trả). Null nếu không có. */
    public static OrgReservation take() {
        OrgReservation r = CURRENT.get();
        CURRENT.remove();
        return r;
    }
}
