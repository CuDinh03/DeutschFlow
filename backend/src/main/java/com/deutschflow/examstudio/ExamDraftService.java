package com.deutschflow.examstudio;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobRepository;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examspeaking.metrics.GoetheWordlist;
import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Xưởng đề: bản nháp một Teil đi qua 5 bước Khung → Nguồn → Bài đọc → Câu hỏi → Kiểm & duyệt.
 *
 * <p>Thao tác AI không chạy trong request: {@link #enqueue} đặt {@code busy_op} (chỉ khi đang rảnh) rồi xếp một
 * {@link AiJob} kiểu {@link ExamStudioJobHandler#JOB_TYPE}; job gọi các hàm {@code run*} ở dưới rồi gỡ
 * {@code busy_op}. Client hỏi lại {@code GET /drafts/{id}} cho tới khi rảnh.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamDraftService {

    static final List<String> STEPS = List.of("FRAME", "SOURCE", "TEXT", "ITEMS", "REVIEW", "APPROVED");
    private static final List<String> LEVEL_ORDER = List.of("A1", "A2", "B1", "B2", "C1", "C2");
    private static final int LINE_WIDTH = 62;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final AiJobRepository jobs;
    private final ExamStudioAi ai;
    private final SourceFetcher fetcher;
    private final GoetheWordlist wordlist;
    private final SituationalTeile situ;
    private final ExamDedupService dedup;

    // ── Trạng thái nạp từ DB ────────────────────────────────────────────────────────────────

    /** Phần text_json: bài + id dữ kiện AI đã dùng. */
    record StoredText(Text text, List<String> usedFactIds) {}

    record Row(long id, String examFormat, String cefrLevel, String section, int teil, String teilType,
               String theme, String mode, Map<String, Integer> plan, String step, String status, String busyOp,
               Long busyJobId, String lastError, StoredText text, List<Item> items, List<Check> checks,
               String verifiedHash, Map<String, Boolean> reviewChecklist, Long blockId, Instant createdAt,
               Instant updatedAt, String situation) {

        TeilSpec spec() {
            return TeilSpec.find(examFormat, cefrLevel, section, teil)
                    .orElseThrow(() -> new IllegalStateException("Không có khuôn cho bản nháp " + id));
        }

        int itemCount() {
            if (spec().writing()) return 0;
            if ("PRACTICE".equals(mode)) {
                int sum = plan.values().stream().mapToInt(Integer::intValue).sum();
                return Math.max(1, Math.min(10, sum));
            }
            return spec().itemCount();
        }
    }

    record SourceRow(Source source, Set<Long> shingles) {}

    private <T> T read(String json, TypeReference<T> type, T fallback) {
        if (json == null || json.isBlank()) return fallback;
        try {
            return mapper.readValue(json, type);
        } catch (Exception e) {
            log.warn("[ExamStudio] JSON hỏng: {}", e.getMessage());
            return fallback;
        }
    }

    private String json(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private Row mapRow(ResultSet rs) throws SQLException {
        return new Row(
                rs.getLong("id"), rs.getString("exam_format"), rs.getString("cefr_level"), rs.getString("section"),
                rs.getInt("teil"), rs.getString("teil_type"), rs.getString("theme"), rs.getString("mode"),
                read(rs.getString("difficulty_plan"), new TypeReference<Map<String, Integer>>() {}, new HashMap<>()),
                rs.getString("step"), rs.getString("status"), rs.getString("busy_op"),
                (Long) rs.getObject("busy_job_id"), rs.getString("last_error"),
                read(rs.getString("text_json"), new TypeReference<StoredText>() {}, null),
                read(rs.getString("items_json"), new TypeReference<List<Item>>() {}, new ArrayList<>()),
                read(rs.getString("checks_json"), new TypeReference<List<Check>>() {}, new ArrayList<>()),
                rs.getString("verified_hash"),
                read(rs.getString("review_checklist"), new TypeReference<Map<String, Boolean>>() {}, new HashMap<>()),
                (Long) rs.getObject("block_id"),
                instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("updated_at")),
                rs.getString("situation"));
    }

    private static Instant instant(Timestamp t) {
        return t == null ? null : t.toInstant();
    }

    Row load(long id) {
        List<Row> rows = jdbc.query("""
                SELECT id, exam_format, cefr_level, section, teil, teil_type, theme, mode,
                       difficulty_plan::text AS difficulty_plan, step, status, busy_op, busy_job_id, last_error,
                       text_json::text AS text_json, items_json::text AS items_json, checks_json::text AS checks_json,
                       verified_hash, review_checklist::text AS review_checklist, block_id, created_at, updated_at,
                       situation
                FROM exam_drafts WHERE id = ?
                """, (rs, n) -> mapRow(rs), id);
        if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy bản nháp " + id + ".");
        return rows.get(0);
    }

    List<SourceRow> sources(long draftId) {
        return jdbc.query("""
                SELECT s.id, s.url, s.publisher, s.title, s.author, s.published_at, s.license_text, s.usage_mode,
                       s.usage_mode_confirmed, s.neutrality, s.neutrality_reason, s.facts_json::text AS facts_json,
                       s.shingle_hashes::text AS shingle_hashes
                FROM exam_draft_sources ds JOIN exam_sources s ON s.id = ds.source_id
                WHERE ds.draft_id = ? ORDER BY ds.position, s.id
                """, (rs, n) -> new SourceRow(new Source(
                        rs.getLong("id"), rs.getString("url"), rs.getString("publisher"), rs.getString("title"),
                        rs.getString("author"), rs.getString("published_at"), rs.getString("license_text"),
                        rs.getString("usage_mode"), rs.getBoolean("usage_mode_confirmed"), rs.getString("neutrality"),
                        rs.getString("neutrality_reason"),
                        read(rs.getString("facts_json"), new TypeReference<List<Fact>>() {}, new ArrayList<>())),
                        TextChecks.toSet(read(rs.getString("shingle_hashes"),
                                new TypeReference<List<Long>>() {}, List.of()))),
                draftId);
    }

    // ── Đọc ─────────────────────────────────────────────────────────────────────────────────

    public List<DraftSummary> list(String status) {
        String st = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        return jdbc.query("""
                SELECT id, cefr_level, section, teil, theme, text_json->'text'->>'titleDe' AS title_de, step, status,
                       busy_op, updated_at
                FROM exam_drafts
                WHERE (?::text IS NULL AND status <> 'DISCARDED') OR status = ?::text
                ORDER BY updated_at DESC LIMIT 200
                """, (rs, n) -> new DraftSummary(rs.getLong("id"), rs.getString("cefr_level"), rs.getString("section"),
                        rs.getInt("teil"), rs.getString("theme"), rs.getString("title_de"), rs.getString("step"),
                        rs.getString("status"), rs.getString("busy_op"), instant(rs.getTimestamp("updated_at"))),
                st, st);
    }

    public Draft get(long id) {
        Row r = load(id);
        if (r.busyOp() != null && r.busyJobId() != null) {
            // Lưới đỡ: job đã kết thúc (bị quét FAILED, worker chết) mà busy_op vẫn còn ⇒ gỡ.
            Optional<AiJob> job = jobs.findById(r.busyJobId());
            if (job.isEmpty() || AiJob.STATUS_FAILED.equals(job.get().getStatus())
                    || AiJob.STATUS_COMPLETED.equals(job.get().getStatus())) {
                String err = job.map(AiJob::getErrorMsg).orElse(null);
                finishBusy(id, AiJob.STATUS_FAILED.equals(job.map(AiJob::getStatus).orElse(AiJob.STATUS_FAILED))
                        ? (err == null || err.isBlank() ? "Thao tác AI bị dừng giữa chừng, hãy thử lại." : err) : null);
                r = load(id);
            }
        }
        return toDto(r, sources(id));
    }

    Draft toDto(Row r, List<SourceRow> srcs) {
        List<Source> sourceDtos = srcs.stream().map(SourceRow::source).toList();
        TextMetrics metrics = r.text() == null ? null : metrics(r, srcs);
        return new Draft(r.id(), r.examFormat(), r.cefrLevel(), r.section(), r.teil(), r.teilType(), r.theme(),
                r.mode(), r.itemCount(), normalizedPlan(r.plan()), r.step(), r.status(), r.busyOp(), r.lastError(),
                sourceDtos, r.text() == null ? null : r.text().text(), metrics, r.items(), r.checks(),
                suggestions(r, srcs, metrics), r.reviewChecklist(), quelle(srcs), r.blockId(), r.createdAt(),
                r.updatedAt(), r.situation(), !r.spec().situational(), warnings(r, srcs));
    }

    /** Cảnh báo chống trùng không chặn: nguồn đã dùng ở bản nháp/Teil khác. */
    List<String> warnings(Row r, List<SourceRow> srcs) {
        List<String> out = new ArrayList<>();
        for (SourceRow sr : srcs) {
            List<Map<String, Object>> reuse = dedup.sourceReuse(sr.source().url(), r.id());
            if (reuse.isEmpty()) continue;
            String where = reuse.stream().map(m -> m.get("blockId") != null
                    ? "Teil kho #" + m.get("blockId") : "bản nháp #" + m.get("draftId")).distinct()
                    .collect(Collectors.joining(", "));
            out.add("Nguồn „" + firstNonBlank(sr.source().title(), sr.source().url()) + "“ đã dùng ở " + where
                    + ". Dùng cho Teil khác dạng thì được; cùng dạng thì tự kiểm sẽ báo trùng.");
        }
        return out;
    }

    static Map<String, Integer> normalizedPlan(Map<String, Integer> plan) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String l : TeilSpec.LEVELS) out.put(l, plan == null ? 0 : Math.max(0, plan.getOrDefault(l, 0)));
        return out;
    }

    // ── Tạo / sửa ───────────────────────────────────────────────────────────────────────────

    @Transactional
    public Draft create(CreateDraftRequest req, long userId) {
        TeilSpec spec = TeilSpec.find(req.examFormat(), req.cefrLevel(), req.section(), req.teil())
                .orElseThrow(() -> new BadRequestException(
                        "Xưởng đề hiện làm telc B1 (Lesen 1–3, Sprachbausteine 1–2, Schreiben) và telc A2 / Start Deutsch 2 "
                                + "(Lesen 1–3, Schreiben 1–2). Hören làm ở đợt sau."));
        String mode = normalizeMode(req.mode());
        Map<String, Integer> plan = validatePlan(req.difficultyPlan(), mode, spec);
        Long id = jdbc.queryForObject("""
                INSERT INTO exam_drafts (exam_format, cefr_level, section, teil, teil_type, theme, mode,
                                         difficulty_plan, created_by, situation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id
                """, Long.class, spec.examFormat(), spec.cefrLevel(), spec.section(), spec.teil(), spec.teilType(),
                blankToNull(req.theme()), mode, json(plan), userId, cut(blankToNull(req.situation()), 2000));
        return get(id);
    }

    @Transactional
    public Draft patch(long id, PatchDraftRequest req) {
        Row r = requireEditable(id);
        if (req.theme() != null) {
            jdbc.update("UPDATE exam_drafts SET theme = ?, updated_at = now() WHERE id = ?", blankToNull(req.theme()), id);
        }
        if (req.situation() != null) {
            jdbc.update("UPDATE exam_drafts SET situation = ?, updated_at = now() WHERE id = ?",
                    cut(blankToNull(req.situation()), 2000), id);
        }
        if (req.mode() != null || req.difficultyPlan() != null) {
            String mode = req.mode() == null ? r.mode() : normalizeMode(req.mode());
            Map<String, Integer> plan = validatePlan(req.difficultyPlan() == null ? r.plan() : req.difficultyPlan(),
                    mode, r.spec());
            jdbc.update("UPDATE exam_drafts SET mode = ?, difficulty_plan = ?::jsonb, updated_at = now() WHERE id = ?",
                    mode, json(plan), id);
        }
        if (req.text() != null) {
            Text t = sanitizeText(req.text());
            List<String> used = r.text() == null ? List.of() : r.text().usedFactIds();
            saveText(id, new StoredText(t, used));
        }
        if (req.items() != null) {
            saveItems(id, sanitizeItems(req.items(), r));
        }
        if (req.reviewChecklist() != null) {
            Map<String, Boolean> cl = new LinkedHashMap<>();
            for (String k : TeilSpec.CHECKLIST_KEYS) cl.put(k, Boolean.TRUE.equals(req.reviewChecklist().get(k)));
            jdbc.update("UPDATE exam_drafts SET review_checklist = ?::jsonb, updated_at = now() WHERE id = ?", json(cl), id);
        }
        return get(id);
    }

    @Transactional
    public void discard(long id) {
        Row r = load(id);
        if ("APPROVED".equals(r.status())) throw new ConflictException("Bản nháp đã duyệt vào kho, không bỏ được.");
        jdbc.update("UPDATE exam_drafts SET status = 'DISCARDED', updated_at = now() WHERE id = ?", id);
    }

    // ── Nguồn ───────────────────────────────────────────────────────────────────────────────

    public Draft addSource(long id, AddSourceRequest req, long userId) {
        requireEditable(id);
        boolean hasUrl = req.url() != null && !req.url().isBlank();
        boolean hasText = req.pastedText() != null && !req.pastedText().isBlank();
        if (hasUrl == hasText) throw new BadRequestException("Nhập đường dẫn HOẶC dán văn bản (một trong hai).");
        if (hasText && req.pastedText().trim().length() < 300) {
            throw new BadRequestException("Văn bản dán quá ngắn (dưới 300 ký tự).");
        }
        if (hasUrl) fetcher.validate(req.url()); // báo lỗi đường dẫn ngay, không đợi job
        Map<String, Object> payload = new HashMap<>();
        if (hasUrl) payload.put("url", req.url().trim());
        if (hasText) payload.put(ExamStudioJobHandler.PASTED_TEXT, req.pastedText());
        if (req.title() != null) payload.put("title", req.title());
        if (req.publisher() != null) payload.put("publisher", req.publisher());
        enqueue(id, "FACTS", userId, payload);
        return get(id);
    }

    @Transactional
    public Draft patchSource(long id, long sourceId, PatchSourceRequest req) {
        requireEditable(id);
        SourceRow s = sources(id).stream().filter(x -> x.source().id() == sourceId).findFirst()
                .orElseThrow(() -> new NotFoundException("Nguồn không thuộc bản nháp này."));
        if (req.usageMode() != null) {
            String m = req.usageMode().trim().toUpperCase(Locale.ROOT);
            if (!m.equals("ADAPT") && !m.equals("FACTS_ONLY")) throw new BadRequestException("Loại dùng không hợp lệ.");
            jdbc.update("UPDATE exam_sources SET usage_mode = ?, usage_mode_confirmed = TRUE WHERE id = ?", m, sourceId);
        }
        if (req.selectedFactIds() != null) {
            Set<String> sel = new HashSet<>(req.selectedFactIds());
            List<Fact> facts = s.source().facts().stream().map(f -> f.withSelected(sel.contains(f.id()))).toList();
            jdbc.update("UPDATE exam_sources SET facts_json = ?::jsonb WHERE id = ?", json(facts), sourceId);
        }
        touch(id);
        return get(id);
    }

    @Transactional
    public Draft removeSource(long id, long sourceId) {
        requireEditable(id);
        jdbc.update("DELETE FROM exam_draft_sources WHERE draft_id = ? AND source_id = ?", id, sourceId);
        jdbc.update("DELETE FROM exam_sources s WHERE id = ? AND NOT EXISTS "
                + "(SELECT 1 FROM exam_draft_sources d WHERE d.source_id = s.id)", sourceId);
        touch(id);
        return get(id);
    }

    /** Chạy trong job FACTS. {@code pastedText} chỉ sống trong bộ nhớ. */
    void runFacts(long draftId, long userId, Map<String, Object> payload, String pastedText) {
        Row r = load(draftId);
        String url = (String) payload.get("url");
        SourceFetcher.Fetched f;
        if (url != null) {
            f = fetcher.fetch(url);
        } else {
            f = new SourceFetcher.Fetched(null, null, null, null, null, null, false, pastedText);
        }
        List<SourceRow> existing = sources(draftId);
        List<Fact> existingFacts = existing.stream().flatMap(s -> s.source().facts().stream()).toList();
        JsonNode out = ai.extractFacts(userId, r.cefrLevel(), r.theme(), f.text(), existingFacts);

        String title = firstNonBlank((String) payload.get("title"), f.title(), text(out, "title"));
        String publisher = firstNonBlank((String) payload.get("publisher"), f.publisher(), text(out, "publisher"));
        String author = firstNonBlank(f.author(), text(out, "author"));
        String published = firstNonBlank(f.publishedAt(), text(out, "publishedAt"));
        boolean neutral = !out.has("neutral") || out.path("neutral").asBoolean(true);
        String reason = neutral ? null : firstNonBlank(text(out, "neutralityReasonVi"), "Chủ đề nhạy cảm.");

        // id dữ kiện duy nhất trong bản nháp: s<n>f<k>
        int srcNo = existing.size() + 1;
        Set<String> confirms = new HashSet<>();
        out.path("confirms").forEach(n -> confirms.add(n.asText()));
        List<Fact> facts = new ArrayList<>();
        int k = 0;
        for (JsonNode n : out.path("facts")) {
            String t = text(n, "text");
            if (t == null) continue;
            String sameAs = text(n, "sameAs");
            if (sameAs != null) confirms.add(sameAs);
            k++;
            facts.add(new Fact("s" + srcNo + "f" + k, t, text(n, "figure"), text(n, "year"),
                    n.hasNonNull("paragraph") ? n.path("paragraph").asInt() : null, sameAs != null, false));
            if (k >= 20) break;
        }
        if (facts.isEmpty()) throw new BadRequestException("AI không rút được dữ kiện nào từ nguồn này.");

        String usage = f.ccBy() ? "ADAPT" : "FACTS_ONLY";
        List<Long> shingles = TextChecks.shingleHashes(f.text(), TeilSpec.OVERLAP_LIMIT);
        Long sourceId = jdbc.queryForObject("""
                INSERT INTO exam_sources (url, publisher, title, author, published_at, license_text, usage_mode,
                                          neutrality, neutrality_reason, facts_json, shingle_hashes, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?) RETURNING id
                """, Long.class, url, cut(publisher, 300), title, cut(author, 500), cut(published, 40),
                cut(f.licenseText(), 500), usage, neutral ? "OK" : "FLAGGED", reason, json(facts), json(shingles),
                userId);
        jdbc.update("INSERT INTO exam_draft_sources (draft_id, source_id, position) VALUES (?, ?, ?)",
                draftId, sourceId, srcNo);
        // Dữ kiện cũ được nguồn mới xác nhận ⇒ đánh dấu đã đối chiếu.
        for (SourceRow s : existing) {
            List<Fact> updated = s.source().facts().stream()
                    .map(x -> confirms.contains(x.id()) ? x.withCorroborated(true) : x).toList();
            if (!updated.equals(s.source().facts())) {
                jdbc.update("UPDATE exam_sources SET facts_json = ?::jsonb WHERE id = ?", json(updated), s.source().id());
            }
        }
        advanceStep(draftId, "SOURCE");
    }

    // ── Bài đọc ─────────────────────────────────────────────────────────────────────────────

    public Draft writeText(long id, WriteTextRequest req, long userId) {
        Row r = requireEditable(id);
        Map<String, Object> payload = new HashMap<>();
        if (req != null && req.selection() != null && !req.selection().isBlank()) {
            if (r.text() == null) throw new BadRequestException("Chưa có bài để viết lại.");
            if (!r.text().text().context().contains(req.selection())) {
                throw new BadRequestException("Đoạn bôi đen không còn nằm trong bài (bài đã đổi?).");
            }
            payload.put("selection", req.selection());
            payload.put("mode", "SIMPLIFY".equalsIgnoreCase(req.mode()) ? "SIMPLIFY" : "REWRITE");
        } else if (!r.spec().situational() && selectedFacts(sources(id)).isEmpty()) {
            throw new BadRequestException("Hãy tích ít nhất một dữ kiện ở bước Nguồn.");
        } else if (sources(id).stream().anyMatch(s -> "FLAGGED".equals(s.source().neutrality())
                && s.source().facts().stream().anyMatch(Fact::selected))) {
            throw new BadRequestException("Có nguồn bị cờ chủ đề nhạy cảm — bỏ dữ kiện của nguồn đó trước.");
        }
        if (req != null && req.note() != null) payload.put("note", req.note());
        enqueue(id, "TEXT", userId, payload);
        return get(id);
    }

    void runText(long draftId, long userId, Map<String, Object> payload) {
        Row r = load(draftId);
        String selection = (String) payload.get("selection");
        String note = (String) payload.get("note");
        if (selection != null) {
            JsonNode out = ai.rewrite(userId, r.spec(), r.text().text(), selection, (String) payload.get("mode"), note);
            String repl = text(out, "replacement");
            if (repl == null) throw new IllegalStateException("AI không trả đoạn viết lại.");
            Text t = r.text().text();
            Text nt = t.withContext(t.context().replace(selection, repl.trim()));
            if (t.ads() != null) {
                Map<String, String> ads = new LinkedHashMap<>();
                t.ads().forEach((k, v) -> ads.put(k, v.replace(selection, repl.trim())));
                nt = new Text(nt.titleDe(), nt.vorspannDe(), nt.context(), nt.glossary(), ads, nt.examples(),
                        nt.stimulusAd(), nt.wordBank(), nt.stimulus(), nt.writingPoints());
            }
            saveText(draftId, new StoredText(nt, r.text().usedFactIds()));
            return;
        }
        List<String> avoid = dedup.avoidList(dedup.bank(r.examFormat(), r.cefrLevel(), r.section(), r.teil()), 20);
        if (r.spec().situational()) {
            Text t = situ.writeText(userId, r.spec(), r.theme(), r.situation(), note, avoid);
            saveText(draftId, new StoredText(t, List.of()));
            advanceStep(draftId, "TEXT");
            return;
        }
        List<Fact> facts = selectedFacts(sources(draftId));
        String noteWithAvoid = (note == null ? "" : note) + SituationalTeile.avoidBlock(avoid);
        JsonNode out = ai.writeText(userId, r.spec(), r.theme(), facts, noteWithAvoid.isBlank() ? null : noteWithAvoid);
        if (r.spec().headlines()) {
            List<String> texts = new ArrayList<>();
            Set<String> usedIds = new LinkedHashSet<>();
            out.path("texts").forEach(t -> {
                String body = text(t, "text");
                if (body != null) texts.add(body.replaceAll("\\s+", " ").trim());
                t.path("usedFactIds").forEach(u -> usedIds.add(u.asText()));
            });
            if (texts.size() < r.spec().textCount()) {
                throw new IllegalStateException("AI chỉ trả " + texts.size() + "/" + r.spec().textCount() + " văn bản, hãy thử lại.");
            }
            Text t = new Text("", "", String.join("\n\n", texts.subList(0, r.spec().textCount())), List.of());
            saveText(draftId, new StoredText(t, new ArrayList<>(usedIds)));
            advanceStep(draftId, "TEXT");
            return;
        }
        List<String> paras = paragraphsOf(out);
        if (paras.isEmpty()) throw new IllegalStateException("AI không trả bài đọc.");
        int words = TextChecks.wordCount(String.join(" ", paras));
        if (words < r.spec().minWords()) {
            // Model hay viết hụt độ dài. Nhắc đúng con số và cho viết lại MỘT lần; vẫn hụt thì giữ bản dài hơn
            // (bước Câu hỏi và đèn Độ dài sẽ chặn tiếp).
            String retryNote = (noteWithAvoid.isBlank() ? "" : noteWithAvoid + "\n") + "Dein letzter Text hatte nur "
                    + words + " Wörter. Schreibe ihn neu mit mindestens " + r.spec().minWords()
                    + " Wörtern: jeden Fakt in 2–3 Sätzen erklären, ohne neue Zahlen oder Ergebnisse zu erfinden.";
            try {
                JsonNode again = ai.writeText(userId, r.spec(), r.theme(), facts, retryNote);
                List<String> longer = paragraphsOf(again);
                if (TextChecks.wordCount(String.join(" ", longer)) > words) {
                    out = again;
                    paras = longer;
                }
            } catch (RuntimeException e) {
                log.warn("[ExamStudio] viết lại bài ngắn của bản nháp {} hỏng: {}", draftId, e.getMessage());
            }
        }
        List<GlossaryEntry> glossary = new ArrayList<>();
        for (JsonNode g : out.path("glossary")) {
            String term = text(g, "term");
            String expl = text(g, "explanationDe");
            if (term != null && expl != null) glossary.add(new GlossaryEntry(term, expl));
        }
        List<String> used = new ArrayList<>();
        for (JsonNode u : out.path("usedFactIds")) used.add(u.asText());
        Text t = new Text(firstNonBlank(text(out, "titleDe"), "Ohne Titel"), firstNonBlank(text(out, "vorspannDe"), ""),
                String.join("\n\n", paras), glossary);
        saveText(draftId, new StoredText(t, used));
        advanceStep(draftId, "TEXT");
    }

    private static List<String> paragraphsOf(JsonNode out) {
        List<String> paras = new ArrayList<>();
        for (JsonNode p : out.path("paragraphs")) {
            if (!p.asText("").isBlank()) paras.add(p.asText().trim());
        }
        return paras;
    }

    // ── Câu hỏi ─────────────────────────────────────────────────────────────────────────────

    public Draft generateItems(long id, long userId) {
        Row r = requireEditable(id);
        if (r.text() == null) throw new BadRequestException("Chưa có bài đọc.");
        if (r.spec().writing()) throw new BadRequestException("Phần Viết không có câu hỏi trắc nghiệm — sang thẳng bước Kiểm & duyệt.");
        requireLongEnough(r);
        enqueue(id, "ITEMS", userId, new HashMap<>());
        return get(id);
    }

    /**
     * Bài báo (Lesen Teil 2) ngắn hơn khuôn thì không đủ chỗ cho năm câu ở các đoạn khác nhau — câu hỏi ra
     * từ bài như vậy đều dồn vào vài câu văn và không đạt bậc Khó trở lên. Chặn từ đây, khỏi tốn lượt AI.
     */
    private void requireLongEnough(Row r) {
        if (!mcNews(r.spec())) return;
        int words = TextChecks.wordCount(r.text().text().context());
        if (words < r.spec().minWords()) {
            throw new BadRequestException("Bài mới " + words + " từ, khuôn cần ít nhất " + r.spec().minWords()
                    + ". Hãy thêm dữ kiện hoặc bấm \"AI viết lại cả bài\" trước khi sinh câu hỏi.");
        }
    }

    /** Bài báo + câu a/b/c (telc B1 Lesen Teil 2): Teil duy nhất đo được độ khó bằng code ({@link ItemMetrics}). */
    static boolean mcNews(TeilSpec spec) {
        return "MULTIPLE_CHOICE".equals(spec.teilType());
    }

    public Draft regenerateItem(long id, String itemId, String difficulty, long userId) {
        Row r = requireEditable(id);
        if (r.items().stream().noneMatch(i -> i.id().equals(itemId))) throw new NotFoundException("Không có câu " + itemId + ".");
        if (difficulty != null && !TeilSpec.isLevel(difficulty)) throw new BadRequestException("Bậc không hợp lệ.");
        requireLongEnough(r);
        Map<String, Object> payload = new HashMap<>();
        payload.put("itemId", itemId);
        if (difficulty != null) payload.put("difficulty", difficulty.toUpperCase(Locale.ROOT));
        enqueue(id, "ITEM", userId, payload);
        return get(id);
    }

    void runItems(long draftId, long userId, Map<String, Object> payload) {
        Row r = load(draftId);
        TeilSpec spec = r.spec();
        int count = r.itemCount();
        String onlyId = (String) payload.get("itemId");
        String newLevel = (String) payload.get("difficulty");

        // Bậc giao cho từng vị trí: theo ma trận, xáo theo id bản nháp để bậc không lộ theo thứ tự câu.
        List<String> planned = new ArrayList<>(ItemRules.slots(r.plan(), count));
        Collections.shuffle(planned, new Random(draftId));

        Map<String, Item> byId = new HashMap<>();
        for (Item it : r.items()) byId.put(it.id(), it);
        List<Item> current = new ArrayList<>();
        for (int s = 0; s < count; s++) current.add(byId.get(spec.itemId(s)));

        List<int[]> todo = new ArrayList<>();
        List<String> todoLevels = new ArrayList<>();
        for (int s = 0; s < count; s++) {
            Item existing = current.get(s);
            String id = spec.itemId(s);
            boolean regen = onlyId == null ? existing == null || !existing.locked() : id.equals(onlyId);
            if (!regen) continue;
            String level = onlyId != null && newLevel != null ? newLevel
                    : existing != null && onlyId != null ? existing.difficultyTarget() : planned.get(s);
            todo.add(new int[]{s});
            todoLevels.add(level);
        }
        if (todo.isEmpty()) throw new BadRequestException("Mọi câu đều đang khoá.");
        List<Item> keep = new ArrayList<>();
        for (int s = 0; s < count; s++) {
            int fs = s;
            if (current.get(s) != null && todo.stream().noneMatch(t -> t[0] == fs)) keep.add(current.get(s));
        }

        List<String> avoid = dedup.avoidList(dedup.bank(r.examFormat(), r.cefrLevel(), r.section(), r.teil()), 20);
        if (spec.situational()) {
            List<Integer> slotList = todo.stream().map(t -> t[0]).toList();
            SituationalTeile.ItemsResult res = situ.generateItems(userId, spec, r.text().text(), current, slotList,
                    todoLevels, avoid, new Random(draftId * 31 + System.nanoTime()));
            List<Item> items = res.items().stream().filter(Objects::nonNull).toList();
            if (res.text() != r.text().text()) {
                jdbc.update("UPDATE exam_drafts SET text_json = ?::jsonb WHERE id = ?",
                        json(new StoredText(res.text(), r.text().usedFactIds())), draftId);
            }
            saveItems(draftId, items);
            advanceStep(draftId, "ITEMS");
            if (!res.problems().isEmpty()) {
                throw new IllegalStateException("AI trả hỏng " + String.join(", ", res.problems()) + " — bấm Sinh câu hỏi lại.");
            }
            return;
        }
        JsonNode out = ai.generateItems(userId, spec, r.text().text(), todo, todoLevels, keep, avoid);
        Map<Integer, JsonNode> bySlot = bySlot(out, todo);
        if (mcNews(spec)) {
            // Đo ngay bằng code: câu nào trái công thức của bậc (vd. giao Siêu khó mà bằng chứng gói trong một
            // câu) thì cho AI viết lại MỘT lần kèm lời nhắc cụ thể. Lượt tự kiểm sẽ đo lại đầy đủ.
            Map<Integer, String> hints = new java.util.TreeMap<>();
            List<int[]> redo = new ArrayList<>();
            List<String> redoLevels = new ArrayList<>();
            for (int i = 0; i < todo.size(); i++) {
                int s = todo.get(i)[0];
                String hint = recipeHint(r.text().text().context(), bySlot.get(s), todoLevels.get(i));
                if (hint == null) continue;
                hints.put(s, hint);
                redo.add(todo.get(i));
                redoLevels.add(todoLevels.get(i));
            }
            if (!hints.isEmpty()) {
                try {
                    JsonNode again = ai.generateItems(userId, spec, r.text().text(), redo, redoLevels, keep, avoid, hints);
                    bySlot(again, redo).forEach((s, n) -> {
                        if (rawOptions(n) != null) bySlot.put(s, n);
                    });
                } catch (RuntimeException e) {
                    log.warn("[ExamStudio] sinh lại câu lệch công thức của bản nháp {} hỏng: {}", draftId, e.getMessage());
                }
            }
        }

        Random rnd = new Random(draftId * 31 + System.nanoTime());
        List<String> problems = new ArrayList<>();
        if (spec.headlines()) {
            List<String> paras = TextChecks.paragraphs(r.text().text().context());
            // Chữ a–j: Teil giữ nguyên dùng lại chữ cũ; câu sinh lại dùng lại hai chữ của nó, câu mới bốc chữ còn trống.
            Set<String> taken = new HashSet<>();
            for (int s = 0; s < count; s++) {
                int fs = s;
                if (current.get(s) != null && todo.stream().noneMatch(t -> t[0] == fs)) taken.addAll(current.get(s).options().keySet());
            }
            List<String> free = new ArrayList<>(TeilSpec.HEADLINE_LETTERS);
            free.removeAll(taken);
            Collections.shuffle(free, rnd);
            for (int i = 0; i < todo.size(); i++) {
                int s = todo.get(i)[0];
                JsonNode n = bySlot.get(s);
                String head = n == null ? null : text(n, "headline");
                String near = n == null ? null : text(n, "nearHeadline");
                if (head == null || near == null || head.equalsIgnoreCase(near)) {
                    problems.add(spec.itemId(s));
                    continue;
                }
                List<String> mine = new ArrayList<>();
                if (current.get(s) != null) mine.addAll(current.get(s).options().keySet());
                free.removeAll(mine);
                while (mine.size() < 2 && !free.isEmpty()) mine.add(free.remove(0));
                Collections.shuffle(mine, rnd);
                String cl = mine.get(0);
                String nl = mine.get(1);
                Map<String, String> options = new TreeMap<>();
                options.put(cl, head);
                options.put(nl, near);
                String expl = firstNonBlank(text(n, "explanationVi"), "").replace("{1}", cl).replace("{2}", nl);
                String trap = text(n, "trap");
                current.set(s, new Item(spec.itemId(s), "Text " + (s + 1), options, cl, expl,
                        firstNonBlank(text(n, "evidence"), s < paras.size() ? paras.get(s) : ""),
                        trap == null ? List.of() : List.of(new Trap(nl, trap)), todoLevels.get(i), null,
                        current.get(s) != null && current.get(s).locked(), null, List.of()));
            }
            saveItems(draftId, current.stream().filter(Objects::nonNull).toList());
            advanceStep(draftId, "ITEMS");
            if (!problems.isEmpty()) {
                throw new IllegalStateException("AI trả hỏng câu " + String.join(", ", problems) + " — bấm Sinh lại cho câu đó.");
            }
            return;
        }
        List<String> letters = new ArrayList<>();
        for (int s = 0; s < count; s++) letters.add(current.get(s) == null ? null : current.get(s).correct());
        for (int i = 0; i < todo.size(); i++) {
            int s = todo.get(i)[0];
            JsonNode n = bySlot.get(s);
            if (n == null) {
                problems.add(spec.itemId(s));
                continue;
            }
            List<ItemRules.RawOption> raw = rawOptions(n);
            if (raw == null) {
                problems.add(spec.itemId(s));
                continue;
            }
            letters.set(s, null);
            String letter = ItemRules.chooseLetter(letters, s, rnd);
            letters.set(s, letter);
            ItemRules.Lettered l = ItemRules.letter(raw, letter, text(n, "explanationVi"));
            current.set(s, new Item(spec.itemId(s), firstNonBlank(text(n, "question"), ""), l.options(), l.correct(),
                    l.explanation(), firstNonBlank(text(n, "evidence"), ""), l.traps(), todoLevels.get(i), null,
                    current.get(s) != null && current.get(s).locked(), null, List.of()));
        }
        List<Item> result = current.stream().filter(Objects::nonNull).toList();
        saveItems(draftId, result);
        advanceStep(draftId, "ITEMS");
        if (!problems.isEmpty()) {
            throw new IllegalStateException("AI trả hỏng câu " + String.join(", ", problems) + " — bấm Sinh lại cho câu đó.");
        }
    }

    private static Map<Integer, JsonNode> bySlot(JsonNode out, List<int[]> todo) {
        Map<Integer, JsonNode> bySlot = new HashMap<>();
        int fallback = 0;
        for (JsonNode n : out.path("items")) {
            int slot = n.has("slot") ? n.path("slot").asInt(-1) : -1;
            final int asked = slot;
            if (slot < 0 || todo.stream().noneMatch(t -> t[0] == asked) || bySlot.containsKey(slot)) {
                while (fallback < todo.size() && bySlot.containsKey(todo.get(fallback)[0])) fallback++;
                if (fallback >= todo.size()) break;
                slot = todo.get(fallback)[0];
            }
            bySlot.put(slot, n);
        }
        return bySlot;
    }

    /** Ba phương án AI trả, đúng một phương án đúng; {@code null} khi sai khuôn. */
    private static List<ItemRules.RawOption> rawOptions(JsonNode n) {
        if (n == null) return null;
        List<ItemRules.RawOption> raw = new ArrayList<>();
        for (JsonNode o : n.path("options")) {
            raw.add(new ItemRules.RawOption(firstNonBlank(text(o, "text"), ""), o.path("correct").asBoolean(false),
                    text(o, "trap")));
        }
        return raw.size() == 3 && raw.stream().filter(ItemRules.RawOption::correct).count() == 1 ? raw : null;
    }

    /** Câu a/b/c phải là nửa câu để nối tiếp (đề telc thật), không phải câu hỏi. */
    static boolean isSentenceStem(String question) {
        return question != null && !question.isBlank() && !question.contains("?");
    }

    /**
     * Lời nhắc (tiếng Đức, đưa thẳng cho AI) khi câu vừa sinh trái công thức của bậc được giao; {@code null} khi ổn
     * hoặc khi AI trả sai khuôn (đường xử lý lỗi khuôn lo).
     */
    static String recipeHint(String context, JsonNode n, String target) {
        List<ItemRules.RawOption> raw = rawOptions(n);
        if (raw == null) return null;
        Map<String, String> options = new LinkedHashMap<>();
        String correct = "a";
        for (int i = 0; i < raw.size(); i++) {
            String l = ItemRules.LETTERS.get(i);
            options.put(l, raw.get(i).text());
            if (raw.get(i).correct()) correct = l;
        }
        String question = firstNonBlank(text(n, "question"), "");
        Item probe = new Item("probe", question, options, correct, "", firstNonBlank(text(n, "evidence"), ""),
                List.of(), target, null, false, null, List.of());
        ItemMetrics.Measured m = ItemMetrics.measure(context, probe);
        List<String> out = new ArrayList<>();
        if (!isSentenceStem(question)) {
            out.add("Kein Fragesatz: \"question\" muss ein Satzanfang sein, der mit \" …\" endet.");
        }
        if (!m.evidenceFound()) {
            out.add("\"evidence\" muss wörtlich aus dem Text kopiert sein (ganze Sätze).");
        } else if (ItemRules.rank(target) > ItemRules.rank(ItemMetrics.ceiling(m))) {
            out.add("EXPERT".equals(target) && !m.multiParagraph()
                    ? "Verlangt ist EXPERT, aber der Beleg steht nur in Absatz " + m.evidenceParagraphs()
                    + ". Die Lösung muss Informationen aus ZWEI verschiedenen Absätzen verbinden."
                    : "Verlangt ist " + target + ", aber der Beleg steht in einem einzigen Satz und die Lösung "
                    + "wiederholt dessen Wörter. Die Lösung muss aus mehreren Sätzen erschlossen und mit anderen "
                    + "Wörtern formuliert werden.");
        } else if (ItemRules.rank(target) < ItemRules.rank(ItemMetrics.floor(m))) {
            out.add("Verlangt ist EASY: Beleg in EINEM Satz, die Lösung benutzt die Wörter dieses Satzes.");
        }
        if (ItemRules.rank(target) >= ItemRules.rank("HARD") && !m.distractorsInText()) {
            out.add("Die falschen Enden müssen echte Details aus dem Text aufgreifen (feine Falle), nicht frei erfunden sein.");
        }
        return out.isEmpty() ? null : String.join(" ", out);
    }

    // ── Tự kiểm ─────────────────────────────────────────────────────────────────────────────

    public Draft verify(long id, long userId) {
        Row r = requireEditable(id);
        if (r.text() == null || (r.items().isEmpty() && !r.spec().writing())) {
            throw new BadRequestException("Cần có bài đọc và câu hỏi trước.");
        }
        enqueue(id, "VERIFY", userId, new HashMap<>());
        return get(id);
    }

    void runVerify(long draftId, long userId) {
        Row r = load(draftId);
        List<SourceRow> srcs = sources(draftId);
        Text text = r.text().text();
        List<Item> items = r.items();

        TeilSpec spec = r.spec();
        if (spec.writing()) {
            JsonNode review = situ.reviewWriting(userId, spec, text);
            TextMetrics m = metrics(r, srcs);
            List<Check> checks = teilChecks(r, srcs, m, List.of(), Map.of(), review);
            jdbc.update("""
                    UPDATE exam_drafts SET checks_json = ?::jsonb, verified_hash = ?, updated_at = now() WHERE id = ?
                    """, json(checks), contentHash(text, List.of()), draftId);
            advanceStep(draftId, "REVIEW");
            return;
        }
        JsonNode rubric;
        Map<String, String> strong;
        Map<String, String> weak;
        Map<String, String> blind;
        if (spec.situational()) {
            String lv = spec.cefrLevel();
            rubric = ai.call(userId, "VERIFY", com.deutschflow.ai.tier.LlmTier.GRADING_EXAM,
                    ExamStudioAi.RUBRIC_SYSTEM.formatted(lv), situ.solverBlock(spec, text, items, true), 0.0, 2_500);
            String block = situ.solverBlock(spec, text, items, false);
            strong = answers(ai.call(userId, "VERIFY", com.deutschflow.ai.tier.LlmTier.GRADING_EXAM,
                    ExamStudioAi.SOLVE_SYSTEM, block, 0.0, 900), spec);
            weak = answers(ai.call(userId, "VERIFY", com.deutschflow.ai.tier.LlmTier.CHAT_FREE,
                    ExamStudioAi.WEAK_SOLVE_SYSTEM, block, 0.3, 900), spec);
            // Rao vặt / điền ô: giấu thư hoặc mẩu tin thì không còn gì để giải — bỏ lượt giải khi giấu bài.
            blind = Map.of();
        } else {
            rubric = ai.rubric(userId, spec, text, items);
            strong = answers(ai.solveStrong(userId, spec, text, items), spec);
            // Bài báo a/b/c: phép thử "chỉ thấy một đoạn" (bên dưới) thay cho AI đóng vai học viên A2 — model
            // đóng vai vẫn đọc cả bài nên không cho biết gì về độ khó (chạy thử 11/11/2026).
            weak = mcNews(spec) ? Map.of() : answers(ai.solveWeak(userId, spec, text, items), spec);
            // Ghép tiêu đề: không có bài thì không biết "Text 3" nói gì — giải khi giấu bài vô nghĩa, bỏ qua.
            blind = spec.headlines() ? Map.of() : answers(ai.solveBlind(userId, spec, items), spec);
        }
        Map<String, JsonNode> rubricById = new HashMap<>();
        rubric.path("items").forEach(n -> rubricById.put(n.path("id").asText(), n));

        // Đo bằng code (chỉ bài báo a/b/c) và phép thử "chỉ thấy một đoạn" cho các câu khai bằng chứng ở ≥ 2 đoạn.
        Map<String, ItemMetrics.Measured> metricsById = new HashMap<>();
        Map<String, String> onePara = Map.of();
        if (mcNews(spec)) {
            List<String> paragraphs = TextChecks.paragraphs(text.context());
            Map<String, String> paragraphOf = new LinkedHashMap<>();
            for (Item it : items) {
                ItemMetrics.Measured im = ItemMetrics.measure(text.context(), it);
                metricsById.put(it.id(), im);
                if (im.multiParagraph()) paragraphOf.put(it.id(), paragraphs.get(im.evidenceParagraphs().get(0) - 1));
            }
            if (!paragraphOf.isEmpty()) {
                List<Item> multi = items.stream().filter(i -> paragraphOf.containsKey(i.id())).toList();
                onePara = answers(ai.solveOneParagraph(userId, multi, paragraphOf), spec);
            }
        }

        String context = norm(SituationalTeile.metricsText(spec, text));
        List<ExamDedupService.BankBlock> bank = dedup.bank(r.examFormat(), r.cefrLevel(), r.section(), r.teil());
        Map<String, ExamDedupService.ItemDup> dupById = new HashMap<>();
        for (ExamDedupService.ItemDup d : dedup.itemDuplicates(bank, items)) dupById.put(d.itemId(), d);
        List<Item> verified = new ArrayList<>();
        for (Item it : items) {
            List<String> flags = new ArrayList<>();
            int sev = 0;
            ExamDedupService.ItemDup dup = dupById.get(it.id());
            if (dup != null) {
                flags.add((dup.exact() ? "Trùng hẳn" : "Gần trùng") + " câu " + dup.blockItemId() + " của Teil kho #"
                        + dup.blockId() + " — viết câu khác.");
                sev = 2;
            }
            boolean fmt = spec.situational() ? situ.formatOk(spec, text, it) : formatOk(it, spec);
            if (!fmt) {
                flags.add("Thiếu câu hỏi, phương án hoặc đáp án.");
                sev = 2;
            }
            if (mcNews(spec) && !isSentenceStem(it.question())) {
                flags.add("Sai dạng telc: phải là nửa câu để nối tiếp (kết thúc bằng \" …\"), không phải câu hỏi.");
                sev = 2;
            }
            if (it.evidence() == null || it.evidence().isBlank() || !context.contains(norm(it.evidence()))) {
                flags.add("Câu bằng chứng không có nguyên văn trong bài.");
                sev = Math.max(sev, 1);
            }
            String s = strong.get(it.id());
            if (s != null && !sameAnswer(spec, it, s)) {
                flags.add("AI giỏi chọn " + s + " thay vì " + it.correct() + ": câu có thể mơ hồ hoặc đáp án sai.");
                sev = 2;
            }
            String b = blind.get(it.id());
            if (b != null && sameAnswer(spec, it, b)) {
                flags.add("Trả lời đúng được khi KHÔNG đọc bài: câu đoán mò được.");
                sev = 2;
            }
            DifficultyMeasured measured = null;
            JsonNode rn = rubricById.get(it.id());
            if (rn != null) {
                Scores sc = new Scores(ItemRules.clamp(rn.path("phrasing").asInt()), ItemRules.clamp(rn.path("evidence").asInt()),
                        ItemRules.clamp(rn.path("distractors").asInt()), ItemRules.clamp(rn.path("language").asInt()));
                boolean multi = rn.path("multiParagraph").asBoolean(false);
                boolean half = rn.path("halfTrue").asBoolean(false);
                ItemMetrics.Measured im = metricsById.get(it.id());
                if (im != null) {
                    // Điểm đếm được lấy theo code; AI chỉ còn quyết ngôn ngữ câu hỏi và độ tinh của bẫy.
                    String one = onePara.get(it.id());
                    boolean solvedInOne = one != null && sameAnswer(spec, it, one);
                    int evidence = im.evidenceFound() ? im.evidence() : sc.evidence();
                    if (solvedInOne) {
                        evidence = Math.min(evidence, 1);
                        flags.add("Chỉ đọc một đoạn đã giải được: câu này chưa phải câu gộp hai đoạn.");
                    }
                    int distractors = im.distractorsInText() ? Math.max(1, sc.distractors()) : 0;
                    sc = new Scores(im.phrasing(), evidence, distractors, sc.language());
                    multi = im.evidenceFound() ? im.multiParagraph() && !solvedInOne : multi && !solvedInOne;
                }
                String level = ItemRules.levelOf(sc, multi, half);
                String hint = ItemRules.hint(it.difficultyTarget(), level, sc, multi, half);
                measured = new DifficultyMeasured(sc, sc.total(), level, hint);
                if (hint != null) {
                    int gap = Math.abs(ItemRules.rank(it.difficultyTarget()) - ItemRules.rank(level));
                    // Bậc đo bằng code mà lệch từ hai bậc là sai hẳn công thức — chặn duyệt. Lệch một bậc: nhãn
                    // vào kho theo bậc đo được (xem blockContent), nên chỉ cần báo vàng.
                    boolean far = im != null && gap >= 2;
                    flags.add((far ? "Độ khó lệch " + gap + " bậc — sinh lại hoặc đổi bậc giao: " : "Độ khó lệch: ") + hint);
                    sev = Math.max(sev, far ? 2 : 1);
                }
            }
            String w = weak.get(it.id());
            if (w != null && sameAnswer(spec, it, w)
                    && ("HARD".equals(it.difficultyTarget()) || "EXPERT".equals(it.difficultyTarget()))) {
                flags.add("AI đóng vai học viên A2 vẫn làm đúng: có lẽ dễ hơn nhãn " + ItemRules.label(it.difficultyTarget()) + ".");
                sev = Math.max(sev, 1);
            }
            verified.add(it.withVerification(measured, sev == 2 ? "RED" : sev == 1 ? "YELLOW" : "GREEN", flags));
        }

        TextMetrics m = metrics(r, srcs);
        List<Check> checks = new ArrayList<>(teilChecks(r, srcs, m, verified, strong, null));
        if (!spec.situational()) checks.add(faithfulCheck(userId, spec, text, srcs));
        String hash = contentHash(text, verified);
        jdbc.update("""
                UPDATE exam_drafts SET items_json = ?::jsonb, checks_json = ?::jsonb, verified_hash = ?,
                       updated_at = now() WHERE id = ?
                """, json(verified), json(checks), hash, draftId);
        advanceStep(draftId, "REVIEW");
    }

    /**
     * Bài có nói đúng những gì dữ kiện đã tích nói không (đổi "liên quan" thành "gây ra", gắn nhầm nhóm, thêm số
     * liệu). Đèn VÀNG chứ không đỏ: đây là phán đoán của AI, owner đọc từng câu bị nêu rồi tự tích mục
     * "Dữ kiện khớp nguồn" trong danh sách duyệt.
     */
    private Check faithfulCheck(long userId, TeilSpec spec, Text text, List<SourceRow> srcs) {
        String label = "Bài khớp dữ kiện đã tích";
        List<Fact> facts = selectedFacts(srcs);
        if (facts.isEmpty()) return new Check("FAITHFUL", label, "YELLOW", "Không có dữ kiện nào được tích để đối chiếu.");
        List<String> issues = new ArrayList<>();
        try {
            for (JsonNode n : ai.faithfulness(userId, spec, text, facts).path("issues")) {
                String sentence = text(n, "sentence");
                String problem = text(n, "problemVi");
                if (sentence != null && problem != null) issues.add("„" + cut(sentence, 160) + "“ — " + problem);
                if (issues.size() >= 5) break;
            }
        } catch (RuntimeException e) {
            return new Check("FAITHFUL", label, "YELLOW", "Không chạy được lượt đối chiếu (" + e.getMessage() + ").");
        }
        return new Check("FAITHFUL", label, issues.isEmpty() ? "GREEN" : "YELLOW",
                issues.isEmpty() ? null : String.join(" · ", issues));
    }

    List<Check> teilChecks(Row r, List<SourceRow> srcs, TextMetrics m, List<Item> items, Map<String, String> strong,
                           JsonNode writingReview) {
        List<Check> out = new ArrayList<>();
        int expected = r.itemCount();
        TeilSpec spec = r.spec();
        if (spec.situational()) {
            Text text = r.text().text();
            out.addAll(situ.checks(spec, text, items, writingReview));
            if (!spec.writing()) {
                boolean fmt = items.size() == expected && items.stream().allMatch(i -> situ.formatOk(spec, text, i));
                out.add(0, new Check("FORMAT", "Đúng khuôn Teil", fmt ? "GREEN" : "RED",
                        fmt ? null : "Cần " + expected + " câu đúng khuôn " + spec.teilType() + "."));
                boolean solverOk = !strong.isEmpty() && items.stream().allMatch(i -> strong.get(i.id()) != null
                        && sameAnswer(spec, i, strong.get(i.id())));
                out.add(new Check("SOLVER", "AI giỏi giải đúng mọi câu", solverOk ? "GREEN" : "RED",
                        solverOk ? null : "Có câu AI giỏi chọn khác đáp án — xem đèn từng câu."));
                out.add(matrixCheck(r, items));
            }
            boolean lexOk = m.aboveLevelRatio() <= m.maxAboveLevelRatio();
            out.add(new Check("LEXICAL", "Từ vựng đúng cấp", lexOk ? "GREEN" : "YELLOW",
                    String.format(Locale.ROOT, "%.1f%% từ trên cấp (ngưỡng %.0f%%).", m.aboveLevelRatio() * 100,
                            m.maxAboveLevelRatio() * 100)));
            out.add(duplicateCheck(r, srcs));
            return out;
        }
        boolean formatOk = items.size() == expected && items.stream().allMatch(i -> formatOk(i, spec))
                && (!spec.headlines() || headlinesOk(items));
        out.add(new Check("FORMAT", "Đúng khuôn Teil", formatOk ? "GREEN" : "RED", formatOk ? null : spec.headlines()
                ? "Cần " + expected + " văn bản, mỗi văn bản 1 tiêu đề đúng + 1 tiêu đề nhiễu, 10 tiêu đề a–j không trùng."
                : "Cần " + expected + " câu, mỗi câu 3 phương án và đúng 1 đáp án."));

        boolean solverOk = !strong.isEmpty() && items.stream().allMatch(i -> i.correct().equals(strong.get(i.id())));
        out.add(new Check("SOLVER", "AI giỏi giải đúng mọi câu", solverOk ? "GREEN" : "RED",
                solverOk ? null : "Có câu AI giỏi chọn khác đáp án — xem đèn từng câu."));

        out.add(new Check("OVERLAP", "Không trùng nguyên văn nguồn", m.overlapMaxRun() >= m.overlapLimit() ? "RED" : "GREEN",
                m.overlapMaxRun() >= m.overlapLimit() ? "Có đoạn " + m.overlapMaxRun() + " từ trùng nguồn." : null));

        if (spec.headlines()) {
            List<String> paras = TextChecks.paragraphs(r.text().text().context());
            List<String> bad = new ArrayList<>();
            for (int i = 0; i < paras.size(); i++) {
                int wc = TextChecks.wordCount(paras.get(i));
                if (wc < spec.minWords() || wc > spec.maxWords()) bad.add("Text " + (i + 1) + ": " + wc + " từ");
            }
            boolean countOk = paras.size() == spec.textCount();
            out.add(new Check("LENGTH", "Độ dài từng văn bản", countOk && bad.isEmpty() ? "GREEN" : "YELLOW",
                    (countOk ? "" : paras.size() + "/" + spec.textCount() + " văn bản. ")
                            + (bad.isEmpty() ? "Mỗi văn bản " + spec.minWords() + "–" + spec.maxWords() + " từ."
                            : String.join("; ", bad) + " (khuôn " + spec.minWords() + "–" + spec.maxWords() + ").")));
        } else {
            boolean wordsOk = m.wordCount() >= m.wordRange().get(0) && m.wordCount() <= m.wordRange().get(1);
            // Ngắn hơn khuôn là đèn ĐỎ: bài không đủ chỗ cho năm câu ở các đoạn khác nhau. Dài hơn chỉ báo vàng.
            boolean tooShort = m.wordCount() < m.wordRange().get(0);
            out.add(new Check("LENGTH", "Độ dài bài", wordsOk ? "GREEN" : tooShort ? "RED" : "YELLOW",
                    m.wordCount() + " từ (khuôn " + m.wordRange().get(0) + "–" + m.wordRange().get(1) + ")."));
        }

        boolean lexOk = m.aboveLevelRatio() <= m.maxAboveLevelRatio();
        out.add(new Check("LEXICAL", "Từ vựng đúng cấp", lexOk ? "GREEN" : "YELLOW",
                String.format(Locale.ROOT, "%.1f%% từ trên cấp (ngưỡng %.0f%%).", m.aboveLevelRatio() * 100,
                        m.maxAboveLevelRatio() * 100)));

        out.add(matrixCheck(r, items));

        if (spec.headlines()) {
            out.addAll(sourceAndDuplicateChecks(r, srcs));
            return out;
        }
        boolean letterOk = lettersBalanced(items.stream().map(Item::correct).toList());
        out.add(new Check("ANSWERS", "Phân bố đáp án a/b/c", letterOk ? "GREEN" : "YELLOW",
                letterOk ? null : "Đáp án dồn vào một chữ hoặc 3 câu liền cùng chữ."));

        String ctx = norm(r.text().text().context());
        List<Integer> pos = items.stream().map(i -> i.evidence() == null ? -1 : ctx.indexOf(norm(i.evidence()))).toList();
        boolean followsText = pos.stream().allMatch(p -> p >= 0) && items.size() > 2;
        for (int i = 1; i < pos.size() && followsText; i++) if (pos.get(i) <= pos.get(i - 1)) followsText = false;
        out.add(new Check("ORDER", "Thứ tự câu không theo thứ tự bài", followsText ? "YELLOW" : "GREEN",
                followsText ? "Mọi câu đang theo đúng thứ tự bài — đề telc không như vậy." : null));

        out.addAll(sourceAndDuplicateChecks(r, srcs));
        return out;
    }

    private Check matrixCheck(Row r, List<Item> items) {
        Map<String, Integer> planned = normalizedPlan(r.plan());
        Map<String, Integer> measured = new LinkedHashMap<>();
        for (String l : TeilSpec.LEVELS) measured.put(l, 0);
        boolean allMeasured = true;
        for (Item i : items) {
            if (i.difficultyMeasured() == null) allMeasured = false;
            else measured.merge(i.difficultyMeasured().level(), 1, Integer::sum);
        }
        boolean matrixOk = allMeasured && measured.equals(planned);
        String matrixDetail = "Giao " + fmtPlan(planned) + " · đo được " + fmtPlan(measured) + ".";
        boolean tooHard = "EXAM".equals(r.mode()) && planned.get("EXPERT") > 1;
        if (tooHard) matrixDetail += " Quá 1 câu Siêu khó: khó hơn đề thật.";
        return new Check("MATRIX", "Ma trận độ khó", matrixOk && !tooHard ? "GREEN" : "YELLOW", matrixDetail);
    }

    /** Chống trùng lớp 1: toàn bộ chữ của Teil so với các Teil đã duyệt cùng ô trong kho. */
    private Check duplicateCheck(Row r, List<SourceRow> srcs) {
        String mine = ExamDedupService.contentText(blockContent(r, usedSources(srcs)));
        Optional<ExamDedupService.Similar> sim = dedup.mostSimilar(
                dedup.bank(r.examFormat(), r.cefrLevel(), r.section(), r.teil()), mine);
        boolean dup = sim.isPresent() && sim.get().score() > ExamDedupService.TEIL_LIMIT;
        return new Check("DUPLICATE", "Không trùng Teil đã có trong kho", dup ? "RED" : "GREEN", dup
                ? String.format(Locale.ROOT, "Giống %.0f%% Teil kho #%d — đổi chủ đề/tình huống rồi viết lại.",
                sim.get().score() * 100, sim.get().blockId()) : null);
    }

    private List<Check> sourceAndDuplicateChecks(Row r, List<SourceRow> srcs) {
        List<Check> out = new ArrayList<>();
        List<SourceRow> used = usedSources(srcs);
        boolean flagged = used.stream().anyMatch(s -> "FLAGGED".equals(s.source().neutrality()));
        out.add(new Check("NEUTRAL", "Chủ đề trung lập", flagged ? "RED" : "GREEN",
                flagged ? "Có nguồn bị cờ chủ đề nhạy cảm." : null));
        long uncorroborated = used.stream().filter(s -> "FACTS_ONLY".equals(s.source().usageMode()))
                .flatMap(s -> s.source().facts().stream()).filter(f -> f.selected() && !f.corroborated()).count();
        out.add(new Check("CORROBORATION", "Dữ kiện báo có nguồn thứ hai", uncorroborated > 0 ? "YELLOW" : "GREEN",
                uncorroborated > 0 ? uncorroborated + " dữ kiện báo chưa có nguồn thứ hai xác nhận." : null));
        boolean confirmed = used.stream().allMatch(s -> s.source().usageModeConfirmed());
        out.add(new Check("USAGE", "Loại dùng nguồn đã xác nhận", confirmed ? "GREEN" : "YELLOW",
                confirmed ? null : "Xác nhận \"Chuyển thể\" hay \"Chỉ dữ kiện\" cho từng nguồn ở bước Nguồn."));

        out.add(duplicateCheck(r, srcs));
        return out;
    }

    // ── Duyệt ───────────────────────────────────────────────────────────────────────────────

    @Transactional
    public Draft approve(long id, Map<String, Boolean> checklist, long userId) {
        Row r = requireEditable(id);
        if (r.text() == null || (r.items().isEmpty() && !r.spec().writing())) {
            throw new BadRequestException("Chưa có bài và câu hỏi.");
        }
        if (r.checks().isEmpty() || r.verifiedHash() == null
                || !r.verifiedHash().equals(contentHash(r.text().text(), r.items()))) {
            throw new ConflictException("Nội dung đã đổi sau lần tự kiểm cuối — hãy chạy tự kiểm lại.");
        }
        if (r.checks().stream().anyMatch(c -> "RED".equals(c.light()))
                || r.items().stream().anyMatch(i -> "RED".equals(i.light()))) {
            throw new ConflictException("Còn đèn đỏ — sửa trước khi duyệt.");
        }
        List<String> missing = TeilSpec.CHECKLIST_KEYS.stream()
                .filter(k -> checklist == null || !Boolean.TRUE.equals(checklist.get(k))).toList();
        if (!missing.isEmpty()) throw new BadRequestException("Chưa tích đủ danh sách duyệt: " + String.join(", ", missing));
        List<SourceRow> used = usedSources(sources(id));
        if (used.isEmpty() && !r.spec().situational()) {
            throw new BadRequestException("Teil phải có ít nhất một nguồn có dữ kiện đã tích.");
        }
        if (used.stream().anyMatch(s -> !s.source().usageModeConfirmed())) {
            throw new BadRequestException("Hãy xác nhận loại dùng (Chuyển thể / Chỉ dữ kiện) cho mọi nguồn đã dùng.");
        }

        Map<String, Object> content = blockContent(r, used);
        String hash = TextChecks.sha256(ExamDedupService.contentText(content));
        Integer dup = jdbc.queryForObject("SELECT COUNT(*) FROM exam_teil_blocks WHERE content_hash = ?", Integer.class, hash);
        if (dup != null && dup > 0) throw new ConflictException("Teil này đã có y hệt trong kho.");
        Long blockId = jdbc.queryForObject("""
                INSERT INTO exam_teil_blocks (exam_format, cefr_level, section, teil, teil_type, theme, content_json,
                                              content_hash, reviewed_by)
                VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id
                """, Long.class, r.examFormat(), r.cefrLevel(), r.section(), r.teil(), r.teilType(), r.theme(),
                json(content), hash, userId);
        Map<String, Boolean> cl = new LinkedHashMap<>();
        for (String k : TeilSpec.CHECKLIST_KEYS) cl.put(k, true);
        jdbc.update("""
                UPDATE exam_drafts SET status = 'APPROVED', step = 'APPROVED', block_id = ?, review_checklist = ?::jsonb,
                       updated_at = now() WHERE id = ?
                """, blockId, json(cl), id);
        return get(id);
    }

    /** Một phần tử {@code teile[]} đúng khuôn {@code sections_json} (như bản thử Schlaf), cộng các khoá xưởng. */
    Map<String, Object> blockContent(Row r, List<SourceRow> used) {
        TeilSpec spec = r.spec();
        if (spec.situational()) {
            Map<String, Object> c = situ.content(spec, r.text().text(), r.items());
            if (!used.isEmpty()) c.put("source", sourceMap(used));
            return c;
        }
        if (spec.headlines()) return headlineContent(r, used);
        Text t = r.text().text();
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("teil", spec.teil());
        c.put("type", spec.teilType());
        c.put("point_per_item", spec.points());
        c.put("instruction_de", spec.instructionDe());
        c.put("instruction_vi", spec.instructionVi());
        c.put("title_de", t.titleDe());
        c.put("vorspann_de", t.vorspannDe());
        c.put("context_lines", true);
        c.put("glossary", t.glossary().stream().map(g -> Map.of("term", g.term(), "explanation_de", g.explanationDe())).toList());
        c.put("context", TextChecks.wrap(t.context(), LINE_WIDTH));
        c.put("source", sourceMap(used));
        if (used.size() > 1) {
            c.put("sources", used.stream().map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("title", s.source().title());
                m.put("publisher", s.source().publisher());
                m.put("url", s.source().url());
                m.put("usage", s.source().usageMode());
                return m;
            }).toList());
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (Item it : r.items()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", it.id());
            m.put("question", it.question());
            m.put("options", it.options());
            m.put("correct", it.correct());
            m.put("explanation_vi", it.explanationVi());
            m.put("evidence", it.evidence());
            m.put("traps", it.traps());
            // Nhãn vào kho là bậc ĐO ĐƯỢC (bài báo a/b/c đo bằng code); bậc giao chỉ là ý định lúc sinh câu.
            String measured = it.difficultyMeasured() == null ? null : it.difficultyMeasured().level();
            m.put("difficulty_target", mcNews(r.spec()) && measured != null ? measured : it.difficultyTarget());
            m.put("difficulty_measured", measured);
            items.add(m);
        }
        c.put("items", items);
        return c;
    }

    /** Lesen Teil 1 đúng khuôn đề telc (V343): headlines a–j ở cấp Teil, mỗi item một văn bản. */
    Map<String, Object> headlineContent(Row r, List<SourceRow> used) {
        TeilSpec spec = r.spec();
        List<String> paras = TextChecks.paragraphs(r.text().text().context());
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("teil", spec.teil());
        c.put("type", spec.teilType());
        c.put("point_per_item", spec.points());
        c.put("single_use", true);
        c.put("instruction_de", spec.instructionDe());
        c.put("instruction_vi", spec.instructionVi());
        Map<String, String> headlines = new TreeMap<>();
        for (Item it : r.items()) headlines.putAll(it.options());
        c.put("headlines", headlines);
        c.put("source", sourceMap(used));
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < r.items().size(); i++) {
            Item it = r.items().get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", it.id());
            m.put("question", it.question());
            m.put("text", i < paras.size() ? paras.get(i) : "");
            m.put("correct", it.correct());
            m.put("explanation_vi", it.explanationVi());
            m.put("evidence", it.evidence());
            m.put("traps", it.traps());
            m.put("difficulty_target", it.difficultyTarget());
            m.put("difficulty_measured", it.difficultyMeasured() == null ? null : it.difficultyMeasured().level());
            items.add(m);
        }
        c.put("items", items);
        return c;
    }

    private Map<String, Object> sourceMap(List<SourceRow> used) {
        if (used.isEmpty()) return null;
        Source primary = used.get(0).source();
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("title", primary.title());
        source.put("author", primary.author());
        source.put("publisher", primary.publisher());
        source.put("url", primary.url());
        source.put("license", "ADAPT".equals(primary.usageMode()) ? primary.licenseText() : null);
        source.put("usage", primary.usageMode());
        source.put("changed", true);
        source.put("quelle", quelle(used));
        return source;
    }

    // ── Kho Teil ────────────────────────────────────────────────────────────────────────────

    public List<BlockSummary> listBlocks(String level, String section, Integer teil) {
        return jdbc.query("""
                SELECT b.id, b.exam_format, b.cefr_level, b.section, b.teil, b.theme, b.content_json->>'title_de' AS title_de,
                       b.content_json->'items' AS items, u.email AS reviewer, b.reviewed_at
                FROM exam_teil_blocks b LEFT JOIN users u ON u.id = b.reviewed_by
                WHERE b.status = 'APPROVED' AND (?::text IS NULL OR b.cefr_level = ?::text)
                  AND (?::text IS NULL OR b.section = ?::text) AND (?::int IS NULL OR b.teil = ?::int)
                ORDER BY b.reviewed_at DESC LIMIT 500
                """, (rs, n) -> new BlockSummary(rs.getLong("id"), rs.getString("exam_format"), rs.getString("cefr_level"),
                        rs.getString("section"), rs.getInt("teil"), rs.getString("theme"), rs.getString("title_de"),
                        counts(rs.getString("items")), rs.getString("reviewer"), instant(rs.getTimestamp("reviewed_at"))),
                level, level, section, section, teil, teil);
    }

    public BlockDetail getBlock(long id) {
        List<BlockDetail> rows = jdbc.query("""
                SELECT b.id, b.exam_format, b.cefr_level, b.section, b.teil, b.theme, b.content_json::text AS content,
                       u.email AS reviewer, b.reviewed_at
                FROM exam_teil_blocks b LEFT JOIN users u ON u.id = b.reviewed_by WHERE b.id = ?
                """, (rs, n) -> {
            Map<String, Object> content = read(rs.getString("content"), new TypeReference<Map<String, Object>>() {}, Map.of());
            return new BlockDetail(rs.getLong("id"), rs.getString("exam_format"), rs.getString("cefr_level"),
                    rs.getString("section"), rs.getInt("teil"), rs.getString("theme"), (String) content.get("title_de"),
                    counts(json(content.getOrDefault("items", List.of()))), rs.getString("reviewer"),
                    instant(rs.getTimestamp("reviewed_at")), content);
        }, id);
        if (rows.isEmpty()) throw new NotFoundException("Không tìm thấy Teil " + id + ".");
        return rows.get(0);
    }

    private Map<String, Integer> counts(String itemsJson) {
        Map<String, Integer> out = new LinkedHashMap<>();
        for (String l : TeilSpec.LEVELS) out.put(l, 0);
        List<Map<String, Object>> items = read(itemsJson, new TypeReference<List<Map<String, Object>>>() {}, List.of());
        for (Map<String, Object> it : items) {
            Object lv = it.get("difficulty_target");
            if (lv != null && out.containsKey(lv.toString())) out.merge(lv.toString(), 1, Integer::sum);
        }
        return out;
    }

    // ── Job: đặt / gỡ busy ──────────────────────────────────────────────────────────────────

    @Transactional
    void enqueue(long draftId, String op, long userId, Map<String, Object> extra) {
        int n = jdbc.update("""
                UPDATE exam_drafts SET busy_op = ?, busy_job_id = NULL, last_error = NULL, updated_at = now()
                WHERE id = ? AND busy_op IS NULL AND status = 'DRAFT'
                """, op, draftId);
        if (n == 0) throw new ConflictException("Đang có một thao tác AI chạy trên bản nháp này, đợi xong rồi thử lại.");
        Map<String, Object> payload = new HashMap<>(extra);
        payload.put("draftId", draftId);
        payload.put("op", op);
        AiJob job = jobs.save(AiJob.builder().jobType(ExamStudioJobHandler.JOB_TYPE).userId(userId).payload(payload).build());
        jdbc.update("UPDATE exam_drafts SET busy_job_id = ? WHERE id = ?", job.getId(), draftId);
    }

    void finishBusy(long draftId, String error) {
        jdbc.update("UPDATE exam_drafts SET busy_op = NULL, busy_job_id = NULL, last_error = ?, updated_at = now() WHERE id = ?",
                error, draftId);
    }

    // ── Lưu & tính phụ ──────────────────────────────────────────────────────────────────────

    private void saveText(long id, StoredText t) {
        Row r = load(id);
        List<Item> cleared = r.items().stream().map(Item::cleared).toList();
        jdbc.update("""
                UPDATE exam_drafts SET text_json = ?::jsonb, items_json = ?::jsonb, checks_json = '[]'::jsonb,
                       verified_hash = NULL, updated_at = now() WHERE id = ?
                """, json(t), json(cleared), id);
    }

    private void saveItems(long id, List<Item> items) {
        jdbc.update("""
                UPDATE exam_drafts SET items_json = ?::jsonb, checks_json = '[]'::jsonb, verified_hash = NULL,
                       updated_at = now() WHERE id = ?
                """, json(items.stream().map(Item::cleared).toList()), id);
    }

    private void advanceStep(long id, String step) {
        Row r = load(id);
        if (STEPS.indexOf(step) > STEPS.indexOf(r.step())) {
            jdbc.update("UPDATE exam_drafts SET step = ?, updated_at = now() WHERE id = ?", step, id);
        }
    }

    private void touch(long id) {
        jdbc.update("UPDATE exam_drafts SET updated_at = now() WHERE id = ?", id);
    }

    private Row requireEditable(long id) {
        Row r = load(id);
        if (!"DRAFT".equals(r.status())) throw new ConflictException("Bản nháp đã " + ("APPROVED".equals(r.status())
                ? "duyệt vào kho" : "bị bỏ") + ", không sửa được.");
        if (r.busyOp() != null) throw new ConflictException("Đang có thao tác AI chạy, đợi xong rồi thử lại.");
        return r;
    }

    TextMetrics metrics(Row r, List<SourceRow> srcs) {
        TeilSpec spec = r.spec();
        Text t = r.text().text();
        String body = SituationalTeile.metricsText(spec, t);
        List<String> ws = TextChecks.words(body);
        Set<String> glossaryTerms = (t.glossary() == null ? List.<GlossaryEntry>of() : t.glossary()).stream()
                .map(g -> g.term().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        int target = LEVEL_ORDER.indexOf(spec.cefrLevel());
        Set<String> types = new LinkedHashSet<>();
        for (String w : ws) types.add(w.toLowerCase(Locale.ROOT));
        List<String> above = new ArrayList<>();
        for (String w : types) {
            if (glossaryTerms.contains(w)) continue;
            int lv = wordlist.levelOf(w).map(LEVEL_ORDER::indexOf).orElse(-1);
            if (lv > target) {
                // Dạng quá khứ / phân từ của động từ mạnh ("litten", "traten") nằm trong danh sách tần suất B2/C1
                // dù nguyên mẫu thuộc vốn từ của cấp: tra lại theo nguyên mẫu trước khi tính là từ trên cấp.
                for (String lemma : StrongVerbForms.lemmas(w)) {
                    int byLemma = wordlist.levelOf(lemma).map(LEVEL_ORDER::indexOf).orElse(-1);
                    if (byLemma >= 0 && byLemma <= target) {
                        lv = byLemma;
                        break;
                    }
                }
            }
            if (lv > target) above.add(w);
        }
        double ratio = types.isEmpty() ? 0 : (double) above.size() / types.size();
        Set<Long> hashes = new HashSet<>();
        for (SourceRow s : srcs) hashes.addAll(s.shingles());
        String full = nz(t.titleDe()) + "\n\n" + nz(t.vorspannDe()) + "\n\n" + body;
        TextChecks.Overlap ov = TextChecks.overlap(full, hashes, TeilSpec.OVERLAP_LIMIT);
        Set<String> used = new HashSet<>(r.text().usedFactIds() == null ? List.of() : r.text().usedFactIds());
        List<String> unused = selectedFacts(srcs).stream().map(Fact::id).filter(fid -> !used.contains(fid)).toList();
        return new TextMetrics(ws.size(), List.of(spec.minWords() * spec.textCount(), spec.maxWords() * spec.textCount()), above, ratio,
                spec.maxAboveLevelRatio(), ov.maxRun(), TeilSpec.OVERLAP_LIMIT, ov.snippets(), unused);
    }

    Map<String, Boolean> suggestions(Row r, List<SourceRow> srcs, TextMetrics m) {
        // Mọi nhánh trả Boolean (đối tượng): trộn `null` với boolean nguyên thuỷ trong toán tử ba ngôi làm Java
        // mở hộp null ⇒ NullPointerException ngay khi tạo bản nháp (lỗi CI 10/11/2026).
        Map<String, Boolean> s = new LinkedHashMap<>();
        Map<String, String> light = new HashMap<>();
        for (Check c : r.checks()) light.put(c.key(), c.light());
        boolean verified = !r.checks().isEmpty();
        Boolean level = null;
        if (m != null && verified) level = "GREEN".equals(light.get("LEXICAL")) && "GREEN".equals(light.get("LENGTH"));
        s.put("LEVEL", level);
        Boolean format = null;
        if (verified) format = "GREEN".equals(light.get("FORMAT")) && !"YELLOW".equals(light.get("ANSWERS"));
        s.put("FORMAT", format);
        Boolean single = null;
        if (verified) single = "GREEN".equals(light.get("SOLVER"));
        s.put("SINGLE_ANSWER", single);
        List<SourceRow> used = usedSources(srcs);
        Boolean neutral = null;
        if (light.containsKey("NEUTRAL") && r.spec().situational()) neutral = "GREEN".equals(light.get("NEUTRAL"));
        else if (!used.isEmpty()) neutral = used.stream().noneMatch(x -> "FLAGGED".equals(x.source().neutrality()));
        s.put("NEUTRAL", neutral);
        s.put("FACTS_MATCH", light.containsKey("FAITHFUL") ? "GREEN".equals(light.get("FAITHFUL")) : null);
        Boolean noCopy = null;
        if (m != null) noCopy = m.overlapMaxRun() < m.overlapLimit();
        s.put("NO_COPY", noCopy);
        Boolean quelle = null;
        if (!used.isEmpty()) quelle = used.stream().allMatch(x -> x.source().usageModeConfirmed());
        else if (r.spec().situational()) quelle = Boolean.TRUE;
        s.put("QUELLE", quelle);
        s.put("EXPLANATION", null);
        return s;
    }

    /** Dòng nguồn hiện dưới bài đọc, theo loại dùng của từng nguồn. */
    static String quelle(List<SourceRow> srcs) {
        List<SourceRow> used = usedSources(srcs);
        if (used.isEmpty()) return null;
        List<String> parts = new ArrayList<>();
        boolean adapted = false;
        for (SourceRow sr : used) {
            Source s = sr.source();
            if ("ADAPT".equals(s.usageMode())) {
                adapted = true;
                StringBuilder sb = new StringBuilder("nach ");
                if (s.author() != null) sb.append(s.author()).append(": ");
                sb.append("„").append(firstNonBlank(s.title(), "ohne Titel")).append("“");
                if (s.publisher() != null) sb.append(", ").append(s.publisher());
                if (s.publishedAt() != null) sb.append(" ").append(year(s.publishedAt()));
                if (s.url() != null) sb.append(", ").append(s.url());
                if (s.licenseText() != null) sb.append(" · ").append(s.licenseText());
                parts.add(sb.toString());
            } else {
                StringBuilder sb = new StringBuilder("Daten: ").append(firstNonBlank(s.publisher(), s.title(), "Presse"));
                if (s.publishedAt() != null) sb.append(", ").append(s.publishedAt().length() >= 10
                        ? s.publishedAt().substring(0, 10) : s.publishedAt());
                parts.add(sb.toString());
            }
        }
        String tail = adapted ? "für die Prüfung neu geschrieben und vereinfacht" : "Text für die Prüfung neu geschrieben";
        return (adapted ? "Quelle: " : "") + String.join(" · ", parts) + " · " + tail + ".";
    }

    static List<SourceRow> usedSources(List<SourceRow> srcs) {
        return srcs.stream().filter(s -> s.source().facts().stream().anyMatch(Fact::selected)).toList();
    }

    static List<Fact> selectedFacts(List<SourceRow> srcs) {
        return srcs.stream().flatMap(s -> s.source().facts().stream()).filter(Fact::selected).toList();
    }

    static boolean formatOk(Item i, TeilSpec spec) {
        if (i.question() == null || i.question().isBlank() || i.options() == null) return false;
        if (spec.headlines()) {
            return i.options().size() == 2 && i.options().containsKey(i.correct())
                    && TeilSpec.HEADLINE_LETTERS.containsAll(i.options().keySet())
                    && i.options().values().stream().allMatch(h -> h != null && !h.isBlank());
        }
        return ItemRules.LETTERS.stream().allMatch(l -> i.options().get(l) != null && !i.options().get(l).isBlank())
                && i.options().size() == 3 && ItemRules.LETTERS.contains(i.correct());
    }

    /** Lesen Teil 1: 10 chữ a–j không trùng giữa các văn bản, 10 tiêu đề không trùng chữ. */
    static boolean headlinesOk(List<Item> items) {
        Set<String> letters = new HashSet<>();
        Set<String> texts = new HashSet<>();
        int n = 0;
        for (Item i : items) {
            for (Map.Entry<String, String> e : i.options().entrySet()) {
                n++;
                letters.add(e.getKey());
                texts.add(e.getValue().trim().toLowerCase(Locale.ROOT));
            }
        }
        return letters.size() == n && texts.size() == n;
    }

    /** Đáp án AI trả có khớp câu không: ô form so theo luật chấm form telc, còn lại so chữ. */
    static boolean sameAnswer(TeilSpec spec, Item it, String given) {
        if ("FILL_FORM".equals(spec.teilType())) {
            return com.deutschflow.grammar.service.ExamScoringService.formAnswerMatches(given,
                    SituationalTeile.acceptedAnswers(it));
        }
        return given != null && given.equalsIgnoreCase(it.correct());
    }

    static boolean lettersBalanced(List<String> letters) {
        Map<String, Integer> c = new HashMap<>();
        for (String l : letters) c.merge(l, 1, Integer::sum);
        int max = c.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        if (letters.size() >= 3 && max > Math.ceil(letters.size() * 0.4)) return false;
        for (int i = 2; i < letters.size(); i++) {
            if (letters.get(i).equals(letters.get(i - 1)) && letters.get(i).equals(letters.get(i - 2))) return false;
        }
        return true;
    }

    String contentHash(Text t, List<Item> items) {
        List<Map<String, Object>> core = items.stream().map(i -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.id());
            m.put("q", i.question());
            m.put("o", new TreeMap<>(i.options() == null ? Map.of() : i.options()));
            m.put("c", i.correct());
            m.put("e", i.explanationVi());
            m.put("ev", i.evidence());
            m.put("d", i.difficultyTarget());
            return m;
        }).toList();
        return TextChecks.sha256(json(t) + json(core));
    }

    private Map<String, String> answers(JsonNode node, TeilSpec spec) {
        Map<String, String> out = new HashMap<>();
        node.path("answers").forEach(a -> {
            String v = a.path("answer").isNull() ? null : a.path("answer").asText(null);
            if (v != null) {
                v = v.trim();
                // Ô form (A2 Schreiben 1): câu trả lời là chữ tự do, so bằng luật chấm form.
                if ("FILL_FORM".equals(spec.teilType())) {
                    if (!v.isBlank()) out.put(a.path("id").asText(), v);
                    return;
                }
                v = v.toLowerCase(Locale.ROOT);
                if (!spec.answerLetters().contains(v) && v.length() > 1) v = v.substring(0, 1);
                if (spec.answerLetters().contains(v)) out.put(a.path("id").asText(), v);
            }
        });
        return out;
    }

    private Text sanitizeText(Text t) {
        List<GlossaryEntry> g = t.glossary() == null ? List.of() : t.glossary().stream()
                .filter(e -> e.term() != null && !e.term().isBlank()).toList();
        return new Text(nz(t.titleDe()), nz(t.vorspannDe()), nz(t.context()), g, t.ads(), t.examples(), t.stimulusAd(),
                t.wordBank(), t.stimulus(), t.writingPoints());
    }

    private List<Item> sanitizeItems(List<Item> in, Row r) {
        Set<String> valid = new HashSet<>();
        for (int s = 0; s < r.itemCount(); s++) valid.add(r.spec().itemId(s));
        List<Item> out = new ArrayList<>();
        for (Item i : in) {
            if (!valid.contains(i.id())) throw new BadRequestException("Mã câu không hợp lệ: " + i.id());
            String target = TeilSpec.isLevel(i.difficultyTarget()) ? i.difficultyTarget().toUpperCase(Locale.ROOT) : "MEDIUM";
            out.add(new Item(i.id(), nz(i.question()), i.options() == null ? Map.of() : i.options(), i.correct(),
                    nz(i.explanationVi()), nz(i.evidence()), i.traps() == null ? List.of() : i.traps(), target,
                    i.difficultyMeasured(), i.locked(), null, List.of(), i.meta()));
        }
        return out;
    }

    private static Map<String, Integer> validatePlan(Map<String, Integer> plan, String mode, TeilSpec spec) {
        if (spec.writing()) return normalizedPlan(Map.of());
        Map<String, Integer> p = normalizedPlan(plan);
        int sum = p.values().stream().mapToInt(Integer::intValue).sum();
        if ("EXAM".equals(mode) && sum != spec.itemCount()) {
            throw new BadRequestException("Chế độ Đề thi thử cần đúng " + spec.itemCount() + " câu (đang " + sum + ").");
        }
        if (sum < 1 || sum > 10) throw new BadRequestException("Số câu phải từ 1 đến 10.");
        return p;
    }

    private static String normalizeMode(String m) {
        return "PRACTICE".equalsIgnoreCase(m) ? "PRACTICE" : "EXAM";
    }

    private static String fmtPlan(Map<String, Integer> p) {
        return p.get("EASY") + "-" + p.get("MEDIUM") + "-" + p.get("HARD") + "-" + p.get("EXPERT");
    }

    private static String norm(String s) {
        return s == null ? "" : s.replaceAll("[\\s*]+", " ").trim().toLowerCase(Locale.ROOT)
                .replaceAll("[„“”\"]", "\"");
    }

    static String text(JsonNode n, String field) {
        if (n == null || !n.hasNonNull(field)) return null;
        String v = n.path(field).asText("").trim();
        return v.isEmpty() || v.equalsIgnoreCase("null") ? null : v;
    }

    static String firstNonBlank(String... vs) {
        for (String v : vs) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }

    private static String year(String date) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(19|20)\\d\\d").matcher(date);
        return m.find() ? m.group() : date;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String cut(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }
}
