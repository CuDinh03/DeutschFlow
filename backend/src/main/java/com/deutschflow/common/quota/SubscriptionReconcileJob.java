package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgEntitlementService;
import com.deutschflow.organization.service.OrgLicenseState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/**
 * Background reconciler for user subscription lifecycle (S-4).
 *
 * <p>Keeps the hot-path ({@code QuotaService.assertAllowed}) read-only by handling subscription
 * state writes asynchronously: setting FREE trial {@code ends_at}, ending expired subscriptions,
 * and provisioning DEFAULT when no active plan exists.
 *
 * <p>Runs every 10 minutes — well within the 7-day FREE trial window, so the virtual expiry
 * check in {@code assertAllowed} is only a transient safety net.
 *
 * <p>Cũng là nơi THI HÀNH MỐC CẮT của giấy phép trung tâm
 * ({@link #cutLapsedOrganizations}): hết ân hạn thì không có ai bấm nút, chỉ có đồng hồ — nên việc
 * đó phải do vòng quét nền phát hiện, xem {@link OrgLicenseState}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SubscriptionReconcileJob {

    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;
    private final OrgEntitlementService orgEntitlementService;

    @Scheduled(cron = "0 */10 * * * *")
    @SchedulerLock(name = "subscriptionReconcile", lockAtMostFor = "PT9M", lockAtLeastFor = "PT0S")
    public void reconcileStaleSubscriptions() {
        Instant now = Instant.now();
        expireOrgEntitlements(now);
        cutLapsedOrganizations(now);

        // Users with subscriptions that likely need reconciliation:
        // - FREE with no ends_at (trial never got expiry set)
        // - FREE with expired ends_at still ACTIVE
        // - PRO/ULTRA past their 30-day period (may need ENDED if wallet empty)
        List<Long> userIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT user_id FROM user_subscriptions
                WHERE status = 'ACTIVE'
                  AND (
                    (plan_code = 'FREE' AND (ends_at IS NULL OR ends_at <= ?))
                    OR (plan_code IN ('PRO', 'ULTRA') AND ends_at IS NOT NULL AND ends_at <= ?)
                  )
                LIMIT 500
                """, Long.class, Timestamp.from(now), Timestamp.from(now));

        if (userIds.isEmpty()) {
            return;
        }

        int succeeded = 0;
        int failed = 0;
        for (Long userId : userIds) {
            try {
                quotaService.reconcileForUser(userId, now);
                succeeded++;
            } catch (Exception e) {
                log.warn("[SubscriptionReconcileJob] userId={}: {}", userId, e.getMessage());
                failed++;
            }
        }
        log.info("[SubscriptionReconcileJob] Reconciled {}/{} subscriptions ({} failed)",
                succeeded, userIds.size(), failed);
    }

    /**
     * Giấy phép trung tâm hết hạn (DEC-09, PR-A4): kết thúc quyền lợi ORG rồi khôi phục gói cá nhân
     * đang tạm dừng.
     *
     * <p>Phải là vòng quét RIÊNG chứ không ghép vào truy vấn bên dưới: truy vấn đó lọc theo
     * {@code plan_code}, mà gói của trung tâm mang chính plan_code PRO/ULTRA nên sẽ rơi vào nhánh
     * "hết hạn nhưng còn ví thì gia hạn ân huệ" — nhánh ấy giữ dòng ORG sống thêm và không bao giờ
     * trả gói cá nhân về.
     *
     * <p><b>Khác {@link #cutLapsedOrganizations}:</b> vòng này đi theo {@code ends_at} của CHÍNH
     * dòng thuê bao (đúng bằng {@code valid_until} của trung tâm), nên nó dọn đúng lúc quyền lợi
     * hết giá trị và TRẢ gói cá nhân đang tạm dừng về cho học viên. Cố ý KHÔNG hoãn nó thêm 7 ngày
     * ân hạn: dòng ORG đã hết hạn thì hạn mức cũng đã hết, hoãn chỉ giam gói cá nhân của học viên
     * thêm một tuần chứ không cho họ thêm gì. Ân hạn 7 ngày là ân hạn của TRUNG TÂM (quyền ghi +
     * mốc cắt), không phải của dòng thuê bao.
     */
    private void expireOrgEntitlements(Instant now) {
        List<Long> userIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT user_id FROM user_subscriptions
                WHERE source = 'ORG' AND status = 'ACTIVE'
                  AND ends_at IS NOT NULL AND ends_at <= ?
                LIMIT 500
                """, Long.class, Timestamp.from(now));
        if (userIds.isEmpty()) {
            return;
        }
        int done = 0;
        for (Long userId : userIds) {
            try {
                orgEntitlementService.expireAndResume(userId);
                done++;
            } catch (Exception e) {
                log.warn("[SubscriptionReconcileJob][ORG] userId={}: {}", userId, e.getMessage());
            }
        }
        log.info("[SubscriptionReconcileJob][ORG] Hết hạn giấy phép trung tâm: xử lý {}/{} người dùng",
                done, userIds.size());
    }
    /**
     * THI HÀNH MỐC CẮT của máy trạng thái giấy phép ({@link OrgLicenseState.Mode#CUT}): quá 7 ngày
     * kể từ mốc neo — {@code valid_until} với trung tâm hết hạn, {@code suspended_at} với trung tâm
     * bị đình chỉ — thì thu hồi quyền lợi gói ORG của mọi học viên và trả gói cá nhân đang tạm dừng
     * về cho họ.
     *
     * <p><b>Vì sao việc này nằm ở JOB chứ không ở chỗ bấm nút:</b> trước 09/09/2026
     * {@code AdminOrgService} thu hồi ngay tại giây đình chỉ. Owner chốt đình chỉ cũng phải có 7
     * ngày ân hạn CHỈ-ĐỌC, mà thời điểm hết ân hạn thì không có ai bấm nút cả — chỉ có đồng hồ.
     * Nên mốc cắt phải do vòng quét nền phát hiện. Không nối vào đây thì {@code CUT} chỉ là một mức
     * enum không cơ chế nào đọc tới — mã chết ngay lúc sinh ra.
     *
     * <p>Luật 7 ngày CỐ Ý không viết lại thành SQL: câu dưới chỉ lọc thô ứng viên (đình chỉ, hoặc
     * đã qua hạn) và <b>còn thứ để cắt</b>; quyết định cắt hay chưa vẫn do
     * {@link OrgLicenseState#evaluate} — một luật, một chỗ. Trung tâm đã cắt xong rụng khỏi tập ứng
     * viên ở lần quét sau (không còn dòng ORG nào ACTIVE), nên vòng này tự thu hẹp.
     *
     * <p>Đường ĐỌC không hề bị đụng tới: cắt ở đây là thu hồi QUYỀN LỢI GÓI, không phải khoá trung
     * tâm khỏi dữ liệu của chính họ (D5).
     *
     * <p>Package-private CÓ CHỦ Ý: integration test gọi thẳng hàm này thay vì
     * {@link #reconcileStaleSubscriptions()}, vì hàm kia mang {@code @SchedulerLock} — không lấy
     * được khoá thì ShedLock bỏ qua trong IM LẶNG và test sẽ xanh mà chẳng chạy gì.
     */
    void cutLapsedOrganizations(Instant now) {
        List<OrgLicenseRow> candidates = jdbcTemplate.query("""
                SELECT DISTINCT o.id, o.status, o.valid_until, o.suspended_at
                FROM organizations o
                JOIN org_members m
                  ON m.org_id = o.id AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
                JOIN user_subscriptions s
                  ON s.user_id = m.user_id AND s.source = 'ORG' AND s.status = 'ACTIVE'
                WHERE o.status IS DISTINCT FROM 'ACTIVE'
                   OR (o.valid_until IS NOT NULL AND o.valid_until <= ?)
                LIMIT 500
                """,
                (rs, i) -> new OrgLicenseRow(rs.getLong(1), rs.getString(2),
                        toInstant(rs.getTimestamp(3)), toInstant(rs.getTimestamp(4))),
                Timestamp.from(now));
        for (OrgLicenseRow org : candidates) {
            if (!OrgLicenseState.evaluate(org.status(), org.validUntil(), org.suspendedAt(), now).cut()) {
                continue; // còn trong ân hạn chỉ-đọc — chưa tới mốc cắt
            }
            cutOrgEntitlements(org, now);
        }
    }

    /** Thu hồi quyền lợi ORG của mọi học viên còn đang giữ, cho MỘT trung tâm đã quá ân hạn. */
    private void cutOrgEntitlements(OrgLicenseRow org, Instant now) {
        List<Long> userIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT m.user_id
                FROM org_members m
                JOIN user_subscriptions s
                  ON s.user_id = m.user_id AND s.source = 'ORG' AND s.status = 'ACTIVE'
                WHERE m.org_id = ? AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
                LIMIT 500
                """, Long.class, org.id());
        int done = 0;
        for (Long userId : userIds) {
            try {
                orgEntitlementService.revokeStudent(userId);
                done++;
            } catch (Exception e) {
                log.warn("[SubscriptionReconcileJob][CUT] orgId={} userId={}: {}",
                        org.id(), userId, e.getMessage());
            }
        }
        if (done > 0) {
            log.info("[SubscriptionReconcileJob][CUT] Trung tâm {} quá {} ngày ân hạn tính tới {}"
                    + " (status={}, validUntil={}, suspendedAt={}) — thu hồi quyền lợi {}/{} học viên",
                    org.id(), OrgLicenseState.GRACE.toDays(), now, org.status(), org.validUntil(),
                    org.suspendedAt(), done, userIds.size());
        }
    }

    /** Ba mảnh giấy phép của một trung tâm — đủ để {@link OrgLicenseState#evaluate} quyết định. */
    private record OrgLicenseRow(long id, String status, Instant validUntil, Instant suspendedAt) {}

    private static Instant toInstant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
