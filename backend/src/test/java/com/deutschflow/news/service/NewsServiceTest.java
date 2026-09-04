package com.deutschflow.news.service;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.deutschflow.news.dto.NewsItemDto;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * B4 audit lag 02/09: refresh RSS từng chạy trong synchronized TRÊN REQUEST THREAD — request
 * xấu số đầu tiên sau mỗi 30' chờ các lần fetch tuần tự (tệ nhất ~52s). Test khoá hợp đồng mới:
 * getLatestNews KHÔNG BAO GIỜ fetch; refresh nền swap nguyên khối; mọi nguồn chết thì GIỮ bản cũ.
 *
 * <p>09/2026 (DW khai tử feed tiếng Việt): thêm hợp đồng chống tái diễn — body không phải XML
 * bị nuốt êm kèm preview trong log, lỗi lặp lại chỉ WARN có throttle (không ERROR mỗi 30'),
 * nguồn sống lại có log INFO, và DOCTYPE trong feed ngoại lai bị từ chối (XXE).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NewsServiceTest {

    @Mock RestTemplate restTemplate;

    private NewsService newsService;
    private ListAppender<ILoggingEvent> logWatcher;

    private static final String RSS_ONE_ITEM = """
            <?xml version="1.0" encoding="UTF-8"?>
            <rss><channel><item>
              <title>Testartikel</title>
              <description>Beschreibung</description>
              <link>https://example.org/a</link>
              <pubDate>Tue, 02 Sep 2026 10:00:00 GMT</pubDate>
            </item></channel></rss>
            """;

    /** Đúng thứ DW trả sau khi khai tử feed: text trần đội lốt Content-Type application/xml. */
    private static final String DEAD_FEED_BODY = "Error: no feed by that name.";

    private static final String RSS_WITH_DOCTYPE = """
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
            <rss><channel><item><title>&xxe;</title></item></channel></rss>
            """;

    @BeforeEach
    void setUp() {
        newsService = new NewsService(restTemplate);
        logWatcher = new ListAppender<>();
        logWatcher.start();
        ((Logger) LoggerFactory.getLogger(NewsService.class)).addAppender(logWatcher);
    }

    @AfterEach
    void tearDown() {
        ((Logger) LoggerFactory.getLogger(NewsService.class)).detachAppender(logWatcher);
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
                .thenReturn(RSS_ONE_ITEM);

        newsService.refreshCache();

        List<NewsItemDto> news = newsService.getLatestNews();
        assertThat(news).hasSize(2);
        assertThat(news.get(0).title()).isEqualTo("Testartikel");
    }

    @Test
    @DisplayName("mọi nguồn cùng chết → GIỮ bản cũ, không đè bằng danh sách rỗng")
    void allSourcesDeadKeepsStaleData() {
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(RSS_ONE_ITEM);
        newsService.refreshCache();
        assertThat(newsService.getLatestNews()).hasSize(3);

        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("mạng đứt"));
        newsService.refreshCache();

        assertThat(newsService.getLatestNews()).hasSize(3);
    }

    @Test
    @DisplayName("body không phải XML (feed khai tử trả text trần) → nuốt êm, WARN kèm preview body")
    void nonXmlBodySwallowedWithPreview() {
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(DEAD_FEED_BODY);

        newsService.refreshCache();

        assertThat(newsService.getLatestNews()).isEmpty();
        assertThat(logWatcher.list)
                .anySatisfy(event -> assertThat(event.getFormattedMessage())
                        .contains("không phải XML")
                        .contains(DEAD_FEED_BODY));
    }

    @Test
    @DisplayName("lỗi lặp lại → WARN có throttle: lần 1 và lần 12, KHÔNG phải mỗi lần refresh")
    void repeatedFailureLogsAreThrottled() {
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("feed chết hẳn"));

        for (int i = 0; i < 12; i++) {
            newsService.refreshCache();
        }

        List<String> dwFailureLogs = logWatcher.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(msg -> msg.contains("rss-de-all") && msg.contains("lỗi lần thứ"))
                .toList();
        assertThat(dwFailureLogs)
                .hasSize(2)
                .anySatisfy(msg -> assertThat(msg).contains("lỗi lần thứ 1 "))
                .anySatisfy(msg -> assertThat(msg).contains("lỗi lần thứ 12 "));
        assertThat(logWatcher.list)
                .noneMatch(event -> event.getLevel() == ch.qos.logback.classic.Level.ERROR);
    }

    @Test
    @DisplayName("nguồn sống lại sau chuỗi lỗi → log INFO và reset bộ đếm")
    void recoveryLogsInfoAndResetsCounter() {
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("chập chờn"));
        newsService.refreshCache();

        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(RSS_ONE_ITEM);
        newsService.refreshCache();

        assertThat(logWatcher.list)
                .anySatisfy(event -> assertThat(event.getFormattedMessage())
                        .contains("sống lại sau 1 lần lỗi"));

        // Bộ đếm đã reset: chuỗi lỗi mới lại được WARN ngay từ lần 1 (không bị ngưỡng 12 nuốt).
        logWatcher.list.clear();
        when(restTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RuntimeException("chập chờn đợt 2"));
        newsService.refreshCache();
        assertThat(logWatcher.list)
                .anySatisfy(event -> assertThat(event.getFormattedMessage()).contains("lỗi lần thứ 1 "));
    }

    @Test
    @DisplayName("feed mang DOCTYPE (mầm XXE/billion-laughs) → từ chối parse, không lộ nội dung entity")
    void doctypeInFeedIsRejected() {
        when(restTemplate.getForObject(anyString(), eq(String.class))).thenReturn(RSS_WITH_DOCTYPE);

        newsService.refreshCache();

        assertThat(newsService.getLatestNews()).isEmpty();
    }
}
