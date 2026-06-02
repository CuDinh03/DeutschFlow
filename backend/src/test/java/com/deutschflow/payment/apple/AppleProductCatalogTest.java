package com.deutschflow.payment.apple;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("AppleProductCatalog — productId → plan mapping")
@ExtendWith(MockitoExtension.class)
class AppleProductCatalogTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    private static final String PRODUCT_ID = "com.deutschflow.app.pro.monthly";

    @Test
    @DisplayName("resolves a known product and caches it (single DB hit across repeated lookups)")
    @SuppressWarnings("unchecked")
    void find_knownProduct_mapsAndCaches() {
        AppleProductCatalog catalog = new AppleProductCatalog(jdbcTemplate);
        doReturn(List.of(new AppleProductCatalog.AppleProduct(PRODUCT_ID, "PRO", 1)))
                .when(jdbcTemplate).query(anyString(), any(RowMapper.class), eq(PRODUCT_ID));

        var first = catalog.find(PRODUCT_ID);
        var second = catalog.find(PRODUCT_ID);

        assertThat(first).isPresent();
        assertThat(first.get().planCode()).isEqualTo("PRO");
        assertThat(first.get().durationMonths()).isEqualTo(1);
        assertThat(second).isPresent();
        // Second lookup served from cache — DB queried only once.
        verify(jdbcTemplate, times(1)).query(anyString(), any(RowMapper.class), eq(PRODUCT_ID));
    }

    @Test
    @DisplayName("returns empty for an unknown / inactive product")
    @SuppressWarnings("unchecked")
    void find_unknownProduct_empty() {
        AppleProductCatalog catalog = new AppleProductCatalog(jdbcTemplate);
        doReturn(List.of())
                .when(jdbcTemplate).query(anyString(), any(RowMapper.class), eq("does.not.exist"));

        assertThat(catalog.find("does.not.exist")).isEmpty();
    }

    @Test
    @DisplayName("blank product id short-circuits without a DB call")
    void find_blank_empty() {
        AppleProductCatalog catalog = new AppleProductCatalog(jdbcTemplate);

        assertThat(catalog.find("  ")).isEmpty();
        verifyNoInteractions(jdbcTemplate);
    }
}
