package com.deutschflow.examspeaking.weakness;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Gói Redemittel theo archetype × dải cấp (A1_A2 | B1_B2), nạp từ resource
 * {@code examspeaking/redemittel_packs.json} lúc khởi động — dữ liệu tĩnh, tự soạn theo
 * chức năng ngôn ngữ (không sao chép tài liệu thi). Màn "Ôn yếu điểm" ghép gói theo
 * các dạng bài mà học viên đang yếu.
 */
@Component
public class RedemittelCatalog {

    public record Pack(String archetype, String band, List<String> phrases) {}

    private static final String RESOURCE = "/examspeaking/redemittel_packs.json";
    private static final Set<String> LOW_LEVELS = Set.of("A1", "A2");

    private final List<Pack> packs;

    public RedemittelCatalog(ObjectMapper objectMapper) {
        try (InputStream in = RedemittelCatalog.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Missing resource " + RESOURCE);
            }
            this.packs = List.copyOf(objectMapper.readValue(in, new TypeReference<List<Pack>>() {}));
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load " + RESOURCE, e);
        }
    }

    /** Dải cấp cho một level CEFR: A1/A2 → A1_A2, còn lại (B1+) → B1_B2. */
    public static String bandFor(String level) {
        String lv = level == null ? "" : level.trim().toUpperCase(Locale.ROOT);
        return LOW_LEVELS.contains(lv) ? "A1_A2" : "B1_B2";
    }

    /** Các gói khớp dải cấp của {@code level} và nằm trong tập archetype cho trước (rỗng → tất cả). */
    public List<Pack> packsFor(String level, Collection<String> archetypes) {
        String band = bandFor(level);
        return packs.stream()
                .filter(p -> band.equals(p.band()))
                .filter(p -> archetypes == null || archetypes.isEmpty() || archetypes.contains(p.archetype()))
                .toList();
    }
}
