package com.deutschflow.common.quota;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.deutschflow.organization.service.OrgQuotaService;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuotaServiceUnitTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    // Chỉ để thoả constructor — các test ở đây không đi qua assertAllowed nên tryReserve
    // (gate org H-3) không bao giờ được gọi trên mock này.
    @Mock
    OrgQuotaService orgQuotaService;

    @InjectMocks
    QuotaService quotaService;

    @Test
    void applyUsageDebit_zeroTokens_doesNothing() {
        quotaService.applyUsageDebit(123L, 0, Instant.now());
        verify(jdbcTemplate, never()).update(anyString(), any(), any());
    }

    @Test
    void applyUsageDebit_negativeTokens_doesNothing() {
        quotaService.applyUsageDebit(123L, -5L, Instant.now());
        verify(jdbcTemplate, never()).update(anyString(), any(), any());
    }

    /**
     * V-06: hợp đồng công khai chỉ có ba nhãn. Mọi giá trị nội bộ khác (TRIAL, DEFAULT, UNKNOWN,
     * cổng thanh toán web…) phải gộp về WEB — client dùng nhãn này để quyết định có hiện
     * huỷ/hoàn tiền Apple hay không, nên "không biết" phải là WEB chứ không phải ORG.
     */
    @Test
    void publicSource_mapsOnlyOrgAndAppleThroughRestAreWeb() {
        assertThat(QuotaService.publicSource("ORG")).isEqualTo("ORG");
        assertThat(QuotaService.publicSource("APPLE")).isEqualTo("APPLE");
        assertThat(QuotaService.publicSource("TRIAL")).isEqualTo("WEB");
        assertThat(QuotaService.publicSource("DEFAULT")).isEqualTo("WEB");
        assertThat(QuotaService.publicSource("UNKNOWN")).isEqualTo("WEB");
        assertThat(QuotaService.publicSource(null)).isEqualTo("WEB");
    }
}
