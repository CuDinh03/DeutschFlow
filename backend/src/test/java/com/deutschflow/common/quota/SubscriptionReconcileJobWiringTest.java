package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgEntitlementService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Chốt DÂY NỐI giữa vòng quét định kỳ và mốc CẮT của giấy phép trung tâm.
 *
 * <p>{@code OrgLicenseState.Mode.CUT} chỉ có nghĩa vì {@code reconcileStaleSubscriptions} gọi
 * {@code cutLapsedOrganizations}. Đó là ĐÚNG MỘT dòng, và
 * {@code OrgLicenceCutIntegrationTest} cố ý gọi thẳng hàm quét (để không dính bẫy
 * {@code @SchedulerLock} bỏ qua trong im lặng) nên nó KHÔNG bảo vệ dòng ấy: gỡ dòng đi thì mọi ca
 * còn lại vẫn xanh và mức CUT lặng lẽ trở thành enum chết. Đây là chỗ bắt việc đó.
 *
 * <p>Gọi trên instance trần (không qua proxy Spring) nên {@code @SchedulerLock} không có tác dụng —
 * đúng ý đồ: ở đây chỉ cần biết hàm cha có gọi hàm con hay không.
 */
@DisplayName("SubscriptionReconcileJob — vòng quét định kỳ có thi hành mốc CẮT")
class SubscriptionReconcileJobWiringTest {

    @Test
    @DisplayName("reconcileStaleSubscriptions PHẢI chạy vòng quét mốc cắt giấy phép trung tâm")
    @SuppressWarnings("unchecked")
    void reconcile_runsLicenceCutSweep() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        QuotaService quotaService = mock(QuotaService.class);
        OrgEntitlementService orgEntitlementService = mock(OrgEntitlementService.class);
        SubscriptionReconcileJob job =
                new SubscriptionReconcileJob(jdbc, quotaService, orgEntitlementService);

        // Không có ứng viên nào: bài này chốt dây nối, không chốt lại luật ân hạn (đã có IT lo).
        when(jdbc.queryForList(anyString(), any(Class.class), any(Object[].class)))
                .thenReturn(List.of());
        ArgumentCaptor<String> cutSql = ArgumentCaptor.forClass(String.class);
        when(jdbc.query(cutSql.capture(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());

        job.reconcileStaleSubscriptions();

        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
        assertThat(cutSql.getAllValues())
                .as("vòng quét mốc cắt phải đọc đủ ba mảnh giấy phép của trung tâm")
                .anyMatch(sql -> sql.contains("organizations")
                        && sql.contains("suspended_at")
                        && sql.contains("valid_until"));
    }
}
