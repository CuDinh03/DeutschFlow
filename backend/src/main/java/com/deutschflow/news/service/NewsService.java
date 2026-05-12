package com.deutschflow.news.service;

import com.deutschflow.news.dto.NewsItemDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
@RequiredArgsConstructor
public class NewsService {

    private final RestTemplate restTemplate;

    // Cache to store news
    private final ConcurrentHashMap<String, List<NewsItemDto>> cache = new ConcurrentHashMap<>();
    private long lastFetchTime = 0;
    private static final long CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

    private static final String DW_DE = "https://rss.dw.com/xml/rss-de-all";
    private static final String DW_VI = "https://rss.dw.com/xml/rss-vi-all";
    private static final String TAGESSCHAU = "https://www.tagesschau.de/xml/rss2/";
    private static final String SPIEGEL = "https://www.spiegel.de/schlagzeilen/tops/index.rss";

    public List<NewsItemDto> getLatestNews() {
        long now = System.currentTimeMillis();
        if (now - lastFetchTime > CACHE_DURATION_MS || cache.isEmpty()) {
            refreshCache();
        }
        return cache.getOrDefault("latest", Collections.emptyList());
    }

    private synchronized void refreshCache() {
        long now = System.currentTimeMillis();
        if (now - lastFetchTime <= CACHE_DURATION_MS && !cache.isEmpty()) {
            return;
        }

        List<NewsItemDto> allNews = new ArrayList<>();
        allNews.addAll(fetchRss(DW_DE, "DW Deutsch lernen", "DW_LEARN"));
        allNews.addAll(fetchRss(TAGESSCHAU, "Tagesschau", "TAGESSCHAU"));
        allNews.addAll(fetchRss(SPIEGEL, "Der Spiegel", "SPIEGEL"));
        allNews.addAll(fetchRss(DW_VI, "DW Tiếng Việt", "DW_VI"));

        // Sort by publishedAt if we want, but for now we just mix them or show them as fetched.
        // Actually since we don't strictly parse dates to ZonedDateTime, we'll just keep the order.
        
        cache.put("latest", allNews);
        lastFetchTime = System.currentTimeMillis();
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
