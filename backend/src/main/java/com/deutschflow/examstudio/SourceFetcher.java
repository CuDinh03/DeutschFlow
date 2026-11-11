package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tải một trang báo cho Xưởng đề (owner chốt 09/11: cho máy tự tải, có giới hạn; luôn có phương án dán tay).
 *
 * <p>Giới hạn: chỉ http/https cổng mặc định; từ chối host phân giải ra địa chỉ nội bộ (loopback, mạng LAN,
 * link-local, multicast, IPv6 ULA) ở MỌI bước chuyển hướng — chống SSRF vào máy chủ nhà và VM; tối đa
 * 3 lần chuyển hướng, 10 s, 2 MB; tôn trọng robots.txt; không vượt paywall (nội dung quá ngắn ⇒ báo dán tay).
 * Văn bản tải về chỉ sống trong bộ nhớ của job, không ghi DB.
 */
@Slf4j
@Component
public class SourceFetcher {

    static final String USER_AGENT = "DeutschFlow-ExamStudio/1.0";
    private static final int TIMEOUT_MS = 10_000;
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;
    static final int MIN_TEXT_CHARS = 800;

    public record Fetched(String url, String title, String author, String publisher, String publishedAt,
                          String licenseText, boolean ccBy, String text) {}

    /** Có thể thay trong test (không gọi mạng thật). */
    interface HostResolver {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    private final HostResolver resolver;

    public SourceFetcher() {
        this(InetAddress::getAllByName);
    }

    SourceFetcher(HostResolver resolver) {
        this.resolver = resolver;
    }

    private static final String PASTE_HINT = " Hãy dán văn bản bài báo.";

    public Fetched fetch(String rawUrl) {
        Connection.Response res = load(rawUrl, PASTE_HINT, MAX_BYTES);
        String ct = res.contentType() == null ? "" : res.contentType().toLowerCase(Locale.ROOT);
        if (!ct.contains("html")) {
            throw new BadRequestException("Đường dẫn không phải trang web (" + ct + ")." + PASTE_HINT);
        }
        Document doc;
        try {
            doc = res.parse();
        } catch (Exception e) {
            throw new BadRequestException("Không đọc được trang." + PASTE_HINT);
        }
        return extract(doc, res.url().toString());
    }

    /** Thân trang thô (feed RSS, trang mục lục) — cùng các chốt chặn với {@link #fetch}: SSRF, robots.txt, 2 MB. */
    public record Raw(String url, String contentType, String body) {}

    public Raw fetchRaw(String rawUrl) {
        return fetchRaw(rawUrl, MAX_BYTES);
    }

    /** Trần riêng cho sitemap lớn của một nơi đăng trong danh mục (vd. oesterreich.gv.at ~3,5 MB). */
    public static final int MAX_SITEMAP_BYTES = 8 * 1024 * 1024;

    public Raw fetchRaw(String rawUrl, int maxBytes) {
        Connection.Response res = load(rawUrl, "", Math.min(Math.max(maxBytes, 1), MAX_SITEMAP_BYTES));
        return new Raw(res.url().toString(), res.contentType(), res.body());
    }

    /** Tải một địa chỉ công khai: kiểm địa chỉ ở MỌI lần chuyển hướng, tôn trọng robots.txt, chỉ nhận mã 200. */
    private Connection.Response load(String rawUrl, String hint, int maxBytes) {
        URI uri = validate(rawUrl);
        if (!robotsAllow(uri)) {
            throw new BadRequestException("Trang này chặn máy tải tự động (robots.txt)." + hint);
        }
        Connection.Response res = null;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            try {
                res = Jsoup.connect(uri.toString())
                        .userAgent(USER_AGENT)
                        .timeout(TIMEOUT_MS)
                        .maxBodySize(maxBytes)
                        .followRedirects(false)
                        .ignoreHttpErrors(true)
                        .ignoreContentType(true)
                        .execute();
            } catch (Exception e) {
                throw new BadRequestException("Không tải được trang (" + e.getClass().getSimpleName() + ")." + hint);
            }
            int code = res.statusCode();
            if (code >= 300 && code < 400 && res.header("Location") != null) {
                uri = validate(uri.resolve(res.header("Location")).toString());
                continue;
            }
            if (code != 200) {
                throw new BadRequestException("Trang trả mã " + code + "." + hint);
            }
            break;
        }
        if (res == null || (res.statusCode() >= 300 && res.statusCode() < 400)) {
            throw new BadRequestException("Trang chuyển hướng quá nhiều lần." + hint);
        }
        return res;
    }

