package com.deutschflow.news.service;

import com.deutschflow.news.dto.NewsItemDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * B4 audit lag 02/09: refresh RSS từng chạy trong synchronized TRÊN REQUEST THREAD — request
 * xấu số đầu tiên sau mỗi 30' chờ 4 lần fetch tuần tự (tệ nhất ~52s). Test khoá hợp đồng mới:
 * getLatestNews KHÔNG BAO GIỜ fetch; refresh nền swap nguyên khối; mọi nguồn chết thì GIỮ bản cũ.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NewsServiceTest {

    @Mock RestTemplate restTemplate;

    private NewsService newsService;

    private static final String RSS_ONE_ITEM = """
            <?xml version="1.0" encoding="UTF-8"?>
            <rss><channel><item>
              <title>Testartikel</title>
              <description>Beschreibung</description>
              <link>https://example.org/a</link>
              <pubDate>Tue, 02 Sep 2026 10:00:00 GMT</pubDate>
            </item></channel></rss>
            """;

    @BeforeEach
    void setUp() {
        newsService = new NewsService(restTemplate);
    }

    @Test
    @DisplayName("getLatestNews KHÔNG fetch — serve-stale thuần, refresh là việc của scheduler")
    void getLatestNewsNeverFetches() {
        assertThat(newsService.getLatestNews()).isEmpty();
        verifyNoInteractions(restTemplate);
    }

    @Test
    @DisplayName("refreshCache gom bài từ các nguồn sống (nguồn lỗi lẻ bị nuốt êm)")
    void refreshCollectsFromLiveSources() {
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("nguồn 1 chết"))
                .thenReturn(RSS_ONE_ITEM)
                .thenReturn(RSS_ONE_ITEM)
                .thenReturn(RSS_ONE_ITEM);

        newsService.refreshCache();

        List<NewsItemDto> news = newsService.getLatestNews();
        assertThat(news).hasSize(3);
        assertThat(news.get(0).title()).isEqualTo("Testartikel");
    }

    @Test
    @DisplayName("mọi nguồn cùng chết → GIỮ bản cũ, không đè bằng danh sách rỗng")
    void allSourcesDeadKeepsStaleData() {
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(RSS_ONE_ITEM);
        newsService.refreshCache();
        assertThat(newsService.getLatestNews()).hasSize(4);

        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("mạng đứt"));
        newsService.refreshCache();

        assertThat(newsService.getLatestNews()).hasSize(4);
    }
}
