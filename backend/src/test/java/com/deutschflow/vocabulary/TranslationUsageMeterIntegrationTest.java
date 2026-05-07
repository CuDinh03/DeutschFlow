package com.deutschflow.vocabulary;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.testsupport.TestcontainersPostgresConditions;
import com.deutschflow.vocabulary.service.TranslationUsageMeter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.YearMonth;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@EnabledIf("com.deutschflow.testsupport.TestcontainersPostgresConditions#integrationPostgresAvailable")
class TranslationUsageMeterIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PROVIDER = "USAGE_METER_IT";
    private static final YearMonth YM = YearMonth.of(2030, 4);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TranslationUsageMeter meter;

    @BeforeEach
    @AfterEach
    void purgeTestRows() {
        jdbcTemplate.update(
                "DELETE FROM translation_provider_monthly_usage WHERE provider = ? AND billing_month = ?",
                PROVIDER,
                YM.toString());
    }

    @Test
    void tryConsume_withinMonthlyCap_accumulates() {
        assertThat(meter.tryConsume(PROVIDER, YM, 100, 500)).isTrue();
        assertThat(meter.currentUsage(PROVIDER, YM)).isEqualTo(100L);

        assertThat(meter.tryConsume(PROVIDER, YM, 400, 500)).isTrue();
        assertThat(meter.currentUsage(PROVIDER, YM)).isEqualTo(500L);
    }

    @Test
    void tryConsume_exceedingCap_returnsFalseWithoutPartialApply() {
        assertThat(meter.tryConsume(PROVIDER, YM, 400, 500)).isTrue();
        assertThat(meter.tryConsume(PROVIDER, YM, 200, 500)).isFalse();
        assertThat(meter.currentUsage(PROVIDER, YM)).isEqualTo(400L);

        assertThat(meter.tryConsume(PROVIDER, YM, 100, 500)).isTrue();
        assertThat(meter.currentUsage(PROVIDER, YM)).isEqualTo(500L);
        assertThat(meter.tryConsume(PROVIDER, YM, 1, 500)).isFalse();
    }

    @Test
    void tryConsume_nonPositive_returnsTrue_withoutWrite() {
        assertThat(meter.tryConsume(PROVIDER, YM, 0, 100)).isTrue();
        assertThat(meter.tryConsume(PROVIDER, YM, -5, 100)).isTrue();
        assertThat(meter.currentUsage(PROVIDER, YM)).isEqualTo(0L);
    }
}
