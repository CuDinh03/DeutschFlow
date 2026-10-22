package com.deutschflow.grammar.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Chiến thuật từng Teil (LT2, 22/10/2026) — nạp từ resource {@code exam-strategies/<provider>_<level>.json}
 * lúc khởi động. Dữ liệu tĩnh, tự soạn (không chép sách/đề), VI + EN.
 *
 * <p>Owner chốt 21/10: nội dung AI soạn nháp, người duyệt; <b>chưa duyệt thì học viên thấy "Sắp có"</b>.
 * Cờ {@code reviewed} trong file là chỗ duyệt duy nhất. Admin/giáo viên luôn thấy bản nháp (gắn nhãn)
 * để duyệt ngay trong đề.
 */
@Component
public class ExamStrategyCatalog {

    /** Đã duyệt — ai cũng xem. */
    public static final String REVIEWED = "REVIEWED";
    /** Chưa duyệt, người gọi là người duyệt — xem kèm nhãn nháp. */
    public static final String DRAFT = "DRAFT";
    /** Chưa duyệt, người gọi là học viên — không có nội dung. */
    public static final String COMING_SOON = "COMING_SOON";

    private static final Map<String, String> RESOURCES = Map.of(
            "TELC:B1", "/exam-strategies/telc_b1.json");

    @JsonIgnoreProperties(ignoreUnknown = true)
    record File(String provider, String level, List<Teil> teile) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Teil(String section, int teil, double points, boolean reviewed, Content vi, Content en) {}

    public record Fix(String cause, String fix) {}

    public record Content(String title, String format, List<String> steps, List<String> traps, List<Fix> fixes) {}

    /** @param content {@code null} khi {@link #COMING_SOON} */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record StrategyDto(String section, int teil, double points, String status, Content content) {}

    private final Map<String, File> files;

    public ExamStrategyCatalog(ObjectMapper objectMapper) {
        Map<String, File> loaded = new java.util.HashMap<>();
        RESOURCES.forEach((key, resource) -> {
            try (InputStream in = ExamStrategyCatalog.class.getResourceAsStream(resource)) {
                if (in == null) throw new IllegalStateException("Missing resource " + resource);
                loaded.put(key, objectMapper.readValue(in, File.class));
            } catch (IOException e) {
                throw new UncheckedIOException("Cannot load " + resource, e);
            }
        });
        this.files = Map.copyOf(loaded);
    }

    /**
     * Chiến thuật cho một đề. Nhà tổ chức × bậc chưa có nội dung ⇒ rỗng (client không hiện gì).
     *
     * @param lang     {@code vi} hoặc {@code en}; ngôn ngữ khác (giao diện tiếng Đức) dùng bản tiếng Anh
     * @param reviewer người gọi là admin/giáo viên — thấy cả bản nháp
     */
    public List<StrategyDto> forExam(String provider, String level, String lang, boolean reviewer) {
        File file = files.get(key(provider, level));
        if (file == null) return List.of();
        boolean vi = "vi".equalsIgnoreCase(lang == null ? "" : lang.trim());
        return file.teile().stream()
                .map(t -> {
                    Content content = vi ? t.vi() : t.en();
                    if (t.reviewed()) return new StrategyDto(t.section(), t.teil(), t.points(), REVIEWED, content);
                    if (reviewer) return new StrategyDto(t.section(), t.teil(), t.points(), DRAFT, content);
                    return new StrategyDto(t.section(), t.teil(), t.points(), COMING_SOON, null);
                })
                .toList();
    }

    private static String key(String provider, String level) {
        if (provider == null || level == null) return "";
        return provider.trim().toUpperCase(Locale.ROOT) + ":" + level.trim().toUpperCase(Locale.ROOT);
    }
}