    /** Bóc nội dung chính, thông tin bài và dòng giấy phép. Tách ra để test bằng HTML tĩnh. */
    static Fetched extract(Document doc, String url) {
        String title = firstNonBlank(meta(doc, "og:title"), doc.title());
        String author = firstNonBlank(meta(doc, "author"), meta(doc, "article:author"), meta(doc, "dc.creator"),
                meta(doc, "citation_author"));
        String publisher = firstNonBlank(meta(doc, "og:site_name"), meta(doc, "citation_journal_title"),
                meta(doc, "dc.publisher"));
        String published = firstNonBlank(meta(doc, "article:published_time"), meta(doc, "citation_publication_date"),
                meta(doc, "dc.date"), meta(doc, "date"));

        String license = detectLicense(doc);
        boolean ccBy = isPlainCcBy(license);

        Element root = doc.selectFirst("article");
        if (root == null) root = doc.selectFirst("main");
        if (root == null) root = doc.body();
        List<String> paras = new ArrayList<>();
        if (root != null) {
            for (Element p : root.select("p")) {
                String t = p.text().trim();
                if (t.length() >= 40) paras.add(t);
            }
        }
        String text = String.join("\n\n", paras);
        if (text.length() < MIN_TEXT_CHARS) {
            throw new BadRequestException("Chỉ đọc được " + text.length() + " ký tự nội dung (có thể do paywall "
                    + "hoặc trang dựng bằng script). Hãy dán văn bản bài báo.");
        }
        return new Fetched(url, title, author, publisher, published, license, ccBy, text);
    }

    private static final Pattern CC_URL = Pattern.compile(
            "creativecommons\\.org/licenses/([a-z\\-]+)/(\\d(?:\\.\\d)?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CC_TEXT = Pattern.compile(
            "\\bCC[ -]BY(?:[ -](?:SA|NC|ND))*(?:[ -]\\d(?:\\.\\d)?)?", Pattern.CASE_INSENSITIVE);

    static String detectLicense(Document doc) {
        Element rel = doc.selectFirst("a[rel=license], link[rel=license]");
        if (rel != null) {
            Matcher m = CC_URL.matcher(rel.attr("href"));
            if (m.find()) return "CC " + m.group(1).toUpperCase(Locale.ROOT) + " " + m.group(2);
        }
        for (Element a : doc.select("a[href*=creativecommons.org/licenses]")) {
            Matcher m = CC_URL.matcher(a.attr("href"));
            if (m.find()) return "CC " + m.group(1).toUpperCase(Locale.ROOT) + " " + m.group(2);
        }
        String dcRights = firstNonBlank(meta(doc, "dc.rights"), meta(doc, "dcterms.license"));
        if (dcRights != null) {
            Matcher m = CC_URL.matcher(dcRights);
            if (m.find()) return "CC " + m.group(1).toUpperCase(Locale.ROOT) + " " + m.group(2);
        }
        Matcher t = CC_TEXT.matcher(doc.text());
        if (t.find()) return t.group().toUpperCase(Locale.ROOT).replace('-', ' ').replaceAll("\\s+", " ").trim();
        return null;
    }

    /** Chỉ CC BY trơn mới được chuyển thể (owner 07/11): BY-SA, BY-NC, BY-ND đều chỉ lấy dữ kiện. */
    static boolean isPlainCcBy(String license) {
        if (license == null) return false;
        String u = license.toUpperCase(Locale.ROOT).replace('-', ' ').replaceAll("\\s+", " ").trim();
        // Bản địa phương hoá theo nước (vd. "CC BY 3.0 DE" của RKI) vẫn là CC BY trơn.
        return u.matches("CC BY( \\d(\\.\\d)?)?( (DE|AT|CH))?");
    }

