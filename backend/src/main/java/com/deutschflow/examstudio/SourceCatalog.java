package com.deutschflow.examstudio;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Phần thuần (không DB, không mạng) của danh mục nguồn: đọc danh sách bài từ feed RSS/Atom hoặc từ một trang mục
 * lục, chuẩn hoá đường dẫn để nhận ra cùng một bài, và chấm bài theo từ khoá chủ đề.
 */
final class SourceCatalog {

    private SourceCatalog() {}

    /** Một bài thấy trong danh sách của nơi đăng. Chỉ có đường dẫn, tiêu đề, ngày — không có nội dung bài. */
    record Entry(String url, String title, Instant publishedAt) {}

    static final int MAX_ENTRIES = 80;
    private static final int MAX_TITLE = 300;

    // ── Feed RSS 2.0 / Atom ──────────────────────────────────────────────────────────────────────────────

    static List<Entry> parseRss(String xml) {
        Document doc = Jsoup.parse(xml == null ? "" : xml, "", Parser.xmlParser());
        Map<String, Entry> out = new LinkedHashMap<>();
        for (Element item : doc.select("item, entry")) {
            String link = textOf(item, "link");
            if (link == null) {
                Element l = item.selectFirst("link[href]");
                if (l != null) link = l.attr("href").trim();
            }
            String url = canonical(link);
            if (url == null) continue;
            String title = clean(textOf(item, "title"));
            Instant when = parseDate(firstNonBlank(textOf(item, "pubDate"), textOf(item, "dc|date"),
                    textOf(item, "published"), textOf(item, "updated")));
            out.putIfAbsent(url, new Entry(url, title, when));
            if (out.size() >= MAX_ENTRIES) break;
        }
        return new ArrayList<>(out.values());
    }

    private static String textOf(Element parent, String tag) {
        Element e = parent.selectFirst("> " + tag);
        if (e == null) return null;
        String t = e.text().trim();
        return t.isEmpty() ? null : t;
    }

    // ── Trang mục lục: lấy các đường dẫn khớp mẫu ────────────────────────────────────────────────────────

    /** {@code linkPattern} là biểu thức chính quy tìm trong đường dẫn đã chuẩn hoá (vd. {@code /presse/\d{4}/…}). */
    static List<Entry> parseIndex(String html, String pageUrl, String linkPattern) {
        if (linkPattern == null || linkPattern.isBlank()) return List.of();
        Pattern p = Pattern.compile(linkPattern);
        Document doc = Jsoup.parse(html == null ? "" : html, pageUrl);
        Map<String, Entry> out = new LinkedHashMap<>();
        for (Element a : doc.select("a[href]")) {
            String url = canonical(a.absUrl("href"));
            if (url == null || !p.matcher(url).find()) continue;
            String title = clean(firstNonBlank(a.text(), a.attr("title"), a.attr("aria-label")));
            Entry prev = out.get(url);
            // Cùng một bài hay có hai thẻ a (ảnh và tiêu đề): giữ thẻ có chữ.
            if (prev == null || (prev.title() == null && title != null)) out.put(url, new Entry(url, title, null));
            if (out.size() >= MAX_ENTRIES) break;
        }
        return new ArrayList<>(out.values());
    }

    // ── Sitemap: nơi đăng không có feed nhưng công bố toàn bộ địa chỉ trang ───────────────────────────────

    static final int MAX_SITEMAP_ENTRIES = 5_000;
    private static final Pattern LOC = Pattern.compile("<loc>\\s*([^<\\s]+)\\s*</loc>");

    /**
     * Các địa chỉ trong sitemap khớp {@code linkPattern}. Sitemap không có tiêu đề, nên tiêu đề tạm lấy từ đường
     * dẫn ({@link #titleFromPath}) để chấm theo từ khoá chủ đề; tiêu đề thật có khi tải bài.
     */
    static List<Entry> parseSitemap(String xml, String linkPattern) {
        if (xml == null || linkPattern == null || linkPattern.isBlank()) return List.of();
        Pattern p = Pattern.compile(linkPattern);
        Map<String, Entry> out = new LinkedHashMap<>();
        java.util.regex.Matcher m = LOC.matcher(xml);
        while (m.find() && out.size() < MAX_SITEMAP_ENTRIES) {
            String url = canonical(m.group(1).replace("&amp;", "&"));
            if (url == null || !p.matcher(url).find()) continue;
            out.putIfAbsent(url, new Entry(url, titleFromPath(url), null));
        }
        return new ArrayList<>(out.values());
    }

