package com.deutschflow.common.exception;

import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lỗi nghiệp vụ "có chỉ dẫn" (owner yêu cầu 13/11/2026): mọi thông báo admin thấy phải trả lời đủ ba câu —
 * chuyện gì xảy ra, ở đâu, phải làm gì tiếp.
 *
 * <p>Hợp đồng với client:
 * <ul>
 *   <li>{@code detail} (= {@link #getMessage()}) là MỘT đoạn chữ đủ cả ba ý, đọc được khi đứng riêng — client cũ
 *       (kể cả mobile) chỉ đọc trường này vẫn hiểu.</li>
 *   <li>{@code extensions} mang thêm phần máy đọc được: {@code code} (mã ổn định), {@code title}, {@code where}
 *       (đối tượng liên quan), {@code issues[]} (từng mục chưa đạt, mỗi mục có {@code label}, {@code what},
 *       {@code action}, {@code url}, {@code where}) và {@code next} (việc làm sau khi sửa xong). Web dựng khung
 *       lỗi có nút "đi tới chỗ sửa" từ phần này.</li>
 * </ul>
 */
public class GuidedException extends RuntimeException {

    /**
     * Một mục chưa đạt.
     *
     * @param label  ở đâu, đúng tên giao diện đang dùng (vd. "Hören T2 · bản nháp #103")
     * @param what   chuyện gì
     * @param action phải làm gì
     * @param url    đường dẫn trong web tới chỗ sửa; {@code null} nếu không có
     * @param where  đối tượng liên quan dạng máy đọc (runId, section, teil, draftId, itemId, blockId…)
     */
    public record Issue(String code, String label, String what, String action, String url, Map<String, Object> where) {}

    private final HttpStatus status;
    private final String code;
    private final String title;
    private final Map<String, Object> where;
    private final List<Issue> issues;
    private final String next;

    private GuidedException(Builder b) {
        super(text(b));
        this.status = b.status;
        this.code = b.code;
        this.title = b.title;
        this.where = Map.copyOf(b.where);
        this.issues = List.copyOf(b.issues);
        this.next = b.next;
    }

    public static Builder conflict(String code, String title) {
        return new Builder(HttpStatus.CONFLICT, code, title);
    }

    public static Builder badRequest(String code, String title) {
        return new Builder(HttpStatus.BAD_REQUEST, code, title);
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public Map<String, Object> getWhere() { return where; }
    public List<Issue> getIssues() { return issues; }
    public String getNext() { return next; }

    /** Phần {@code extensions} của ProblemDetail. */
    public Map<String, Object> extensions() {
        Map<String, Object> ext = new LinkedHashMap<>();
        ext.put("code", code);
        ext.put("title", title);
        if (!where.isEmpty()) ext.put("where", where);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Issue i : issues) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", i.code());
            if (i.label() != null) m.put("label", i.label());
            m.put("what", i.what());
            if (i.action() != null) m.put("action", i.action());
            if (i.url() != null) m.put("url", i.url());
            if (i.where() != null && !i.where().isEmpty()) m.put("where", i.where());
            list.add(m);
        }
        ext.put("issues", list);
        if (next != null) ext.put("next", next);
        return ext;
    }

    /** Đoạn chữ đứng riêng: tiêu đề, rồi từng mục "ở đâu: chuyện gì. Làm gì.", rồi việc sau cùng. */
    private static String text(Builder b) {
        StringBuilder sb = new StringBuilder(sentence(b.title));
        for (Issue i : b.issues) {
            sb.append(' ');
            if (i.label() != null && !i.label().isBlank()) sb.append(i.label()).append(": ");
            sb.append(sentence(i.what()));
            if (i.action() != null && !i.action().isBlank()) sb.append(' ').append(sentence(i.action()));
        }
        if (b.next != null && !b.next.isBlank()) sb.append(' ').append(sentence(b.next));
        return sb.toString();
    }

    private static String sentence(String s) {
        String t = s == null ? "" : s.trim();
        if (t.isEmpty()) return t;
        char last = t.charAt(t.length() - 1);
        return last == '.' || last == '?' || last == '!' ? t : t + ".";
    }

    public static final class Builder {
        private final HttpStatus status;
        private final String code;
        private final String title;
        private final Map<String, Object> where = new LinkedHashMap<>();
        private final List<Issue> issues = new ArrayList<>();
        private String next;

        private Builder(HttpStatus status, String code, String title) {
            this.status = status;
            this.code = code;
            this.title = title;
        }

        public Builder where(String key, Object value) {
            if (value != null) where.put(key, value);
            return this;
        }

        public Builder issue(Issue issue) {
            issues.add(issue);
            return this;
        }

        public Builder issue(String code, String label, String what, String action, String url, Map<String, Object> at) {
            return issue(new Issue(code, label, what, action, url, at));
        }

        public Builder next(String next) {
            this.next = next;
            return this;
        }

        public GuidedException build() {
            return new GuidedException(this);
        }
    }
}
