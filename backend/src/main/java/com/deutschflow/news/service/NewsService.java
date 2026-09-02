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
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Tin tức tiếng Đức từ 4 nguồn RSS, làm mới nền mỗi 30 phút.
 *
 * <p>B4 audit lag 02/09: bản cũ refresh NGAY TRÊN REQUEST THREAD trong {@code synchronized} —
 * request xấu số đầu tiên sau mỗi 30' phải ngồi chờ 4 lần fetch RSS tuần tự (1–5s, xấu nhất
 * ~52s khi nguồn treo đến timeout), và mọi request tin tức khác xếp hàng sau khoá. Giờ:
 * {@code @Scheduled} tự refresh nền (chiếm 1 slot scheduling pool vài giây mỗi 30' — pool đã
 * là 4 từ #467), API luôn trả bản đang có ngay lập tức (serve-stale).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NewsService {

    private final RestTemplate restTemplate;

    /** Bản tin đang phục vụ — swap nguyên khối bằng list bất biến, đọc không cần khoá. */
    private volatile List<NewsItemDto> latest = List.of();

    private static final long CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

    private static final String DW_DE = "https://rss.dw.com/xml/rss-de-all";
    private static final String DW_VI = "https://rss.dw.com/xml/rss-vi-all";
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
        allNews.addAll(fetchRss(DW_VI, "DW Tiếng Việt", "DW_VI"));

        // Serve-stale đúng nghĩa: mọi nguồn cùng chết (mạng đứt, DNS hỏng) thì GIỮ bản cũ còn
        // đọc được thay vì đè bằng danh sách rỗng; nguồn nào lỗi lẻ thì fetchRss đã nuốt và
        // allNews vẫn mang phần còn sống.
        if (allNews.isEmpty()) {
            log.warn("News refresh: cả 4 nguồn RSS đều không trả bài — giữ bản cũ ({} bài)", latest.size());
            return;
        }
        latest = List.copyOf(allNews);
        log.info("Refreshed news cache, fetched {} articles", allNews.size());
    }

    private List<NewsItemDto> fetchRss(String url, String sourceName, String sourceType) {
        List<NewsItemDto> list = new ArrayList<>();
        try {
            String xmlContent = restTemplate.getForObject(url, String.class);
            if (xmlContent == null) return list;

            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xmlContent.getBytes("UTF-8")));

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

        } catch (Exception e) {
            log.error("Error fetching RSS from {}: {}", url, e.getMessage());
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