    /** ".../de/themen/bauen_und_wohnen/wohnen/Seite.210100" → "bauen und wohnen / wohnen". */
    static String titleFromPath(String url) {
        String path;
        try {
            path = URI.create(url).getPath();
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (path == null) return null;
        List<String> parts = new ArrayList<>();
        for (String seg : path.split("/")) {
            if (seg.isBlank() || seg.length() <= 2 || seg.matches("\\d+|Seite\\.\\d+|themen")) continue;
            parts.add(seg.replace('_', ' ').replaceAll("-+", " ").trim());
        }
        return clean(String.join(" / ", parts));
    }

    // ── Chuẩn hoá đường dẫn ──────────────────────────────────────────────────────────────────────────────

    private static final Pattern SESSION = Pattern.compile(";jsessionid=[^?#/]*", Pattern.CASE_INSENSITIVE);
    private static final Pattern TRACKING = Pattern.compile("^(utm_[a-z]+|nn|wt_[a-z]+|ref|cid|at_medium|at_campaign)$",
            Pattern.CASE_INSENSITIVE);

    /** Bỏ mã phiên, phần neo và tham số theo dõi; tên miền viết thường. Không phải http(s) ⇒ {@code null}. */
    static String canonical(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = SESSION.matcher(raw.trim()).replaceAll("");
        URI u;
        try {
            u = URI.create(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (!(scheme.equals("http") || scheme.equals("https")) || u.getHost() == null) return null;
        String path = u.getRawPath() == null || u.getRawPath().isEmpty() ? "/" : u.getRawPath();
        if (path.length() > 1 && path.endsWith("/")) path = path.substring(0, path.length() - 1);
        String query = null;
        if (u.getRawQuery() != null && !u.getRawQuery().isEmpty()) {
            query = java.util.Arrays.stream(u.getRawQuery().split("&"))
                    .filter(kv -> !kv.isEmpty() && !TRACKING.matcher(kv.split("=", 2)[0]).matches())
                    .collect(Collectors.joining("&"));
        }
        return scheme + "://" + u.getHost().toLowerCase(Locale.ROOT)
                + (u.getPort() == -1 ? "" : ":" + u.getPort()) + path
                + (query == null || query.isEmpty() ? "" : "?" + query);
    }

    static String hash(String canonicalUrl) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonicalUrl.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // ── Ngày đăng ────────────────────────────────────────────────────────────────────────────────────────

    static Instant parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        String v = s.trim();
        try {
            return ZonedDateTime.parse(v, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (RuntimeException ignored) {
            // thử dạng ISO
        }
        try {
            return OffsetDateTime.parse(v).toInstant();
        } catch (RuntimeException ignored) {
            // thử dạng ISO không có múi giờ
        }
        try {
            return Instant.parse(v);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    // ── Chấm bài theo từ khoá chủ đề ─────────────────────────────────────────────────────────────────────

    /**
     * Số từ khoá xuất hiện trong tiêu đề (không phân biệt hoa thường). Từ khoá ≥ 4 chữ khớp cả khi nằm trong từ
     * ghép, nên hãy đưa GỐC từ: "miet" khớp Miete, Mieten, Mietpreise. Từ khoá ngắn hơn phải đứng riêng thành một
     * từ. Tiêu đề trống ⇒ 0.
     */
    static int score(String title, Collection<String> keywords) {
        if (title == null || keywords == null) return 0;
        String t = fold(title);
        int n = 0;
        for (String k : keywords) {
            if (k == null || k.isBlank()) continue;
            String kw = fold(k.trim());
            boolean hit = kw.length() >= 4 ? t.contains(kw)
                    : Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(kw) + "(?![\\p{L}\\p{N}])").matcher(t).find();
            if (hit) n++;
        }
        return n;
    }

    /** Viết thường và đổi ä/ö/ü/ß thành ae/oe/ue/ss: đường dẫn hay viết "fuehrerschein" cho "Führerschein". */
    static String fold(String s) {
        return s.toLowerCase(Locale.GERMAN).replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss");
    }

    private static String clean(String s) {
        if (s == null) return null;
        String t = s.replaceAll("\\s+", " ").trim();
        if (t.isEmpty()) return null;
        return t.length() > MAX_TITLE ? t.substring(0, MAX_TITLE) : t;
    }

    private static String firstNonBlank(String... vs) {
        for (String v : vs) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }
}
