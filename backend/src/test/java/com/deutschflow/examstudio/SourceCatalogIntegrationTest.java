package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.examstudio.SourceCatalogService.ArticleView;
import com.deutschflow.examstudio.SourceCatalogService.FeedView;
import com.deutschflow.examstudio.SourceCatalogService.PollResult;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Danh mục nguồn trên Postgres thật (V380): dữ liệu khởi tạo, đọc feed bằng máy tải giả, sổ dùng một lần. */
@SpringBootTest
@Transactional
@TestPropertySource(properties = "app.ai-jobs.scheduled-enabled=false")
@DisplayName("Xưởng đề — danh mục nguồn (V380)")
class SourceCatalogIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private SourceCatalogService catalog;
    @Autowired private JdbcTemplate jdbc;
    @MockBean private SourceFetcher fetcher;

    private static final String RSS = """
            <rss version="2.0"><channel><title>x</title><link>https://www.destatis.de</link>
              <item><title>Mieten steigen weiter</title>
                <link>https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_1.html</link>
                <pubDate>Wed, 11 Nov 2026 08:00:00 +0100</pubDate></item>
              <item><title>Mehr Menschen fahren mit der Bahn</title>
                <link>https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_2.html</link>
                <pubDate>Tue, 10 Nov 2026 08:00:00 +0100</pubDate></item>
            </channel></rss>
            """;

    private FeedView feed(String code) {
        return catalog.feeds().stream().filter(f -> f.code().equals(code)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("dữ liệu khởi tạo: đủ ba hạng, nguồn chuyển thể có giấy phép và ngày owner duyệt")
    void seed() {
        List<FeedView> feeds = catalog.feeds();
        assertThat(feeds).extracting(FeedView::code)
                .contains("DESTATIS", "DWD", "OESTERREICH_GV", "STATISTIK_AUSTRIA", "TAGESSCHAU_WISSEN");
        assertThat(feed("DESTATIS").usageClass()).isEqualTo("ADAPT");
        assertThat(feed("DESTATIS").licenseUrl()).contains("destatis.de");
        assertThat(feed("DESTATIS").approvedOn()).isEqualTo("2026-11-12");
        assertThat(feed("STATISTIK_AUSTRIA").usageClass()).isEqualTo("FACTS_ONLY");
        assertThat(feed("TAGESSCHAU_WISSEN").usageClass()).isEqualTo("TOPIC_ONLY");
        // Mọi nguồn được tải bài đều phải có trang giấy phép đã đọc.
        assertThat(feeds).filteredOn(f -> !f.usageClass().equals("TOPIC_ONLY"))
                .allSatisfy(f -> assertThat(f.licenseUrl()).isNotBlank());
    }

    @Test
    @DisplayName("đọc feed: ghi bài mới một lần; chọn bài theo từ khoá; một bài chỉ dùng một lần")
    void pollAndUseOnce() {
        long destatis = feed("DESTATIS").id();
        when(fetcher.fetchRaw(anyString())).thenReturn(new SourceFetcher.Raw("https://www.destatis.de/rss", "text/xml", RSS));

        PollResult first = catalog.poll(destatis);
        assertThat(first.found()).isEqualTo(2);
        assertThat(first.added()).isEqualTo(2);
        // Đọc lại ngay bị chặn bởi thời gian chờ của nơi đăng (Destatis: 30 giây).
        assertThatThrownBy(() -> catalog.poll(destatis)).isInstanceOf(BadRequestException.class);
        jdbc.update("UPDATE exam_source_feeds SET last_polled_at = now() - interval '1 hour' WHERE id = ?", destatis);
        assertThat(catalog.poll(destatis).added()).isZero();
        assertThat(feed("DESTATIS").seen()).isEqualTo(2);

        List<ArticleView> wohnen = catalog.candidates(List.of("miete", "wohnung"), 10);
        assertThat(wohnen).extracting(ArticleView::title).containsExactly("Mieten steigen weiter");
        assertThat(wohnen.get(0).score()).isEqualTo(1);
        assertThat(catalog.candidates(List.of(), 10)).hasSize(2);

        long draft = jdbc.queryForObject("""
                INSERT INTO exam_drafts (exam_format, cefr_level, section, teil, teil_type, difficulty_plan)
                VALUES ('TELC', 'B1', 'LESEN', 2, 'MULTIPLE_CHOICE', '{}'::jsonb) RETURNING id
                """, Long.class);
        long article = wohnen.get(0).id();
        assertThat(catalog.markUsed(article, draft)).isTrue();
        assertThat(catalog.markUsed(article, draft)).isFalse();
        assertThat(catalog.candidates(List.of("miete"), 10)).isEmpty();
        assertThat(feed("DESTATIS").used()).isEqualTo(1);

        // Nguồn bị tắt ⇒ bài của nó không còn được đề xuất.
        catalog.setActive(destatis, false);
        assertThat(catalog.candidates(List.of(), 10)).isEmpty();
    }

    @Test
    @DisplayName("hạng gợi ý chủ đề: tiêu đề vào gợi ý, nhưng không bao giờ thành bài được tải hay được dùng")
    void topicOnly() {
        long ts = feed("TAGESSCHAU_WISSEN").id();
        when(fetcher.fetchRaw(anyString())).thenReturn(new SourceFetcher.Raw("https://www.tagesschau.de/rss", "text/xml", RSS));
        catalog.poll(ts);

        assertThat(catalog.topicHints(30, 10)).contains("Mieten steigen weiter");
        assertThat(catalog.candidates(List.of(), 10)).isEmpty();
        long article = catalog.list(ts, "SEEN", 10).get(0).id();
        long draft = jdbc.queryForObject("""
                INSERT INTO exam_drafts (exam_format, cefr_level, section, teil, teil_type, difficulty_plan)
                VALUES ('TELC', 'B1', 'LESEN', 2, 'MULTIPLE_CHOICE', '{}'::jsonb) RETURNING id
                """, Long.class);
        assertThat(catalog.markUsed(article, draft)).isFalse();
    }

    @Test
    @DisplayName("V381 — oesterreich.gv.at đọc bằng sitemap: chỉ mục đời sống vào sổ, chấm được theo chủ đề")
    void sitemapSource() {
        FeedView oe = feed("OESTERREICH_GV");
        assertThat(oe.listingKind()).isEqualTo("SITEMAP");
        when(fetcher.fetchRaw(anyString(), anyInt())).thenReturn(new SourceFetcher.Raw(
                "https://www.oesterreich.gv.at/sitemap.xml", "application/xml", """
                <urlset>
                <url><loc>https://www.oesterreich.gv.at/de/themen/bauen_und_wohnen/wohnen/Seite.210100</loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/persoenliche_dokumente_und_bestaetigungen/fuehrerschein/Seite.040103</loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/mobilitaet/Fussgaenger</loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/gesetze_und_recht/strafrecht/Seite.2460000</loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/menschen_aus_anderen_staaten/aufenthalt/Seite.120000</loc></url>
                </urlset>
                """));

        PollResult r = catalog.poll(oe.id());
        assertThat(r.found()).isEqualTo(2); // nhà ở + đi lại; giấy tờ, pháp luật, người nước ngoài bị mẫu loại
        assertThat(r.added()).isEqualTo(2);
        assertThat(catalog.candidates(List.of("fußgänger"), 10)).extracting(ArticleView::url)
                .containsExactly("https://www.oesterreich.gv.at/de/themen/mobilitaet/Fussgaenger");
        // Sitemap thay đổi chậm: thời gian chờ một giờ.
        assertThatThrownBy(() -> catalog.poll(oe.id())).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("V383 — nguồn mới có đủ hạng và giấy phép; Berlin-Brandenburg đọc sitemap rồi lấy tiêu đề thật từ trang")
    void moreFeedsAndTitleBackfill() {
        assertThat(feed("BFR").usageClass()).isEqualTo("ADAPT");
        assertThat(feed("ESO_DE").usageClass()).isEqualTo("ADAPT");
        assertThat(List.of(feed("STATISTIK_NORD"), feed("IT_NRW"), feed("WIEN_RK")))
                .allSatisfy(f -> assertThat(f.usageClass()).isEqualTo("FACTS_ONLY"));

        FeedView bbb = feed("STATISTIK_BBB");
        assertThat(bbb.listingKind()).isEqualTo("SITEMAP");
        when(fetcher.fetchRaw(anyString(), anyInt())).thenReturn(new SourceFetcher.Raw("x", "text/xml", """
                <urlset>
                <url><loc>https://www.statistik-berlin-brandenburg.de/166-2025</loc><lastmod>2025-07-03</lastmod></url>
                <url><loc>https://www.statistik-berlin-brandenburg.de/167-2025</loc><lastmod>2025-07-04</lastmod></url>
                </urlset>
                """));
        when(fetcher.fetchRaw("https://www.statistik-berlin-brandenburg.de/167-2025")).thenReturn(new SourceFetcher.Raw(
                "x", "text/html", "<html><head><title>Mieten in Berlin steigen weiter</title></head></html>"));
        when(fetcher.fetchRaw("https://www.statistik-berlin-brandenburg.de/166-2025"))
                .thenThrow(new BadRequestException("Trang trả mã 404."));

        PollResult r = catalog.poll(bbb.id());
        assertThat(r.added()).isEqualTo(2);
        assertThat(r.note()).contains("Đã lấy tiêu đề cho 1 bài");
        // Bài có tiêu đề được chọn theo chủ đề; bài không tải được bị loại kèm lý do.
        assertThat(catalog.candidates(List.of("miet"), 10)).extracting(ArticleView::title)
                .containsExactly("Mieten in Berlin steigen weiter");
        assertThat(catalog.list(bbb.id(), "REJECTED", 10)).hasSize(1);
    }

    @Test
    @DisplayName("nguồn chưa có cách lấy danh sách bài: báo rõ, không gọi mạng")
    void noListing() {
        assertThatThrownBy(() -> catalog.poll(feed("RKI_JOHM").id())).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("chưa có cách lấy danh sách bài");
        verify(fetcher, never()).fetchRaw(anyString());
    }
}
