package com.deutschflow.payment.apple;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Maps an Apple App Store product id (e.g. {@code com.deutschflow.app.pro.monthly}) to the internal
 * subscription plan code and duration. The server trusts this mapping for entitlement — never Apple's
 * price, which is managed per-storefront in App Store Connect.
 *
 * <p>Backed by the {@code apple_products} table and cached in memory; the cache refreshes on a miss so
 * a newly seeded product becomes visible without a restart.
 */
@Component
@Slf4j
public class AppleProductCatalog {

    /** Immutable mapping for one Apple product. */
    public record AppleProduct(String productId, String planCode, int durationMonths) {}

    private final JdbcTemplate jdbcTemplate;
    private final Map<String, AppleProduct> cache = new ConcurrentHashMap<>();

    public AppleProductCatalog(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Resolve a product id to its plan mapping, refreshing the cache once on a miss. */
    public Optional<AppleProduct> find(String productId) {
        if (productId == null || productId.isBlank()) {
            return Optional.empty();
        }
        AppleProduct cached = cache.get(productId);
        if (cached != null) {
            return Optional.of(cached);
        }
        return loadOne(productId).map(p -> {
            cache.put(p.productId(), p);
            return p;
        });
    }

    /** All active products, for building the iOS paywall. */
    public List<AppleProduct> activeProducts() {
        return jdbcTemplate.query("""
                SELECT product_id, plan_code, duration_months
                FROM apple_products
                WHERE is_active = TRUE
                ORDER BY plan_code, duration_months
                """,
                (rs, n) -> new AppleProduct(
                        rs.getString("product_id"),
                        rs.getString("plan_code"),
                        rs.getInt("duration_months")));
    }

    private Optional<AppleProduct> loadOne(String productId) {
        List<AppleProduct> rows = jdbcTemplate.query("""
                SELECT product_id, plan_code, duration_months
                FROM apple_products
                WHERE product_id = ? AND is_active = TRUE
                """,
                (rs, n) -> new AppleProduct(
                        rs.getString("product_id"),
                        rs.getString("plan_code"),
                        rs.getInt("duration_months")),
                productId);
        if (rows.isEmpty()) {
            log.warn("[APPLE] Unknown or inactive product id: {}", productId);
            return Optional.empty();
        }
        return Optional.of(rows.get(0));
    }
}
