package com.deutschflow.system.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thu vi phạm Content-Security-Policy do trình duyệt gửi về từ web (mydeutschflow.com).
 * Nhận cả hai định dạng giao hàng: report-uri cũ ({@code {"csp-report":{...}}}, content-type
 * {@code application/csp-report}) và Reporting API ({@code [{type,body:{...}},…]},
 * {@code application/reports+json}).
 *
 * <p>Đây là endpoint telemetry KHÔNG auth nên nguyên tắc là "không bao giờ trở thành vector":
 * payload rác/parse lỗi chỉ được ĐẾM rồi bỏ (không 5xx — trình duyệt fire-and-forget, lỗi chỉ
 * sinh retry noise); log có sampling theo (directive, host) mỗi giờ để một trang hỏng hàng loạt
 * không dìm log; tag metric bị chặn cardinality (host lạ ngoài top-N gộp thành {@code other});
 * report từ extension trình duyệt chỉ đếm, không log.
 *
 * <p>Đầu ra để theo dõi giai đoạn soak trước khi bật CSP enforce:
 * counter {@code csp_report_total{directive, blocked_host}} + log WARN có cấu trúc.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CspReportIngestService {

    /** blocked-uri của report từ extension — nhiễu kinh điển, chỉ đếm gộp. */
    private static final List<String> EXTENSION_PREFIXES = List.of(
            "chrome-extension", "moz-extension", "safari-extension", "safari-web-extension",
            "ms-browser-extension", "about");

    /** blocked-uri dạng từ khoá trần (không phải URL) mà spec cho phép — giữ nguyên làm tag. */
    private static final Set<String> BARE_KEYWORDS = Set.of(
            "inline", "eval", "wasm-eval", "data", "blob", "asset", "trusted-types-policy", "trusted-types-sink");

    /** Mỗi cặp (directive, host) chỉ log tối đa chừng này dòng mỗi giờ; counter vẫn đếm đủ. */
    private static final int MAX_LOGS_PER_KEY_PER_HOUR = 5;
    /** Trần số giá trị tag blocked_host khác nhau trong một vòng đời JVM — ngoài trần gộp "other". */
    private static final int MAX_HOST_TAG_VALUES = 24;
    /** Một batch Reporting API hợp lệ chỉ vài phần tử; cắt sớm mảng nhồi. */
    private static final int MAX_REPORTS_PER_BATCH = 20;

    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;

    private final ConcurrentHashMap<String, AtomicInteger> hourlyLogBudget = new ConcurrentHashMap<>();
    private final Set<String> knownHostTags = ConcurrentHashMap.newKeySet();
    private volatile long budgetWindowHour = -1L;

    /** Nhận body thô đã qua cap kích thước ở controller. Không bao giờ ném ra ngoài. */
    public void ingest(byte[] body) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (IOException e) {
            count("_unparseable", "_unparseable");
            return;
        }
        if (root == null || root.isNull() || root.isMissingNode()) {
            count("_unparseable", "_unparseable");
            return;
        }
        if (root.isArray()) {
            int taken = 0;
            for (JsonNode item : root) {
                if (taken++ >= MAX_REPORTS_PER_BATCH) {
                    break;
                }
                JsonNode reportBody = item.path("body");
                record(reportBody.isObject() ? reportBody : item);
            }
            return;
        }
        JsonNode legacy = root.path("csp-report");
        record(legacy.isObject() ? legacy : root);
    }

    private void record(JsonNode report) {
        String directive = firstText(report,
                "effective-directive", "effectiveDirective", "violated-directive", "violatedDirective");
        String blocked = firstText(report, "blocked-uri", "blockedURL", "blockedURI");
        String documentUri = firstText(report, "document-uri", "documentURL");
        String sourceFile = firstText(report, "source-file", "sourceFile");
        String lineNumber = firstText(report, "line-number", "lineNumber");

        String directiveTag = normalizeDirective(directive);
        String hostTag = hostTag(blocked, sourceFile);
        count(directiveTag, hostTag);
        if ("extension".equals(hostTag)) {
            return;
        }
        maybeLog(directiveTag, hostTag, blocked, documentUri, sourceFile, lineNumber);
    }

    private void count(String directiveTag, String hostTag) {
        meterRegistry.counter("csp_report_total", "directive", directiveTag, "blocked_host", hostTag)
                .increment();
    }

    /** Log WARN có cấu trúc, sampling theo (directive, host) trên cửa sổ giờ. */
    private void maybeLog(String directiveTag, String hostTag,
                          String blocked, String documentUri, String sourceFile, String lineNumber) {
        long hour = Instant.now().getEpochSecond() / 3600L;
        if (hour != budgetWindowHour) {
            // Đua giữa các thread chỉ làm clear() chạy thừa một lần — sampling là best-effort.
            budgetWindowHour = hour;
            hourlyLogBudget.clear();
        }
        int used = hourlyLogBudget
                .computeIfAbsent(directiveTag + '|' + hostTag, k -> new AtomicInteger())
                .incrementAndGet();
        if (used > MAX_LOGS_PER_KEY_PER_HOUR) {
            return;
        }
        log.warn("[CspReport] directive={} blocked={} doc={} src={}:{}",
                directiveTag, trim(blocked, 300), trim(documentUri, 300), trim(sourceFile, 300), lineNumber);
    }

    /** Tên directive là tập đóng của spec nên tag an toàn; vẫn cắt phòng payload bịa. */
    private static String normalizeDirective(String directive) {
        if (directive == null || directive.isBlank()) {
            return "_missing";
        }
        String d = directive.trim().toLowerCase(Locale.ROOT);
        int space = d.indexOf(' ');
        if (space > 0) {
            d = d.substring(0, space);
        }
        return trim(d, 40);
    }

    /**
     * Quy blocked-uri về một tag host có cardinality bị chặn: từ khoá trần giữ nguyên,
     * extension gộp {@code extension}, URL lấy host, host lạ ngoài trần gộp {@code other}.
     */
    private String hostTag(String blocked, String sourceFile) {
        String raw = (blocked == null || blocked.isBlank()) ? "" : blocked.trim();
        String probe = raw.toLowerCase(Locale.ROOT);
        for (String prefix : EXTENSION_PREFIXES) {
            if (probe.startsWith(prefix)) {
                return "extension";
            }
        }
        if (sourceFile != null) {
            String src = sourceFile.trim().toLowerCase(Locale.ROOT);
            for (String prefix : EXTENSION_PREFIXES) {
                if (src.startsWith(prefix)) {
                    return "extension";
                }
            }
        }
        if (raw.isEmpty()) {
            return "_missing";
        }
        if (BARE_KEYWORDS.contains(probe)) {
            return probe;
        }
        String host;
        try {
            host = URI.create(raw).getHost();
        } catch (IllegalArgumentException e) {
            host = null;
        }
        if (host == null || host.isBlank()) {
            return "_other";
        }
        host = trim(host.toLowerCase(Locale.ROOT), 80);
        if (knownHostTags.contains(host)) {
            return host;
        }
        if (knownHostTags.size() < MAX_HOST_TAG_VALUES) {
            knownHostTags.add(host);
            return host;
        }
        return "other";
    }

    private static String firstText(JsonNode node, String... fieldNames) {
        for (String field : fieldNames) {
            JsonNode value = node.path(field);
            if (!value.isMissingNode() && !value.isNull()) {
                String text = value.asText("");
                if (!text.isBlank()) {
                    return text;
                }
            }
        }
        return null;
    }

    private static String trim(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }
}
