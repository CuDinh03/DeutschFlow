package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * Ghép bộ đề từ kho Teil (Xưởng đề đợt 2): lấy một đề viết tay đang chạy làm NỀN (giữ khung khối giờ,
 * pass_rule, điểm, phần Nghe/Viết…), thay từng Teil được chọn bằng một Teil đã duyệt trong
 * {@code exam_teil_blocks}, rồi lưu thành một dòng {@code mock_exams} mới {@code origin = STUDIO},
 * {@code reviewed = FALSE} ("Sắp có") cho tới khi owner bấm phát hành.
 *
 * <p>{@code sections_json} của đề mới là BẢN CHỤP: sửa hay gỡ Teil trong kho về sau không đổi đề đã ghép,
 * nên bài làm cũ vẫn chấm và xem lại đúng. {@code block_ids} giữ {@code {"baseExamId": …, "teile": [{section,
 * teil, blockId}]}} để truy vết.
 */
@Service
@RequiredArgsConstructor
public class ExamAssemblyService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public record BaseExam(long id, String title, boolean reviewed, List<Slot> slots) {}

    public record Slot(String section, int teil, String type) {}

    public record SlotBlocks(String section, int teil, String type, List<BlockOption> blocks) {}

    /** {@code usedIn}: các bộ đề ghép ĐANG CHẠY đã dùng Teil này (chống trùng giữa các bộ đề). */
    public record BlockOption(long id, String titleDe, String theme, Map<String, Integer> difficultyCounts,
                              int exposureCount, List<Map<String, Object>> usedIn) {}

    public record Replacement(String section, Integer teil, Long blockId) {}

    /**
     * {@code allowReuse}: mặc định false — một Teil kho chỉ nằm trong MỘT bộ đề đang chạy, để hai bộ đề học viên
     * làm không trùng phần nào. Admin bật khi cố ý (vd. bộ luyện riêng cho một lớp).
     */
    public record AssembleRequest(Long baseExamId, String title, List<Replacement> replacements, Boolean allowReuse) {
        public AssembleRequest(Long baseExamId, String title, List<Replacement> replacements) {
            this(baseExamId, title, replacements, false);
        }
    }

    public record Assembled(long id, String title, String cefrLevel, String examFormat, boolean reviewed,
                            boolean active, Long baseExamId, List<Map<String, Object>> teile, Instant createdAt) {}

    // ── Ghép từ khung (Xưởng đề đợt 4): cấp chưa có đề viết tay làm nền, mọi Teil đều lấy từ kho ──────────

    /** Một khung đề: phần thi, Teil, điểm, giờ — lấy theo tài liệu chính thức của kỳ thi. */
    public record Blueprint(String examFormat, String cefrLevel, String title, String descriptionVi, int timeLimitMinutes,
                            int totalPoints, int passPoints, List<BlueprintSection> sections, List<Map<String, Object>> blocks) {}

    public record BlueprintSection(String name, String labelVi, int timeMinutes, int maxPoints, List<Slot> slots) {}

    /**
     * telc Deutsch A2 / Start Deutsch 2 (Übungstest 1, telc 2024): Lesen 3 Teil × 5 câu = 15, Schreiben Teil 1
     * form 5 + Teil 2 = 10 ⇒ 15; Lesen và Schreiben chung 50 phút. Hören (15 điểm, ~20 phút) và Sprechen (15) chưa
     * có trong Xưởng đề ⇒ đề ghép là đề luyện Đọc–Viết 30 điểm; ngưỡng 60 % như luật telc (18/30).
     */
    static final Blueprint TELC_A2 = new Blueprint("TELC", "A2", "telc Deutsch A2 (Start Deutsch 2) — Đọc và Viết",
            "Đề luyện định dạng telc Deutsch A2 / Start Deutsch 2, soạn gốc, không liên kết với telc: Đọc (3 Teil) và "
                    + "Viết (form + E-Mail ngắn). Phần Nghe và Nói chưa có trong đề này.",
            50, 30, 18,
            List.of(new BlueprintSection("LESEN", "Đọc", 50, 15, List.of(
                            new Slot("LESEN", 1, "MULTIPLE_CHOICE"), new Slot("LESEN", 2, "TRUE_FALSE"),
                            new Slot("LESEN", 3, "MATCH_AD_X"))),
                    new BlueprintSection("SCHREIBEN", "Viết", 0, 15, List.of(
                            new Slot("SCHREIBEN", 1, "FILL_FORM"), new Slot("SCHREIBEN", 2, "WRITE_NOTE")))),
            List.of(Map.of("id", "LS", "minutes", 50, "sections", List.of("LESEN", "SCHREIBEN"))));

    static final List<Blueprint> BLUEPRINTS = List.of(TELC_A2);

    public List<Blueprint> blueprints() {
        return BLUEPRINTS;
    }

    public record BlueprintAssembleRequest(String examFormat, String cefrLevel, String title,
                                           List<Replacement> replacements, Boolean allowReuse) {}

    /** Ghép đủ mọi Teil của khung từ kho; thiếu ô nào là lỗi (không có đề nền để lấp). */
    @Transactional
    public Assembled assembleFromBlueprint(BlueprintAssembleRequest req) {
        Blueprint bp = BLUEPRINTS.stream()
                .filter(b -> b.examFormat().equalsIgnoreCase(String.valueOf(req.examFormat()))
                        && b.cefrLevel().equalsIgnoreCase(String.valueOf(req.cefrLevel())))
                .findFirst().orElseThrow(() -> new BadRequestException("Chưa có khung đề cho " + req.examFormat() + " "
                        + req.cefrLevel() + "."));
        if (req.title() == null || req.title().isBlank()) throw new BadRequestException("Đặt tên cho bộ đề.");
        Map<String, Long> chosen = new HashMap<>();
        for (Replacement r : req.replacements() == null ? List.<Replacement>of() : req.replacements()) {
            if (r != null && r.blockId() != null) chosen.put(r.section() + ":" + r.teil(), r.blockId());
        }
        List<String> missing = new ArrayList<>();
        for (BlueprintSection sec : bp.sections()) for (Slot sl : sec.slots()) {
            if (!chosen.containsKey(sl.section() + ":" + sl.teil())) missing.add(sl.section() + " Teil " + sl.teil());
        }
        if (!missing.isEmpty()) throw new BadRequestException("Khung " + bp.cefrLevel() + " cần đủ Teil — còn thiếu: "
                + String.join(", ", missing) + ".");
        if (chosen.values().stream().distinct().count() != chosen.size()) {
            throw new BadRequestException("Một Teil kho không dùng hai chỗ.");
        }
        if (!Boolean.TRUE.equals(req.allowReuse())) {
            List<String> clashes = new ArrayList<>();
            for (Long id : chosen.values()) {
                for (Map<String, Object> u : usedIn(id)) clashes.add("Teil kho #" + id + " đang nằm trong \"" + u.get("title") + "\"");
            }
            if (!clashes.isEmpty()) throw new ConflictException(String.join("; ", clashes)
                    + ". Chọn Teil khác, hoặc bật \"Cho dùng lại Teil đã có trong bộ khác\" nếu cố ý.");
        }
        Set<String> wanted = new TreeSet<>();
        chosen.forEach((k, v) -> wanted.add(k + ":" + v));
        for (Assembled other : list()) {
            if (!other.active() || other.baseExamId() != null) continue;
            Set<String> theirs = new TreeSet<>();
            for (Map<String, Object> t : other.teile()) theirs.add(t.get("section") + ":" + t.get("teil") + ":" + t.get("blockId"));
            if (theirs.equals(wanted)) throw new ConflictException("Bộ đề này đã có: \"" + other.title() + "\" (#" + other.id() + ").");
        }

        com.fasterxml.jackson.databind.node.ObjectNode root = mapper.createObjectNode();
        root.put("format", bp.examFormat());
        root.set("blocks", mapper.valueToTree(bp.blocks()));
        ArrayNode sections = root.putArray("sections");
        List<Map<String, Object>> trace = new ArrayList<>();
        for (BlueprintSection sec : bp.sections()) {
            ObjectNode sn = sections.addObject();
            sn.put("name", sec.name());
            sn.put("label_vi", sec.labelVi());
            sn.put("time_minutes", sec.timeMinutes());
            sn.put("max_points", sec.maxPoints());
            ArrayNode teile = sn.putArray("teile");
            for (Slot sl : sec.slots()) {
                long blockId = chosen.get(sl.section() + ":" + sl.teil());
                List<Map<String, Object>> blk = jdbc.queryForList("""
                        SELECT exam_format, cefr_level, section, teil, status, content_json::text AS content
                        FROM exam_teil_blocks WHERE id = ?
                        """, blockId);
                if (blk.isEmpty()) throw new NotFoundException("Không có Teil kho " + blockId + ".");
                Map<String, Object> k = blk.get(0);
                if (!"APPROVED".equals(k.get("status"))) throw new BadRequestException("Teil kho " + blockId + " đã gỡ.");
                if (!bp.examFormat().equalsIgnoreCase((String) k.get("exam_format")) || !bp.cefrLevel().equals(k.get("cefr_level"))
                        || !sl.section().equals(k.get("section")) || ((Number) k.get("teil")).intValue() != sl.teil()) {
                    throw new BadRequestException("Teil kho " + blockId + " không khớp ô " + sl.section() + " Teil " + sl.teil() + ".");
                }
                ObjectNode content = (ObjectNode) parse((String) k.get("content"));
                content.put("teil", sl.teil());
                teile.add(content);
                Map<String, Object> t = new LinkedHashMap<>();
                t.put("section", sl.section());
                t.put("teil", sl.teil());
                t.put("blockId", blockId);
                trace.add(t);
            }
        }
        Map<String, Object> blockIds = new LinkedHashMap<>();
        blockIds.put("blueprint", bp.examFormat() + ":" + bp.cefrLevel());
        blockIds.put("teile", trace);
        Long id = jdbc.queryForObject("""
                INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, sections_json, total_points,
                                        pass_points, time_limit_minutes, is_active, reviewed, origin, block_ids)
                VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, TRUE, FALSE, 'STUDIO', ?::jsonb) RETURNING id
                """, Long.class, bp.cefrLevel(), bp.examFormat(), req.title().trim(), bp.descriptionVi(), json(root),
                bp.totalPoints(), bp.passPoints(), bp.timeLimitMinutes(), json(blockIds));
        for (Long b : chosen.values()) jdbc.update("UPDATE exam_teil_blocks SET exposure_count = exposure_count + 1 WHERE id = ?", b);
        return get(id);
    }

    /** Đề viết tay đang chạy của kỳ thi + cấp, kèm danh sách Teil để biết thay được ô nào. */
    public List<BaseExam> bases(String format, String level) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, title, reviewed, sections_json::text AS sections
                FROM mock_exams
                WHERE UPPER(exam_format) = UPPER(?) AND cefr_level = ? AND is_active = TRUE AND origin = 'HANDWRITTEN'
                ORDER BY id
                """, format, level);
        List<BaseExam> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            out.add(new BaseExam(((Number) r.get("id")).longValue(), (String) r.get("title"),
                    Boolean.TRUE.equals(r.get("reviewed")), slotsOf(parse((String) r.get("sections")))));
        }
        return out;
    }

    /** Ô Teil nào trong kho đã có Teil duyệt, kèm các lựa chọn (ít dùng nhất lên đầu). */
    public List<SlotBlocks> slots(String format, String level) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, section, teil, teil_type, theme, exposure_count, content_json->>'title_de' AS title_de,
                       content_json->'items' AS items
                FROM exam_teil_blocks
                WHERE UPPER(exam_format) = UPPER(?) AND cefr_level = ? AND status = 'APPROVED'
                ORDER BY section, teil, exposure_count, id
                """, format, level);
        Map<String, SlotBlocks> bySlot = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            String section = (String) r.get("section");
            int teil = ((Number) r.get("teil")).intValue();
            SlotBlocks sb = bySlot.computeIfAbsent(section + ":" + teil,
                    k -> new SlotBlocks(section, teil, (String) r.get("teil_type"), new ArrayList<>()));
            long blockId = ((Number) r.get("id")).longValue();
            sb.blocks().add(new BlockOption(blockId, (String) r.get("title_de"),
                    (String) r.get("theme"), counts(r.get("items")), ((Number) r.get("exposure_count")).intValue(),
                    usedIn(blockId)));
        }
        return new ArrayList<>(bySlot.values());
    }

    @Transactional
    public Assembled assemble(AssembleRequest req) {
        if (req == null || req.baseExamId() == null) throw new BadRequestException("Chọn đề nền.");
        if (req.title() == null || req.title().isBlank()) throw new BadRequestException("Đặt tên cho bộ đề.");
        if (req.title().length() > 200) throw new BadRequestException("Tên bộ đề tối đa 200 ký tự.");
        List<Replacement> reps = req.replacements() == null ? List.of() : req.replacements().stream()
                .filter(r -> r != null && r.blockId() != null).toList();
        if (reps.isEmpty()) throw new BadRequestException("Chọn ít nhất một Teil từ kho để thay.");

        List<Map<String, Object>> base = jdbc.queryForList("""
                SELECT id, cefr_level, exam_format, title, description_vi, sections_json::text AS sections,
                       total_points, pass_points, time_limit_minutes, origin, is_active
                FROM mock_exams WHERE id = ?
                """, req.baseExamId());
        if (base.isEmpty()) throw new NotFoundException("Không tìm thấy đề nền.");
        Map<String, Object> b = base.get(0);
        if (!"HANDWRITTEN".equals(b.get("origin")) || !Boolean.TRUE.equals(b.get("is_active"))) {
            throw new BadRequestException("Đề nền phải là đề viết tay đang chạy.");
        }
        String format = (String) b.get("exam_format");
        String level = (String) b.get("cefr_level");
        JsonNode sections = parse((String) b.get("sections"));

        // Chống trùng mức bộ đề (owner 10/11): (1) không ghép lại đúng bộ đã có; (2) Teil kho đã nằm trong bộ
        // đề đang chạy khác thì không dùng lại, trừ khi admin bật allowReuse.
        Set<String> wanted = new TreeSet<>();
        for (Replacement r : reps) wanted.add(r.section() + ":" + r.teil() + ":" + r.blockId());
        for (Assembled other : list()) {
            if (!other.active() || !Objects.equals(other.baseExamId(), req.baseExamId())) continue;
            Set<String> theirs = new TreeSet<>();
            for (Map<String, Object> t : other.teile()) theirs.add(t.get("section") + ":" + t.get("teil") + ":" + t.get("blockId"));
            if (theirs.equals(wanted)) {
                throw new ConflictException("Bộ đề này đã có: \"" + other.title() + "\" (#" + other.id() + ").");
            }
        }
        if (!Boolean.TRUE.equals(req.allowReuse())) {
            List<String> clashes = new ArrayList<>();
            for (Replacement r : reps) {
                for (Map<String, Object> u : usedIn(r.blockId())) {
                    clashes.add("Teil kho #" + r.blockId() + " đang nằm trong \"" + u.get("title") + "\" (#" + u.get("id") + ")");
                }
            }
            if (!clashes.isEmpty()) {
                throw new ConflictException(String.join("; ", clashes)
                        + ". Chọn Teil khác, hoặc bật \"Cho dùng lại Teil đã có trong bộ khác\" nếu cố ý.");
            }
        }

        Set<String> seenSlots = new HashSet<>();
        Set<Long> seenBlocks = new HashSet<>();
        List<Map<String, Object>> trace = new ArrayList<>();
        for (Replacement r : reps) {
            String slotKey = r.section() + ":" + r.teil();
            if (!seenSlots.add(slotKey)) throw new BadRequestException("Teil " + slotKey + " bị chọn hai lần.");
            if (!seenBlocks.add(r.blockId())) throw new BadRequestException("Một Teil kho không dùng hai chỗ.");
            List<Map<String, Object>> blk = jdbc.queryForList("""
                    SELECT exam_format, cefr_level, section, teil, teil_type, status, content_json::text AS content
                    FROM exam_teil_blocks WHERE id = ?
                    """, r.blockId());
            if (blk.isEmpty()) throw new NotFoundException("Không có Teil kho " + r.blockId() + ".");
            Map<String, Object> k = blk.get(0);
            if (!"APPROVED".equals(k.get("status"))) throw new BadRequestException("Teil kho " + r.blockId() + " đã gỡ.");
            if (!format.equalsIgnoreCase((String) k.get("exam_format")) || !level.equals(k.get("cefr_level"))
                    || !String.valueOf(k.get("section")).equals(r.section())
                    || ((Number) k.get("teil")).intValue() != r.teil()) {
                throw new BadRequestException("Teil kho " + r.blockId() + " không khớp ô " + slotKey + " của đề "
                        + format + " " + level + ".");
            }
            ObjectNode target = findTeil(sections, r.section(), r.teil());
            if (target == null) throw new BadRequestException("Đề nền không có " + slotKey + ".");
            String baseType = target.path("type").asText("");
            // Phần Viết của đề nền không khai "type" — coi như khớp WRITE_EMAIL.
            boolean typeOk = baseType.isBlank() ? "WRITE_EMAIL".equals(k.get("teil_type"))
                    : baseType.equals(String.valueOf(k.get("teil_type")));
            if (!typeOk) {
                throw new BadRequestException("Dạng Teil kho (" + k.get("teil_type") + ") khác dạng của đề nền ("
                        + target.path("type").asText() + ").");
            }
            JsonNode content = parse((String) k.get("content"));
            target.removeAll();
            target.setAll((ObjectNode) content);
            target.put("teil", r.teil());
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("section", r.section());
            t.put("teil", r.teil());
            t.put("blockId", r.blockId());
            trace.add(t);
        }

        Map<String, Object> blockIds = new LinkedHashMap<>();
        blockIds.put("baseExamId", req.baseExamId());
        blockIds.put("teile", trace);
        String desc = (b.get("description_vi") == null ? "" : b.get("description_vi") + " ")
                + "Ghép từ Xưởng đề trên nền \"" + b.get("title") + "\".";
        Long id = jdbc.queryForObject("""
                INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, sections_json, total_points,
                                        pass_points, time_limit_minutes, is_active, reviewed, origin, block_ids)
                VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, TRUE, FALSE, 'STUDIO', ?::jsonb) RETURNING id
                """, Long.class, level, format, req.title().trim(), desc, json(sections), b.get("total_points"),
                b.get("pass_points"), b.get("time_limit_minutes"), json(blockIds));
        for (Replacement r : reps) {
            jdbc.update("UPDATE exam_teil_blocks SET exposure_count = exposure_count + 1 WHERE id = ?", r.blockId());
        }
        return get(id);
    }

    public List<Assembled> list() {
        return jdbc.query("""
                SELECT id, title, cefr_level, exam_format, reviewed, is_active, block_ids::text AS block_ids, created_at
                FROM mock_exams WHERE origin = 'STUDIO' ORDER BY id DESC
                """, (rs, n) -> toAssembled(rs.getLong("id"), rs.getString("title"), rs.getString("cefr_level"),
                rs.getString("exam_format"), rs.getBoolean("reviewed"), rs.getBoolean("is_active"),
                rs.getString("block_ids"), rs.getTimestamp("created_at")));
    }

    public Assembled get(long id) {
        List<Assembled> rows = jdbc.query("""
                SELECT id, title, cefr_level, exam_format, reviewed, is_active, block_ids::text AS block_ids, created_at
                FROM mock_exams WHERE id = ? AND origin = 'STUDIO'
                """, (rs, n) -> toAssembled(rs.getLong("id"), rs.getString("title"), rs.getString("cefr_level"),
                rs.getString("exam_format"), rs.getBoolean("reviewed"), rs.getBoolean("is_active"),
                rs.getString("block_ids"), rs.getTimestamp("created_at")), id);
        if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy bộ đề ghép " + id + ".");
        return rows.get(0);
    }

    /** Đổi tên bộ đề ghép (tên học viên thấy). Chỉ bộ ghép từ Xưởng đề; đề viết tay không đổi ở đây. */
    @Transactional
    public Assembled rename(long id, String title) {
        get(id);
        String t = title == null ? "" : title.trim();
        if (t.isEmpty()) throw new BadRequestException("Đặt tên cho bộ đề.");
        if (t.length() > 200) throw new BadRequestException("Tên bộ đề tối đa 200 ký tự.");
        Integer clash = jdbc.queryForObject("SELECT count(*) FROM mock_exams WHERE lower(title) = lower(?) AND id <> ?",
                Integer.class, t, id);
        if (clash != null && clash > 0) throw new ConflictException("Đã có một đề khác mang tên này.");
        jdbc.update("UPDATE mock_exams SET title = ? WHERE id = ? AND origin = 'STUDIO'", t, id);
        return get(id);
    }

    /** Phát hành (kể cả phát hành lại bộ đã gỡ): hết "Sắp có", học viên làm được. */
    @Transactional
    public Assembled publish(long id) {
        get(id);
        jdbc.update("UPDATE mock_exams SET reviewed = TRUE, is_active = TRUE WHERE id = ? AND origin = 'STUDIO'", id);
        return get(id);
    }

    /** Gỡ khỏi danh sách học viên (giữ dòng để bài làm cũ vẫn xem lại được). */
    @Transactional
    public Assembled retire(long id) {
        get(id);
        jdbc.update("UPDATE mock_exams SET is_active = FALSE WHERE id = ? AND origin = 'STUDIO'", id);
        return get(id);
    }

    /** Các bộ đề ghép đang chạy có dùng Teil kho này. */
    List<Map<String, Object>> usedIn(long blockId) {
        return jdbc.queryForList("""
                SELECT id, title FROM mock_exams
                WHERE origin = 'STUDIO' AND is_active = TRUE
                  AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(block_ids->'teile', '[]'::jsonb)) t
                              WHERE (t->>'blockId')::bigint = ?)
                ORDER BY id
                """, blockId);
    }

    // ── phụ ────────────────────────────────────────────────────────────────────────────────

    static List<Slot> slotsOf(JsonNode sections) {
        List<Slot> out = new ArrayList<>();
        for (JsonNode s : sections.path("sections")) {
            for (JsonNode t : s.path("teile")) {
                if (t.has("teil")) out.add(new Slot(s.path("name").asText(), t.path("teil").asInt(), t.path("type").asText(null)));
            }
        }
        return out;
    }

    static ObjectNode findTeil(JsonNode sections, String section, int teil) {
        for (JsonNode s : sections.path("sections")) {
            if (!section.equals(s.path("name").asText())) continue;
            JsonNode teile = s.path("teile");
            if (!(teile instanceof ArrayNode arr)) return null;
            for (JsonNode t : arr) {
                if (t.path("teil").asInt(-1) == teil && t instanceof ObjectNode o) return o;
            }
        }
        return null;
    }

    private Assembled toAssembled(long id, String title, String level, String format, boolean reviewed,
                                  boolean active, String blockIds, Timestamp createdAt) {
        JsonNode b = parse(blockIds);
        List<Map<String, Object>> teile = new ArrayList<>();
        for (JsonNode t : b.path("teile")) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("section", t.path("section").asText());
            m.put("teil", t.path("teil").asInt());
            m.put("blockId", t.path("blockId").asLong());
            teile.add(m);
        }
        Long base = b.hasNonNull("baseExamId") ? b.path("baseExamId").asLong() : null;
        return new Assembled(id, title, level, format, reviewed, active, base, teile,
                createdAt == null ? null : createdAt.toInstant());
    }

    private Map<String, Integer> counts(Object itemsJson) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String l : TeilSpec.LEVELS) out.put(l, 0);
        JsonNode items = parse(itemsJson == null ? null : itemsJson.toString());
        for (JsonNode it : items) {
            String lv = it.path("difficulty_target").asText("");
            if (out.containsKey(lv)) out.merge(lv, 1, Integer::sum);
        }
        return out;
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return mapper.createObjectNode();
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("JSON đề hỏng: " + e.getMessage(), e);
        }
    }

    private String json(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