    URI validate(String rawUrl) {
        URI uri;
        try {
            uri = URI.create(rawUrl == null ? "" : rawUrl.trim());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Đường dẫn không hợp lệ.");
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new BadRequestException("Chỉ nhận đường dẫn http hoặc https.");
        }
        if (uri.getHost() == null || uri.getHost().isBlank()) {
            throw new BadRequestException("Đường dẫn thiếu tên miền.");
        }
        if (uri.getPort() != -1 && uri.getPort() != 80 && uri.getPort() != 443) {
            throw new BadRequestException("Không nhận đường dẫn có cổng riêng.");
        }
        if (uri.getUserInfo() != null) {
            throw new BadRequestException("Đường dẫn không được chứa tài khoản.");
        }
        InetAddress[] addrs;
        try {
            addrs = resolver.resolve(uri.getHost());
        } catch (UnknownHostException e) {
            throw new BadRequestException("Không tìm thấy tên miền " + uri.getHost() + ".");
        }
        for (InetAddress a : addrs) {
            if (isInternal(a)) {
                throw new BadRequestException("Không được tải địa chỉ nội bộ.");
            }
        }
        return uri;
    }

    static boolean isInternal(InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress()
                || a.isMulticastAddress()) {
            return true;
        }
        byte[] b = a.getAddress();
        if (a instanceof Inet6Address) {
            if ((b[0] & 0xfe) == 0xfc) return true; // fc00::/7 ULA
            // ::ffff:a.b.c.d — xét địa chỉ IPv4 bên trong
            boolean mapped = true;
            for (int i = 0; i < 10; i++) if (b[i] != 0) mapped = false;
            if (mapped && (b[10] & 0xff) == 0xff && (b[11] & 0xff) == 0xff) {
                try {
                    return isInternal(InetAddress.getByAddress(new byte[]{b[12], b[13], b[14], b[15]}));
                } catch (UnknownHostException e) {
                    return true;
                }
            }
            return false;
        }
        int b0 = b[0] & 0xff;
        int b1 = b[1] & 0xff;
        if (b0 == 100 && b1 >= 64 && b1 <= 127) return true; // 100.64/10 CGNAT
        if (b0 == 0) return true;
        return b0 == 169 && b1 == 254;
    }

    /** robots.txt: luật của nhóm User-agent * (và tên máy của mình). Không đọc được ⇒ cho phép. */
    boolean robotsAllow(URI uri) {
        String robotsUrl = uri.getScheme() + "://" + uri.getHost() + "/robots.txt";
        String body;
        try {
            validate(robotsUrl);
            Connection.Response r = Jsoup.connect(robotsUrl).userAgent(USER_AGENT).timeout(5_000)
                    .maxBodySize(256 * 1024).followRedirects(false).ignoreContentType(true)
                    .ignoreHttpErrors(true).execute();
            if (r.statusCode() != 200) return true;
            body = r.body();
        } catch (Exception e) {
            return true;
        }
        String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        return robotsAllows(body, path);
    }

    static boolean robotsAllows(String robots, String path) {
        boolean inGroup = false;
        boolean groupHasRules = false;
        String bestRule = null;
        boolean bestAllow = true;
        for (String line : robots.split("\\r?\\n")) {
            String l = line.replaceAll("#.*", "").trim();
            if (l.isEmpty()) continue;
            int c = l.indexOf(':');
            if (c < 0) continue;
            String key = l.substring(0, c).trim().toLowerCase(Locale.ROOT);
            String val = l.substring(c + 1).trim();
            if (key.equals("user-agent")) {
                if (groupHasRules) {
                    inGroup = false;
                    groupHasRules = false;
                }
                String ua = val.toLowerCase(Locale.ROOT);
                if (ua.equals("*") || USER_AGENT.toLowerCase(Locale.ROOT).startsWith(ua)) inGroup = true;
            } else if (key.equals("allow") || key.equals("disallow")) {
                groupHasRules = true;
                if (!inGroup || val.isEmpty()) continue;
                String prefix = val.replace("*", "");
                if (val.endsWith("$")) prefix = prefix.substring(0, prefix.length() - 1);
                if (path.startsWith(prefix) && (bestRule == null || prefix.length() >= bestRule.length())) {
                    bestRule = prefix;
                    bestAllow = key.equals("allow");
                }
            }
        }
        return bestAllow;
    }

    private static String meta(Document doc, String name) {
        Element e = doc.selectFirst("meta[property=" + name + "], meta[name=" + name + "]");
        if (e == null) e = doc.selectFirst("meta[name=" + name.toUpperCase(Locale.ROOT) + "]");
        String v = e == null ? null : e.attr("content").trim();
        return v == null || v.isEmpty() ? null : v;
    }

    private static String firstNonBlank(String... vs) {
        for (String v : vs) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }
}
