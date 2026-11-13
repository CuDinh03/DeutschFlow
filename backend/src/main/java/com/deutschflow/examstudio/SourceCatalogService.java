package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examstudio.SourceCatalog.Entry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Danh mục nguồn của dây chuyền tạo bộ đề (owner chốt 12/11/2026): nơi đăng nào được dùng, ở hạng nào, và sổ các
 * bài đã thấy / đã dùng.
 *
 * <ul>
 *   <li>Hạng {@code ADAPT}, {@code FACTS_ONLY}: máy được tải bài. Một bài chỉ được dùng MỘT lần.</li>
 *   <li>Hạng {@code TOPIC_ONLY} (báo đài có bản quyền): chỉ lưu tiêu đề và đường dẫn đọc từ feed để gợi ý chủ đề.
 *       {@link #candidates} không bao giờ trả bài của hạng này, nên dây chuyền không có đường nào tải chúng.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SourceCatalogService {

    public static final String ADAPT = "ADAPT";
    public static final String FACTS_ONLY = "FACTS_ONLY";
    public static final String TOPIC_ONLY = "TOPIC_ONLY";

    private static final int CANDIDATE_POOL = 400;

    private final JdbcTemplate jdbc;
    private final SourceFetcher fetcher;

    public record FeedView(long id, String code, String publisher, String homeUrl, String listingKind,
                           String usageClass, String licenseName, String licenseUrl, String attribution,
                           String notes, boolean active, String approvedOn, String lastPolledAt,
                           String lastPollNote, int seen, int used) {}

    public record ArticleView(long id, long feedId, String feedCode, String publisher, String usageClass,
                              String url, String title, String publishedAt, String status, int score) {}

    public record PollResult(long feedId, int found, int added, String note) {}

    private record FeedRow(long id, String listingUrl, String listingKind, String linkPattern, String usageClass,
                           int minDelaySeconds, Instant lastPolledAt) {}

    // ── Danh mục ─────────────────────────────────────────────────────────────────────────────────────────

    public List<FeedView> feeds() {
        return jdbc.query("""
                SELECT f.*,
                       (SELECT count(*) FROM exam_source_articles a WHERE a.feed_id = f.id) AS seen,
                       (SELECT count(*) FROM exam_source_articles a WHERE a.feed_id = f.id AND a.status = 'USED') AS used
                FROM exam_source_feeds f
                ORDER BY CASE f.usage_class WHEN 'ADAPT' THEN 0 WHEN 'FACTS_ONLY' THEN 1 ELSE 2 END, f.publisher
                """, (rs, i) -> new FeedView(rs.getLong("id"), rs.getString("code"), rs.getString("publisher"),
                rs.getString("home_url"), rs.getString("listing_kind"), rs.getString("usage_class"),
                rs.getString("license_name"), rs.getString("license_url"), rs.getString("attribution"),
                rs.getString("notes"), rs.getBoolean("active"),
                rs.getDate("approved_on") == null ? null : rs.getDate("approved_on").toString(),
                iso(rs.getTimestamp("last_polled_at")), rs.getString("last_poll_note"),
                rs.getInt("seen"), rs.getInt("used")));
    }

    @Transactional
    public void setActive(long feedId, boolean active) {
        if (jdbc.update("UPDATE exam_source_feeds SET active = ? WHERE id = ?", active, feedId) == 0) {
            throw new NotFoundException("Không có nguồn #" + feedId + " trong danh mục. Tải lại tab \"Nguồn\" để xem danh mục hiện tại.");
        }
    }

    // ── Đọc danh sách bài mới của một nơi đăng ───────────────────────────────────────────────────────────

    /**
     * Tải feed / trang mục lục của nơi đăng rồi ghi các bài chưa thấy vào sổ. Không tải bài nào. Gọi lại sớm hơn
     * thời gian chờ của nơi đăng ({@code min_delay_seconds}, theo robots.txt của họ) thì bị từ chối.
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public PollResult poll(long feedId) {
        FeedRow f = feed(feedId);
        if ("NONE".equals(f.listingKind()) || f.listingUrl() == null) {
            throw new BadRequestException("Nguồn này chưa có cách lấy danh sách bài tự động, nên nút \"Đọc bài mới\" không dùng được. Muốn dùng bài của nguồn này thì thêm bằng tay ở bước \"Nguồn\" của một bản nháp (dán đường dẫn hoặc văn bản).");
        }
        if (f.lastPolledAt() != null
                && Duration.between(f.lastPolledAt(), Instant.now()).getSeconds() < f.minDelaySeconds()) {
            throw new BadRequestException("Vừa đọc nguồn này xong. Nơi đăng yêu cầu cách nhau ít nhất " + f.minDelaySeconds() + " giây; chờ rồi bấm lại \"Đọc bài mới\".");
        }
        List<Entry> entries;
        try {
            entries = switch (f.listingKind()) {
                case "RSS" -> SourceCatalog.filterByPattern(
                        SourceCatalog.parseRss(fetcher.fetchRaw(f.listingUrl()).body()), f.linkPattern());
                case "SITEMAP" -> SourceCatalog.parseSitemap(
                        fetcher.fetchRaw(f.listingUrl(), SourceFetcher.MAX_SITEMAP_BYTES).body(), f.linkPattern());
                default -> {
                    SourceFetcher.Raw raw = fetcher.fetchRaw(f.listingUrl());
                    yield SourceCatalog.parseIndex(raw.body(), raw.url(), f.linkPattern());
                }
            };
        } catch (BadRequestException e) {
            note(feedId, "Lỗi: " + e.getMessage());
            throw e;
        }
        // Sitemap có thể mang vài nghìn địa chỉ: ghi theo lô.
        int added = 0;
        for (int[] batch : jdbc.batchUpdate("""
                INSERT INTO exam_source_articles (feed_id, url, url_hash, title, published_at)
                VALUES (?, ?, ?, ?, ?) ON CONFLICT (url_hash) DO NOTHING
                """, entries, 500, (ps, e) -> {
                    ps.setLong(1, feedId);
                    ps.setString(2, e.url());
                    ps.setString(3, SourceCatalog.hash(e.url()));
                    ps.setString(4, e.title());
                    ps.setTimestamp(5, e.publishedAt() == null ? null : Timestamp.from(e.publishedAt()));
                })) {
            for (int n : batch) if (n > 0) added += n;
        }
        int titled = "SITEMAP".equals(f.listingKind()) ? backfillTitles(feedId, TITLE_BACKFILL_BATCH) : 0;
        String note = entries.isEmpty() ? "Không đọc được bài nào từ danh sách (có thể trang đã đổi cấu trúc)."
                : "Thấy " + entries.size() + " bài, " + added + " bài mới."
                + (titled > 0 ? " Đã lấy tiêu đề cho " + titled + " bài." : "");
        note(feedId, note);
        return new PollResult(feedId, entries.size(), added, note);
    }

    static final int TITLE_BACKFILL_BATCH = 25;
    private static final long TITLE_BACKFILL_BUDGET_MS = 40_000;

    /**
     * Sitemap không có tiêu đề. Với nguồn mà đường dẫn chỉ là số hiệu (Statistik Berlin-Brandenburg), bài nằm trong
     * sổ mà chưa có tiêu đề thì không chấm được theo chủ đề. Hàm này tải các bài MỚI NHẤT chưa có tiêu đề (tối đa
     * {@code max} bài, trong 40 giây) và ghi tiêu đề của trang. Bài không tải được thì bị loại khỏi vòng chọn.
     */
    public int backfillTitles(long feedId, int max) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, url FROM exam_source_articles
                WHERE feed_id = ? AND status = 'SEEN' AND title IS NULL
                ORDER BY published_at DESC NULLS LAST, id DESC LIMIT ?
                """, feedId, Math.max(1, Math.min(max, 60)));
        long deadline = System.currentTimeMillis() + TITLE_BACKFILL_BUDGET_MS;
        int done = 0;
        for (Map<String, Object> r : rows) {
            if (System.currentTimeMillis() > deadline) break;
            long id = ((Number) r.get("id")).longValue();
            try {
                String title = SourceCatalog.pageTitle(fetcher.fetchRaw((String) r.get("url")).body());
                if (title == null) {
                    reject(id, "Trang không có tiêu đề.");
                } else {
                    jdbc.update("UPDATE exam_source_articles SET title = ? WHERE id = ?", title, id);
                    done++;
                }
            } catch (BadRequestException e) {
                reject(id, e.getMessage());
            }
        }
        return done;
    }

    private void note(long feedId, String note) {
        jdbc.update("UPDATE exam_source_feeds SET last_polled_at = now(), last_poll_note = ? WHERE id = ?",
                note.length() > 500 ? note.substring(0, 500) : note, feedId);
    }

    private FeedRow feed(long feedId) {
        return jdbc.query("SELECT * FROM exam_source_feeds WHERE id = ?", (rs, i) -> new FeedRow(rs.getLong("id"),
                        rs.getString("listing_url"), rs.getString("listing_kind"), rs.getString("link_pattern"),
                        rs.getString("usage_class"), rs.getInt("min_delay_seconds"),
                        rs.getTimestamp("last_polled_at") == null ? null : rs.getTimestamp("last_polled_at").toInstant()),
                feedId).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Không có nguồn #" + feedId + " trong danh mục. Tải lại tab \"Nguồn\" để xem danh mục hiện tại."));
    }

    // ── Chọn bài ─────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Bài còn dùng được (chưa dùng, chưa loại) của các nơi đăng đang bật ở hạng được tải bài, xếp theo số từ khoá
     * chủ đề khớp tiêu đề rồi tới ngày đăng. {@code keywords} trống ⇒ xếp theo ngày.
     */
    public List<ArticleView> candidates(Collection<String> keywords, int limit) {
        // Bài lấy từ feed (thông cáo, tin: có tiêu đề thật, đủ dài) đứng TRƯỚC trang lấy từ sitemap (tiêu đề chỉ suy
        // từ đường dẫn, nhiều trang quá ngắn). Lượt chạy thật 12/11/2026: 6 trang sitemap liền nhau đều dưới 800 ký tự.
        List<ArticleView> scored = new ArrayList<>(score(keywords, articles("""
                WHERE a.status = 'SEEN' AND f.active AND f.usage_class IN ('ADAPT', 'FACTS_ONLY')
                  AND f.listing_kind <> 'SITEMAP'
                ORDER BY coalesce(a.published_at, a.seen_at) DESC LIMIT %d
                """.formatted(CANDIDATE_POOL))));
        scored.addAll(score(keywords, articles("""
                WHERE a.status = 'SEEN' AND f.active AND f.usage_class IN ('ADAPT', 'FACTS_ONLY')
                  AND f.listing_kind = 'SITEMAP'
                ORDER BY a.id LIMIT %d
                """.formatted(SITEMAP_POOL))));
        return scored.subList(0, Math.min(Math.max(limit, 0), scored.size()));
    }

    private static final int SITEMAP_POOL = 5_000;

    /**
     * Nơi đăng mà bài hay hỏng (không tải được, quá ngắn): đã loại từ 3 bài trở lên và số bài loại nhiều hơn gấp đôi
     * số bài dùng được. Bộ điều phối để các nơi này xuống cuối khi chọn bài (lượt #11, 13/11/2026: bốn trang liền
     * nhau của một nơi đăng đều quá ngắn, đốt hết lượt thử nguồn của Lesen 1).
     */
    public java.util.Set<Long> unreliableFeeds() {
        return new java.util.HashSet<>(jdbc.queryForList("""
                SELECT feed_id FROM exam_source_articles GROUP BY feed_id
                HAVING count(*) FILTER (WHERE status = 'REJECTED') >= 3
                   AND count(*) FILTER (WHERE status = 'REJECTED') > 2 * count(*) FILTER (WHERE status = 'USED')
                """, Long.class));
    }

    private static List<ArticleView> score(Collection<String> keywords, List<ArticleView> pool) {
        List<ArticleView> scored = new ArrayList<>();
        boolean any = keywords != null && keywords.stream().anyMatch(k -> k != null && !k.isBlank());
        for (ArticleView a : pool) {
            int s = SourceCatalog.score(a.title(), keywords);
            if (any && s == 0) continue;
            scored.add(new ArticleView(a.id(), a.feedId(), a.feedCode(), a.publisher(), a.usageClass(), a.url(),
                    a.title(), a.publishedAt(), a.status(), s));
        }
        scored.sort(Comparator.comparingInt(ArticleView::score).reversed()); // sắp xếp ổn định: giữ thứ tự gốc
        return scored;
    }

    /** Tiêu đề gần đây của báo đài hạng gợi ý chủ đề — chỉ tiêu đề, để bộ lập kế hoạch biết đời sống đang nói gì. */
    public List<String> topicHints(int days, int limit) {
        return jdbc.queryForList("""
                SELECT a.title FROM exam_source_articles a JOIN exam_source_feeds f ON f.id = a.feed_id
                WHERE f.active AND f.usage_class = 'TOPIC_ONLY' AND a.title IS NOT NULL
                  AND coalesce(a.published_at, a.seen_at) > now() - make_interval(days => ?)
                ORDER BY coalesce(a.published_at, a.seen_at) DESC LIMIT ?
                """, String.class, days, limit);
    }

    public List<ArticleView> list(Long feedId, String status, int limit) {
        StringBuilder where = new StringBuilder("WHERE TRUE");
        List<Object> args = new ArrayList<>();
        if (feedId != null) {
            where.append(" AND a.feed_id = ?");
            args.add(feedId);
        }
        if (status != null && !status.isBlank()) {
            where.append(" AND a.status = ?");
            args.add(status.trim().toUpperCase(java.util.Locale.ROOT));
        }
        where.append(" ORDER BY coalesce(a.published_at, a.seen_at) DESC LIMIT ").append(Math.min(Math.max(limit, 1), 200));
        return articles(where.toString(), args.toArray());
    }

    private List<ArticleView> articles(String tail, Object... args) {
        return jdbc.query("""
                SELECT a.id, a.feed_id, f.code, f.publisher, f.usage_class, a.url, a.title, a.published_at, a.status
                FROM exam_source_articles a JOIN exam_source_feeds f ON f.id = a.feed_id
                """ + tail, (rs, i) -> new ArticleView(rs.getLong("id"), rs.getLong("feed_id"), rs.getString("code"),
                rs.getString("publisher"), rs.getString("usage_class"), rs.getString("url"), rs.getString("title"),
                iso(rs.getTimestamp("published_at")), rs.getString("status"), 0), args);
    }

    // ── Sổ dùng một lần ──────────────────────────────────────────────────────────────────────────────────

    /**
     * Ghi bài là đã dùng cho một bản nháp. Trả {@code false} nếu bài không còn ở trạng thái "đã thấy" (lượt khác
     * vừa lấy mất, hoặc đã bị loại) ⇒ người gọi phải chọn bài khác. Bài của hạng gợi ý chủ đề không bao giờ lấy được.
     */
    @Transactional
    public boolean markUsed(long articleId, long draftId) {
        return jdbc.update("""
                UPDATE exam_source_articles a SET status = 'USED', used_by_draft_id = ?, used_at = now()
                FROM exam_source_feeds f
                WHERE a.id = ? AND a.status = 'SEEN' AND f.id = a.feed_id AND f.usage_class IN ('ADAPT', 'FACTS_ONLY')
                """, draftId, articleId) == 1;
    }

    /** Hạng của nơi đăng mà một bài trong sổ thuộc về; bài không có trong sổ ⇒ {@code null}. */
    public String usageClassOf(String url) {
        String canonical = SourceCatalog.canonical(url);
        if (canonical == null) return null;
        return jdbc.queryForList("""
                SELECT f.usage_class FROM exam_source_articles a JOIN exam_source_feeds f ON f.id = a.feed_id
                WHERE a.url_hash = ?
                """, String.class, SourceCatalog.hash(canonical)).stream().findFirst().orElse(null);
    }

    /** Trả một bài "đã dùng" về sổ (lượt tải hỏng không phải do bài, vd. kênh AI trục trặc). */
    @Transactional
    public void release(long articleId) {
        jdbc.update("UPDATE exam_source_articles SET status = 'SEEN', used_by_draft_id = NULL, used_at = NULL "
                + "WHERE id = ? AND status = 'USED'", articleId);
    }

    /** Loại một bài khỏi vòng chọn (không tải được, quá ngắn, chủ đề nhạy cảm…), kèm lý do. */
    @Transactional
    public void reject(long articleId, String reason) {
        // Bài đã được ghi "đã dùng" trước khi tải: tải hỏng thì chuyển sang "loại" kèm lý do, không để nằm ở "đã dùng".
        jdbc.update("UPDATE exam_source_articles SET status = 'REJECTED', reject_reason = ?, used_by_draft_id = NULL, "
                        + "used_at = NULL WHERE id = ? AND status IN ('SEEN', 'USED')",
                reason == null ? null : reason.substring(0, Math.min(reason.length(), 500)), articleId);
    }

    private static String iso(Timestamp t) {
        return t == null ? null : t.toInstant().toString();
    }
}
