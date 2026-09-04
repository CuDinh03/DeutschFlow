package com.deutschflow.news.service;

import com.deutschflow.news.dto.NewsItemDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tin tức tiếng Đức từ 3 nguồn RSS, làm mới nền mỗi 30 phút.
 *
 * <p>B4 audit lag 02/09: bản cũ refresh NGAY TRÊN REQUEST THREAD trong {@code synchronized} —
 * request xấu số đầu tiên sau mỗi 30' phải ngồi chờ các lần fetch RSS tuần tự (1–5s, xấu nhất
 * ~52s khi nguồn treo đến timeout), và mọi request tin tức khác xếp hàng sau khoá. Giờ:
 * {@code @Scheduled} tự refresh nền (chiếm 1 slot scheduling pool vài giây mỗi 30' — pool đã
 * là 4 từ #467), API luôn trả bản đang có ngay lập tức (serve-stale).
 *
 * <p>09/2026: nguồn DW Tiếng Việt (rss-vi-all) gỡ có chủ đích — DW đã đóng kênh tiếng Việt
 * (feed trả body text "Error: no feed by that name." kèm Content-Type application/xml,
 * dw.com/vi redirect sang bản tiếng Anh). Muốn có nguồn tiếng Việt thay thế là quyết định
 * sản phẩm, đừng chỉ thêm URL vào đây.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NewsService {

    private final RestTemplate restTemplate;

    /** Bản tin đang phục vụ — swap nguyên khối bằng list bất biến, đọc không cần khoá. */
    private volatile List<NewsItemDto> latest = List.of();

    /**
     * Số lần lỗi LIÊN TIẾP theo từng URL, để throttle log: nguồn ngoài chập chờn là chuyện
     * thường, không đáng một dòng ERROR mỗi 30 phút (đã từng che khuất log đêm suốt nhiều ngày
     * khi DW khai tử feed tiếng Việt).
     */
    private final Map<String, Integer> consecutiveFailures = new ConcurrentHashMap<>();

    private static final long CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

    /** WARN ở lần lỗi đầu rồi mỗi lần thứ 12 liên tiếp — nhịp 30' thì ~6 giờ mới nhắc lại. */
    private static final int FAILURE_LOG_INTERVAL = 12;

    /** Body không phải XML thì trích tối đa bấy nhiêu ký tự vào log — đủ chẩn đoán, không tràn. */
    private static final int NON_XML_PREVIEW_CHARS = 80;

    /**
     * Trần cho MỌI lý do lỗi được log: message của RestTemplate với HTTP 4xx/5xx nhúng nguyên
     * body lỗi không cắt (DefaultResponseErrorHandler formatValue limitLength=-1) — trang HTML
     * của CDN/WAF có thể dài hàng chục KB.
     */
    private static final int FAILURE_REASON_MAX_CHARS = 200;

    private static final String DW_DE = "https://rss.dw.com/xml/rss-de-all";
    private static final String TAGESSCHAU = "https://www.tagesschau.de/xml/rss2/";
    private static final String SPIEGEL = "https://www.spiegel.de/schlagzeilen/tops/index.rss";

    /** Trả ngay bản đang có — vài giây đầu sau boot có thể rỗng cho tới lượt refresh nền đầu tiên. */
    public List<NewsItemDto> getLatestNews() {
        return latest;
    }

    /**
     * Refresh nền. initialDelay ngắn để có tin sớm sau boot nhưng không chen vào lúc startup
     * đang bận nhất; fixedDelay giữ nhịp 30' của bản cũ. Không cần SchedulerLock: cache nằm
     * trong bộ nhớ TỪNG instance — blue-green hai instance cùng fetch RSS là vô hại.
     */
    @Scheduled(initialDelay = 10_000, fixedDelay = CACHE_DURATION_MS)
    public void refreshCache() {
        List<NewsItemDto> allNews = new ArrayList<>();
        allNews.addAll(fetchRss(DW_DE, "DW Deutsch lernen", "DW_LEARN"));
        allNews.addAll(fetchRss(TAGESSCHAU, "Tagesschau", "TAGESSCHAU"));
        allNews.addAll(fetchRss(SPIEGEL, "Der Spiegel", "SPIEGEL"));

        // Serve-stale đúng nghĩa: mọi nguồn cùng chết (mạng đứt, DNS hỏng) thì GIỮ bản cũ còn
        // đọc được thay vì đè bằng danh sách rỗng; nguồn nào lỗi lẻ thì fetchRss đã nuốt và
        // allNews vẫn mang phần còn sống.
        if (allNews.isEmpty()) {
            log.warn("News refresh: cả 3 nguồn RSS đều không trả bài — giữ bản cũ ({} bài)", latest.size());
            return;
        }
        latest = List.copyOf(allNews);
        log.info("Refreshed news cache, fetched {} articles", allNews.size());
    }

    private List<NewsItemDto> fetchRss(String url, String sourceName, String sourceType) {
        try {
            List<NewsItemDto> list = parseRss(restTemplate.getForObject(url, String.class), sourceName, sourceType);
            Integer failuresBefore = consecutiveFailures.remove(url);
            if (failuresBefore != null) {
                log.info("RSS {} sống lại sau {} lần lỗi liên tiếp", url, failuresBefore);
            }
            return list;
        } catch (Exception e) {
            int failures = consecutiveFailures.merge(url, 1, Integer::sum);
            if (failures == 1 || failures % FAILURE_LOG_INTERVAL == 0) {
                log.warn("RSS {} lỗi lần thứ {} liên tiếp: {}", url, failures, compact(e.getMessage()));
            }
            return List.of();
        }
    }

    /** Nén lý do lỗi về một dòng có trần độ dài — không cho body lỗi ngoại lai phình log. */
    private static String compact(String message) {
        if (message == null) {
            return "(không có message)";
        }
        String flattened = message.replaceAll("\\s+", " ").trim();
        return flattened.length() <= FAILURE_REASON_MAX_CHARS
                ? flattened
                : flattened.substring(0, FAILURE_REASON_MAX_CHARS) + "…";
    }

    private List<NewsItemDto> parseRss(String xmlContent, String sourceName, String sourceType) throws Exception {
        if (xmlContent == null || xmlContent.isBlank()) {
            throw new IllegalStateException("body rỗng");
        }
        // BOM/khoảng trắng đầu hợp lệ với ta nhưng làm parser nổ "Content is not allowed in
        // prolog" — cắt trước, rồi mới soi có phải XML không.
        String cleaned = (xmlContent.startsWith("\uFEFF") ? xmlContent.substring(1) : xmlContent).stripLeading();
        if (!cleaned.startsWith("<")) {
            String preview = cleaned.substring(0, Math.min(cleaned.length(), NON_XML_PREVIEW_CHARS))
                    .replaceAll("\\s+", " ");
            throw new IllegalStateException("phản hồi không phải XML, đầu body: \"" + preview + "\"");
        }

        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        // RSS là XML ngoại lai không tin được — cấm DOCTYPE chặn cả XXE lẫn billion-laughs;
        // feed hợp lệ không dùng DOCTYPE.
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(new ByteArrayInputStream(cleaned.getBytes(StandardCharsets.UTF_8)));

        List<NewsItemDto> list = new ArrayList<>();
        NodeList itemNodes = doc.getElementsByTagName("item");
        for (int i = 0; i < Math.min(itemNodes.getLength(), 10); i++) { // Limit 10 per source
            Element item = (Element) itemNodes.item(i);

            String title = getTagValue(item, "title");
            String description = getTagValue(item, "description");
            String link = getTagValue(item, "link");
            String pubDate = getTagValue(item, "pubDate");

            // Clean description HTML tags
            if (description != null) {
                description = description.replaceAll("<[^>]*>", "").trim();
            }

            if (pubDate == null) {
                pubDate = Instant.now().toString();
            }

            list.add(new NewsItemDto(title, description, link, pubDate, sourceName, sourceType));
        }
        return list;
    }

    private String getTagValue(Element parent, String tagName) {
        NodeList nodeList = parent.getElementsByTagName(tagName);
        if (nodeList.getLength() > 0) {
            return nodeList.item(0).getTextContent();
        }
        return null;
    }
}
