package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examstudio.ExamSetPlanner.Slot;
import com.deutschflow.examstudio.ExamSetPlanner.Theme;
import com.deutschflow.examstudio.ExamStudioDtos.Check;
import com.deutschflow.examstudio.ExamStudioDtos.CreateDraftRequest;
import com.deutschflow.examstudio.ExamStudioDtos.Draft;
import com.deutschflow.examstudio.ExamStudioDtos.Fact;
import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.PatchSourceRequest;
import com.deutschflow.examstudio.ExamStudioDtos.Source;
import com.deutschflow.examstudio.ExamStudioDtos.WriteTextRequest;
import com.deutschflow.examstudio.SourceCatalogService.ArticleView;
import com.deutschflow.notification.service.UserNotificationService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Bộ điều phối "Tạo bộ đề tự động". Một lượt chạy gồm mọi Teil mà Xưởng đề làm được của một kỳ thi + cấp; mỗi
 * Teil là một bản nháp {@code exam_drafts}. Bộ điều phối KHÔNG sinh nội dung: nó gọi đúng các hàm mà nút bấm của
 * trình 5 bước gọi ({@link ExamDraftService}), mỗi hàm xếp một job nền và đặt {@code busy_op}. Mỗi nhịp
 * ({@link #tickAll}) xem bản nháp nào đã rảnh thì đẩy sang bước kế:
 *
 * <pre>NEW → SOURCING (Teil lấy từ nguồn) → TEXT → ITEMS → VERIFY → READY
 *                                              ↑__ vòng sửa (tối đa 2) __|  → đổi chủ đề làm lại 1 lần → STUCK</pre>
 *
 * Owner chốt 12/11/2026: Teil còn đỏ sau 2 vòng tự sửa thì đổi chủ đề / nguồn làm lại MỘT lần; vẫn đỏ thì Teil
 * kẹt và lượt chuyển "Cần owner xem", các Teil khác vẫn chạy cho xong. Máy không hạ ngưỡng đèn để qua.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamSetRunService {

    static final int MAX_REPAIR_ROUNDS = 2;
    static final int MAX_THEME_TRIES = 1;        // số lần ĐỔI chủ đề (owner chốt: 1)
    static final int MAX_SOURCE_TRIES = 6;       // số bài hỏng tối đa cho một Teil trước khi coi là kẹt nguồn
    static final int MAX_STAGE_ERRORS = 2;       // job của một bước lỗi liên tiếp bấy nhiêu lần ⇒ hỏng vòng
    static final int MAX_BUSY_DRAFTS = 3;        // số bản nháp của một lượt được chạy AI cùng lúc
    static final Duration BUSY_TIMEOUT = Duration.ofMinutes(25);
    static final Duration FEED_FRESH = Duration.ofHours(6);

    /** Đèn đỏ cấp Teil thuộc về câu hỏi (sửa bằng sinh lại câu); mọi đèn đỏ cấp Teil khác ⇒ viết lại bài. */
    private static final Set<String> ITEM_LEVEL_CHECKS = Set.of("SOLVER", "ANSWERS", "MATRIX", "ORDER");

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ExamDraftService drafts;
    private final SourceCatalogService catalog;
    private final ExamStudioAi ai;
    private final UserNotificationService notifications;
    private final ExamAssemblyService assembly;

    public record CreateRunRequest(String examFormat, String cefrLevel, String profile, String channel) {}

    public record TeilView(String section, int teil, String status, String stage, String theme, Long draftId,
                           int repairRound, int themeTry, String lastError) {}

    public record RunView(long id, String examFormat, String cefrLevel, String status, String channel,
                          String profile, String note, String createdAt, String updatedAt, List<TeilView> teile) {}

    private record RunRow(long id, String examFormat, String cefrLevel, String status, String channel,
                          String profile, long createdBy) {}

    private record TeilRow(long id, long runId, String section, int teil, Long draftId, String status, String stage,
                           String theme, int themeTry, int repairRound, int errors, int sourceTries,
                           Long pendingArticleId, List<String> repairQueue, Instant updatedAt) {}

    // ── Tạo lượt, xem lượt ───────────────────────────────────────────────────────────────────────────────

    public RunView create(CreateRunRequest req, long userId) {
        List<TeilSpec> specs = TeilSpec.forExam(req.examFormat(), req.cefrLevel());
        if (specs.isEmpty()) {
            throw new BadRequestException("Chưa có khuôn Teil nào cho kỳ thi và cấp này trong Xưởng đề.");
        }
        String profile = req.profile() == null || req.profile().isBlank() ? "REAL" : req.profile().trim().toUpperCase();
        if (!profile.equals("REAL") && !profile.equals("SPRINT")) {
            throw new BadRequestException("Hồ sơ độ khó không hợp lệ (REAL hoặc SPRINT).");
        }
        String channel = ai.requireChannel(req.channel()).name();
        Integer running = jdbc.queryForObject(
                "SELECT count(*) FROM exam_set_runs WHERE status IN ('PLANNING', 'RUNNING')", Integer.class);
        if (running != null && running > 0) {
            throw new BadRequestException("Đang có một lượt tạo bộ đề chạy. Đợi lượt đó xong rồi bấm lại.");
        }
        TeilSpec first = specs.get(0);
        Long id = jdbc.queryForObject("""
                INSERT INTO exam_set_runs (exam_format, cefr_level, status, channel, profile, created_by)
                VALUES (?, ?, 'PLANNING', ?, ?, ?) RETURNING id
                """, Long.class, first.examFormat(), first.cefrLevel(), channel, profile, userId);
        for (TeilSpec s : specs) {
            jdbc.update("INSERT INTO exam_set_run_teile (run_id, section, teil) VALUES (?, ?, ?)", id, s.section(), s.teil());
        }
        return get(id);
    }

    public List<RunView> list() {
        return jdbc.queryForList("SELECT id FROM exam_set_runs ORDER BY created_at DESC LIMIT 50", Long.class)
                .stream().map(this::get).toList();
    }

    public RunView get(long id) {
        List<TeilView> teile = teile(id).stream().map(t -> new TeilView(t.section(), t.teil(), t.status(), t.stage(),
                t.theme(), t.draftId(), t.repairRound(), t.themeTry(), lastError(t.id()))).toList();
        return jdbc.query("SELECT * FROM exam_set_runs WHERE id = ?", (rs, i) -> new RunView(rs.getLong("id"),
                        rs.getString("exam_format"), rs.getString("cefr_level"), rs.getString("status"),
                        rs.getString("channel"), rs.getString("profile"), rs.getString("note"),
                        iso(rs.getTimestamp("created_at")), iso(rs.getTimestamp("updated_at")), teile), id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không có lượt tạo bộ đề #" + id + "."));
    }

    /** Bỏ cả lượt: các bản nháp chưa duyệt của nó bị bỏ theo. Bài báo đã dùng KHÔNG được trả lại sổ. */
    public RunView discard(long id) {
        RunRow run = run(id);
        if (run.status().equals("APPROVED")) throw new BadRequestException("Lượt đã duyệt không bỏ được.");
        for (TeilRow t : teile(id)) discardDraftQuietly(t.draftId());
        jdbc.update("UPDATE exam_set_runs SET status = 'DISCARDED', finished_at = now(), updated_at = now() WHERE id = ?", id);
        return get(id);
    }

    // ── Duyệt cả bộ ──────────────────────────────────────────────────────────────────────────────────────

    public record ApproveRunRequest(String title, Long baseExamId) {}

    /**
     * Owner duyệt cả bộ bằng MỘT lần bấm (thay cho 8 mục tích của từng Teil): mọi bản nháp của lượt vào kho Teil,
     * rồi ghép thành một bộ đề "Sắp có" trên một đề nền viết tay — các Teil lượt chưa làm được (hiện là phần Nghe)
     * lấy nguyên từ đề nền. Phát hành cho học viên vẫn là bước riêng ở danh sách bộ đề. Hỏng ở Teil nào thì cả lượt
     * duyệt được hoàn lại, không có trạng thái duyệt dở.
     */
    @org.springframework.transaction.annotation.Transactional
    public RunView approve(long id, ApproveRunRequest req, long userId) {
        RunRow run = run(id);
        if (!run.status().equals("REVIEW")) {
            throw new BadRequestException("Chỉ duyệt được lượt đã chạy xong mọi Teil (trạng thái \"Sẵn sàng duyệt\").");
        }
        List<ExamAssemblyService.BaseExam> bases = assembly.bases(run.examFormat(), run.cefrLevel());
        ExamAssemblyService.BaseExam base = req != null && req.baseExamId() != null
                ? bases.stream().filter(b -> b.id() == req.baseExamId()).findFirst()
                        .orElseThrow(() -> new BadRequestException("Đề nền không hợp lệ cho kỳ thi và cấp này."))
                : bases.stream().filter(ExamAssemblyService.BaseExam::reviewed).findFirst()
                        .orElseThrow(() -> new BadRequestException(
                                "Chưa có đề viết tay đang chạy nào của kỳ thi này để làm nền cho các phần lượt chưa tạo được."));
        Map<String, Boolean> checklist = new LinkedHashMap<>();
        for (String k : TeilSpec.CHECKLIST_KEYS) checklist.put(k, true);
        List<ExamAssemblyService.Replacement> reps = new ArrayList<>();
        for (TeilRow t : teile(id)) {
            if (t.draftId() == null) throw new BadRequestException("Teil " + t.section() + " " + t.teil() + " chưa có bản nháp.");
            Draft approved = drafts.approve(t.draftId(), checklist, userId);
            if (approved.blockId() == null) {
                throw new IllegalStateException("Duyệt bản nháp #" + t.draftId() + " không trả mã Teil kho.");
            }
            reps.add(new ExamAssemblyService.Replacement(t.section(), t.teil(), approved.blockId()));
        }
        String title = req != null && req.title() != null && !req.title().isBlank() ? req.title().trim()
                : run.examFormat().toLowerCase() + " Deutsch " + run.cefrLevel() + " — Bộ tự tạo #" + id;
        ExamAssemblyService.Assembled exam = assembly.assemble(new ExamAssemblyService.AssembleRequest(base.id(), title, reps));
        jdbc.update("""
                UPDATE exam_set_runs SET status = 'APPROVED', mock_exam_id = ?, note = ?, updated_at = now() WHERE id = ?
                """, exam.id(), "Đề nền: " + base.title(), id);
        return get(id);
    }

    // ── Nhịp điều phối ───────────────────────────────────────────────────────────────────────────────────

    /** Đẩy mọi lượt đang chạy thêm một bước. Lỗi của một lượt không chặn lượt khác. */
    public void tickAll() {
        List<Long> ids = jdbc.queryForList(
                "SELECT id FROM exam_set_runs WHERE status IN ('PLANNING', 'RUNNING') ORDER BY id", Long.class);
        for (Long id : ids) {
            try {
                tick(id);
            } catch (RuntimeException e) {
                log.error("[ExamSet] lượt #{} lỗi ở nhịp điều phối: {}", id, e.getMessage(), e);
            }
        }
    }

    void tick(long runId) {
        RunRow run = run(runId);
        if (run.status().equals("PLANNING")) {
            plan(run);
            return;
        }
        if (!run.status().equals("RUNNING")) return;
        ExamStudioAi.useChannel(ExamStudioAi.Channel.of(run.channel()));
        try {
            List<TeilRow> rows = teile(runId);
            int busy = 0;
            Map<Long, Draft> loaded = new HashMap<>();
            for (TeilRow t : rows) {
                if (t.draftId() == null || t.status().equals("READY") || t.status().equals("STUCK")) continue;
                Draft d = drafts.get(t.draftId());
                loaded.put(t.id(), d);
                if (d.busyOp() != null) busy++;
            }
            for (TeilRow t : rows) {
                if (t.status().equals("READY") || t.status().equals("STUCK")) continue;
                Draft d = loaded.get(t.id());
                if (d != null && d.busyOp() != null) {
                    expireIfHung(t, d);
                    continue;
                }
                if (busy >= MAX_BUSY_DRAFTS) continue;
                try {
                    if (advance(run, t, d)) busy++;
                } catch (BadRequestException | com.deutschflow.common.exception.ConflictException e) {
                    // Hàm của trình 5 bước từ chối (bài quá ngắn, bản nháp vừa bận…): tính là một lần lỗi của bước.
                    stageFailed(run, reload(t.id()), e.getMessage());
                }
            }
            finishIfDone(run);
        } finally {
            ExamStudioAi.clearChannel();
        }
    }

    // ── Lập kế hoạch: làm mới sổ bài, gán chủ đề ─────────────────────────────────────────────────────────

    private void plan(RunRow run) {
        refreshFeeds();
        List<TeilRow> rows = teile(run.id());
        Map<String, String> themes = assignThemes(run, rows, Set.of());
        Map<String, Object> plan = new LinkedHashMap<>();
        for (TeilRow t : rows) {
            String theme = themes.get(t.section() + "#" + t.teil());
            if (theme == null) {
                setTeil(t.id(), "STUCK", "NEW", "Không còn chủ đề nào có đủ bài trong sổ nguồn cho Teil này.");
            } else {
                jdbc.update("UPDATE exam_set_run_teile SET theme = ?, status = 'RUNNING', updated_at = now() WHERE id = ?",
                        theme, t.id());
            }
            plan.put(t.section() + "#" + t.teil(), theme);
        }
        jdbc.update("UPDATE exam_set_runs SET status = 'RUNNING', plan_json = ?::jsonb, updated_at = now() WHERE id = ?",
                json(Map.of("themes", plan)), run.id());
    }

    /** Đọc lại feed của các nguồn được tải bài nếu lần đọc trước đã cũ. Nguồn lỗi thì bỏ qua, không chặn lượt. */
    private void refreshFeeds() {
        for (SourceCatalogService.FeedView f : catalog.feeds()) {
            if (!f.active() || f.listingKind().equals("NONE") || f.usageClass().equals(SourceCatalogService.TOPIC_ONLY)) continue;
            boolean stale = f.lastPolledAt() == null
                    || Duration.between(Instant.parse(f.lastPolledAt()), Instant.now()).compareTo(FEED_FRESH) > 0;
            // Sitemap chỉ đọc lần đầu: vài nghìn địa chỉ, đổi rất chậm.
            if (!stale || (f.listingKind().equals("SITEMAP") && f.seen() > 0)) continue;
            try {
                catalog.poll(f.id());
            } catch (RuntimeException e) {
                log.warn("[ExamSet] không đọc được danh sách bài của {}: {}", f.code(), e.getMessage());
            }
        }
    }

    private Map<String, String> assignThemes(RunRow run, List<TeilRow> rows, Set<String> banned) {
        List<Slot> slots = new ArrayList<>();
        Map<String, Map<String, Integer>> usage = new HashMap<>();
        for (TeilRow t : rows) {
            TeilSpec spec = spec(run, t);
            slots.add(new Slot(t.section(), t.teil(), sourcesNeeded(spec)));
            Map<String, Integer> used = new HashMap<>();
            jdbc.query("""
                    SELECT theme, count(*) AS n FROM (
                        SELECT theme FROM exam_teil_blocks
                         WHERE exam_format = ? AND cefr_level = ? AND section = ? AND teil = ? AND status = 'APPROVED'
                        UNION ALL
                        SELECT theme FROM exam_drafts
                         WHERE exam_format = ? AND cefr_level = ? AND section = ? AND teil = ? AND status = 'DRAFT'
                    ) x WHERE theme IS NOT NULL GROUP BY theme
                    """, rs -> {
                used.put(rs.getString("theme"), rs.getInt("n"));
            }, run.examFormat(), run.cefrLevel(), t.section(), t.teil(), run.examFormat(), run.cefrLevel(),
                    t.section(), t.teil());
            usage.put(t.section() + "#" + t.teil(), used);
        }
        Map<String, Integer> avail = new HashMap<>();
        return ExamSetPlanner.assign(slots, usage,
                th -> avail.computeIfAbsent(th.name(), k -> catalog.candidates(th.stems(), 12).size()), banned, run.id());
    }

    // ── Đẩy một Teil thêm một bước. Trả true nếu vừa xếp một job AI (bản nháp bận) ───────────────────────

    private boolean advance(RunRow run, TeilRow t, Draft d) {
        TeilSpec spec = spec(run, t);
        long user = run.createdBy();
        if (d == null) {
            Draft created = drafts.create(new CreateDraftRequest(run.examFormat(), run.cefrLevel(), t.section(), t.teil(),
                    t.theme(), "EXAM", ExamSetPlanner.difficultyPlan(run.profile(), spec.itemCount())), user);
            jdbc.update("""
                    UPDATE exam_set_run_teile SET draft_id = ?, stage = ?, errors = 0, updated_at = now() WHERE id = ?
                    """, created.id(), sourcesNeeded(spec) > 0 ? "SOURCING" : "TEXT_PENDING", t.id());
            return false;
        }
        if (d.lastError() != null && !d.lastError().isBlank() && !t.stage().equals("SOURCING")) {
            stageFailed(run, t, d.lastError());
            return false;
        }
        return switch (t.stage()) {
            case "SOURCING" -> sourcing(run, t, d, spec);
            case "TEXT_PENDING" -> {
                drafts.writeText(d.id(), new WriteTextRequest(null, null, null), user);
                stage(t.id(), "TEXT");
                yield true;
            }
            case "TEXT" -> {
                if (spec.writing()) {
                    drafts.verify(d.id(), user);
                    stage(t.id(), "VERIFY");
                } else {
                    drafts.generateItems(d.id(), user);
                    stage(t.id(), "ITEMS");
                }
                yield true;
            }
            case "ITEMS" -> {
                drafts.verify(d.id(), user);
                stage(t.id(), "VERIFY");
                yield true;
            }
            case "REPAIR_ITEMS" -> {
                List<String> queue = new ArrayList<>(t.repairQueue());
                if (queue.isEmpty()) {
                    drafts.verify(d.id(), user);
                    stage(t.id(), "VERIFY");
                } else {
                    String itemId = queue.remove(0);
                    jdbc.update("UPDATE exam_set_run_teile SET repair_queue = ?::jsonb, updated_at = now() WHERE id = ?",
                            json(queue), t.id());
                    drafts.regenerateItem(d.id(), itemId, null, user);
                }
                yield true;
            }
            case "VERIFY" -> afterVerify(run, t, d, spec);
            default -> false;
        };
    }

    /** Thêm nguồn cho tới khi đủ; bài hỏng thì loại và lấy bài khác. Đủ rồi thì tích dữ kiện, xác nhận loại dùng. */
    private boolean sourcing(RunRow run, TeilRow t, Draft d, TeilSpec spec) {
        long user = run.createdBy();
        // 1) Kết quả của bài vừa thử.
        if (t.pendingArticleId() != null) {
            boolean failed = d.lastError() != null && !d.lastError().isBlank();
            // Chỉ loại bài khi lỗi là của BÀI (không tải được, quá ngắn). Model không trả lời thì bài không có lỗi:
            // trả bài về sổ, và tính là lỗi của bước để không đốt hết sổ nguồn khi kênh AI trục trặc (lượt #3, 12/11).
            boolean modelError = failed && isModelError(d.lastError());
            if (modelError) {
                catalog.release(t.pendingArticleId());
                jdbc.update("UPDATE exam_set_run_teile SET pending_article_id = NULL WHERE id = ?", t.id());
                stageFailed(run, reload(t.id()), d.lastError());
                return false;
            }
            if (failed) catalog.reject(t.pendingArticleId(), d.lastError());
            jdbc.update("""
                    UPDATE exam_set_run_teile SET pending_article_id = NULL, source_tries = source_tries + ?,
                           last_error = ?, updated_at = now() WHERE id = ?
                    """, failed ? 1 : 0, failed ? d.lastError() : null, t.id());
            t = reload(t.id());
        }
        // 2) Nguồn bị cờ chủ đề nhạy cảm hoặc không rút được dữ kiện: gỡ khỏi bản nháp.
        for (Source s : d.sources()) {
            if ("FLAGGED".equals(s.neutrality()) || s.facts().isEmpty()) {
                drafts.removeSource(d.id(), s.id());
                jdbc.update("UPDATE exam_set_run_teile SET source_tries = source_tries + 1, updated_at = now() WHERE id = ?", t.id());
                return false; // nhịp sau tính lại
            }
        }
        int need = sourcesNeeded(spec);
        if (d.sources().size() < need) {
            if (t.sourceTries() >= MAX_SOURCE_TRIES) {
                roundFailed(run, t, "Không tìm được đủ bài dùng được cho chủ đề „" + t.theme() + "“.", true);
                return false;
            }
            Theme theme = ExamSetPlanner.theme(t.theme());
            ArticleView pick = pickArticle(theme, d);
            if (pick == null || !catalog.markUsed(pick.id(), d.id())) {
                if (pick == null) roundFailed(run, t, "Sổ nguồn hết bài cho chủ đề „" + t.theme() + "“.", true);
                return false;
            }
            jdbc.update("UPDATE exam_set_run_teile SET pending_article_id = ?, updated_at = now() WHERE id = ?", pick.id(), t.id());
            drafts.addSource(d.id(), new ExamStudioDtos.AddSourceRequest(pick.url(), null, null, pick.publisher()), user);
            return true;
        }
        // 3) Đủ nguồn: tích mọi dữ kiện, xác nhận loại dùng theo hạng của nơi đăng (owner đã duyệt danh mục).
        for (Source s : d.sources()) {
            // Hạng của nơi đăng là trần. Trang không ghi dòng giấy phép riêng (vd. Destatis: điều khoản chung của cả
            // trang) thì theo hạng nơi đăng; trang tự ghi một giấy phép không phải CC BY trơn thì hạ xuống chỉ dữ kiện.
            boolean adaptClass = SourceCatalogService.ADAPT.equals(catalog.usageClassOf(s.url()));
            boolean pageSilent = s.licenseText() == null || s.licenseText().isBlank();
            String mode = adaptClass && (pageSilent || "ADAPT".equals(s.usageMode())) ? "ADAPT" : "FACTS_ONLY";
            drafts.patchSource(d.id(), s.id(), new PatchSourceRequest(mode, s.facts().stream().map(Fact::id).toList()));
        }
        stage(t.id(), "TEXT_PENDING");
        return false;
    }

    /** Bài hợp chủ đề, chưa có trong bản nháp; ưu tiên nơi đăng mà bản nháp chưa dùng (Lesen 1 cần đa dạng). */
    private ArticleView pickArticle(Theme theme, Draft d) {
        if (theme == null) return null;
        Set<String> usedPublishers = new HashSet<>();
        for (Source s : d.sources()) if (s.publisher() != null) usedPublishers.add(s.publisher());
        List<ArticleView> cands = catalog.candidates(theme.stems(), 40);
        return cands.stream().filter(a -> !usedPublishers.contains(a.publisher())).findFirst()
                .orElse(cands.isEmpty() ? null : cands.get(0));
    }

    /** Sau tự kiểm: không đỏ ⇒ xong; có đỏ ⇒ vòng sửa; hết vòng ⇒ đổi chủ đề một lần; rồi mới kẹt. */
    private boolean afterVerify(RunRow run, TeilRow t, Draft d, TeilSpec spec) {
        List<Check> redChecks = d.checks().stream().filter(c -> "RED".equals(c.light())).toList();
        List<String> redItems = d.items().stream().filter(i -> "RED".equals(i.light())).map(Item::id).toList();
        if (redChecks.isEmpty() && redItems.isEmpty()) {
            log.info("[ExamSet] lượt #{} {} {}: xong (vòng sửa {}, đổi chủ đề {})", run.id(), t.section(), t.teil(),
                    t.repairRound(), t.themeTry());
            setTeil(t.id(), "READY", "DONE", null);
            return false;
        }
        String why = describe(redChecks, redItems);
        log.info("[ExamSet] lượt #{} {} {}: còn đỏ sau tự kiểm (vòng sửa {}): {}", run.id(), t.section(), t.teil(),
                t.repairRound(), why);
        boolean duplicate = redChecks.stream().anyMatch(c -> "DUPLICATE".equals(c.key()));
        if (duplicate || t.repairRound() >= MAX_REPAIR_ROUNDS) {
            roundFailed(run, t, why, false);
            return false;
        }
        long user = run.createdBy();
        boolean rewrite = redChecks.stream().anyMatch(c -> !ITEM_LEVEL_CHECKS.contains(c.key()));
        if (rewrite || spec.writing()) {
            jdbc.update("""
                    UPDATE exam_set_run_teile SET repair_round = repair_round + 1, stage = 'TEXT', last_error = ?,
                           updated_at = now() WHERE id = ?
                    """, why, t.id());
            // Đèn "trùng nguồn": nêu đúng các cụm bị chép để lần viết lại tránh được (lượt thật 12/11: viết lại hai
            // lần vẫn dính vì lời dặn chỉ nói chung chung).
            String copied = d.textMetrics() == null || d.textMetrics().overlapSnippets() == null
                    || d.textMetrics().overlapSnippets().isEmpty() ? ""
                    : " Diese Wortfolgen stehen wörtlich in der Quelle und müssen anders formuliert werden: "
                    + String.join(" | ", d.textMetrics().overlapSnippets().stream().limit(6).toList()) + ".";
            drafts.writeText(d.id(), new WriteTextRequest(null, null,
                    cut("Vorherige Fassung hatte Mängel: " + why + copied, 900)), user);
            return true;
        }
        List<String> queue = redItems.isEmpty() ? d.items().stream().filter(i -> !i.locked()).map(Item::id).toList() : redItems;
        jdbc.update("""
                UPDATE exam_set_run_teile SET repair_round = repair_round + 1, stage = 'REPAIR_ITEMS', last_error = ?,
                       repair_queue = ?::jsonb, updated_at = now() WHERE id = ?
                """, why, json(queue), t.id());
        return false;
    }

    private static String describe(List<Check> redChecks, List<String> redItems) {
        List<String> parts = new ArrayList<>();
        for (Check c : redChecks) parts.add(c.label() + (c.detail() == null ? "" : " (" + cut(c.detail(), 160) + ")"));
        if (!redItems.isEmpty()) parts.add("Câu đỏ: " + String.join(", ", redItems));
        return cut(String.join("; ", parts), 900);
    }

    // ── Hỏng một bước / hỏng một vòng ────────────────────────────────────────────────────────────────────

    /** Job của bước hiện tại báo lỗi: thử lại bước đó; lỗi liên tiếp quá ngưỡng ⇒ coi như hỏng vòng. */
    private void stageFailed(RunRow run, TeilRow t, String error) {
        log.info("[ExamSet] lượt #{} {} {}: bước {} lỗi (lần {}): {}", run.id(), t.section(), t.teil(), t.stage(),
                t.errors() + 1, error);
        if (t.draftId() != null) drafts.finishBusy(t.draftId(), null); // xoá last_error để nhịp sau không tính lại
        if (t.errors() + 1 > MAX_STAGE_ERRORS) {
            roundFailed(run, t, error, false);
            return;
        }
        // Lùi về bước "chờ" tương ứng để nhịp sau gọi lại.
        String back = switch (t.stage()) {
            case "TEXT" -> "TEXT_PENDING";
            case "ITEMS" -> "TEXT";
            case "VERIFY", "REPAIR_ITEMS" -> "ITEMS";
            default -> t.stage();
        };
        jdbc.update("""
                UPDATE exam_set_run_teile SET errors = errors + 1, stage = ?, last_error = ?, updated_at = now() WHERE id = ?
                """, back, cut(error, 900), t.id());
    }

    /**
     * Teil không qua được ở chủ đề hiện tại. Còn lượt đổi chủ đề ⇒ bỏ bản nháp, chọn chủ đề khác, làm lại từ đầu.
     * Hết ⇒ Teil kẹt (bản nháp giữ lại để owner mở xem và sửa tay).
     */
    private void roundFailed(RunRow run, TeilRow t, String why, boolean sourceProblem) {
        log.info("[ExamSet] lượt #{} {} {}: hỏng vòng ở chủ đề „{}“ (đã đổi chủ đề {} lần): {}", run.id(), t.section(),
                t.teil(), t.theme(), t.themeTry(), why);
        if (t.themeTry() >= MAX_THEME_TRIES) {
            setTeil(t.id(), "STUCK", t.stage(), cut(why, 900));
            return;
        }
        Set<String> banned = new HashSet<>();
        for (TeilRow other : teile(run.id())) if (other.theme() != null) banned.add(other.theme());
        Map<String, String> next = assignThemes(run, List.of(t), banned);
        String theme = next.get(t.section() + "#" + t.teil());
        if (theme == null) {
            setTeil(t.id(), "STUCK", t.stage(), cut(why + " Không còn chủ đề thay thế có đủ bài.", 900));
            return;
        }
        discardDraftQuietly(t.draftId());
        jdbc.update("""
                UPDATE exam_set_run_teile SET draft_id = NULL, stage = 'NEW', theme = ?, theme_try = theme_try + 1,
                       repair_round = 0, errors = 0, source_tries = 0, pending_article_id = NULL,
                       repair_queue = '[]'::jsonb, last_error = ?, updated_at = now() WHERE id = ?
                """, theme, cut((sourceProblem ? "Đổi chủ đề vì thiếu nguồn: " : "Đổi chủ đề sau khi tự sửa không qua: ") + why, 900),
                t.id());
    }

    private void expireIfHung(TeilRow t, Draft d) {
        if (d.updatedAt() != null && Duration.between(d.updatedAt(), Instant.now()).compareTo(BUSY_TIMEOUT) > 0) {
            log.warn("[ExamSet] bản nháp #{} bận quá {} phút ở bước {} — coi là hỏng", d.id(), BUSY_TIMEOUT.toMinutes(), d.busyOp());
            drafts.finishBusy(d.id(), "Thao tác " + d.busyOp() + " chạy quá " + BUSY_TIMEOUT.toMinutes() + " phút.");
        }
    }

    private void finishIfDone(RunRow run) {
        List<TeilRow> rows = teile(run.id());
        if (rows.stream().anyMatch(t -> !t.status().equals("READY") && !t.status().equals("STUCK"))) return;
        long stuck = rows.stream().filter(t -> t.status().equals("STUCK")).count();
        String status = stuck == 0 ? "REVIEW" : "NEEDS_ATTENTION";
        if (jdbc.update("""
                UPDATE exam_set_runs SET status = ?, finished_at = now(), updated_at = now() WHERE id = ? AND status = 'RUNNING'
                """, status, run.id()) == 0) return;
        String name = run.examFormat().toLowerCase() + " " + run.cefrLevel();
        try {
            notifications.onSystemAlert("EXAM_STUDIO_SET",
                    stuck == 0 ? "Bộ đề " + name + " sẵn sàng duyệt" : "Bộ đề " + name + " cần bạn xem",
                    stuck == 0 ? "Lượt tạo bộ đề #" + run.id() + " đã chạy xong " + rows.size() + " Teil."
                            : "Lượt tạo bộ đề #" + run.id() + ": " + stuck + "/" + rows.size() + " Teil kẹt sau khi máy tự sửa.",
                    Map.of("runId", run.id(), "url", "/v2/admin/exam-studio?tab=sets&run=" + run.id()));
        } catch (RuntimeException e) {
            log.warn("[ExamSet] không gửi được thông báo cho lượt #{}: {}", run.id(), e.getMessage());
        }
    }

    // ── Phụ ──────────────────────────────────────────────────────────────────────────────────────────────

    /** Lời báo của {@link ExamStudioAi} khi model / kênh AI hỏng, khác lời báo của máy tải bài. */
    static boolean isModelError(String error) {
        return error != null && (error.startsWith("Model soạn đề") || error.startsWith("AI không trả về")
                || error.startsWith("AI trả") || error.contains("Yêu cầu AI"));
    }

    static int sourcesNeeded(TeilSpec spec) {
        return spec.situational() ? 0 : Math.max(spec.textCount(), 1);
    }

    private TeilSpec spec(RunRow run, TeilRow t) {
        return TeilSpec.find(run.examFormat(), run.cefrLevel(), t.section(), t.teil())
                .orElseThrow(() -> new IllegalStateException("Không còn khuôn Teil " + t.section() + " " + t.teil()));
    }

    private void discardDraftQuietly(Long draftId) {
        if (draftId == null) return;
        try {
            drafts.finishBusy(draftId, null);
            drafts.discard(draftId);
        } catch (RuntimeException e) {
            log.warn("[ExamSet] không bỏ được bản nháp #{}: {}", draftId, e.getMessage());
        }
    }

    private void stage(long teilRowId, String stage) {
        jdbc.update("UPDATE exam_set_run_teile SET stage = ?, updated_at = now() WHERE id = ?", stage, teilRowId);
    }

    private void setTeil(long teilRowId, String status, String stage, String error) {
        jdbc.update("UPDATE exam_set_run_teile SET status = ?, stage = ?, last_error = ?, updated_at = now() WHERE id = ?",
                status, stage, error, teilRowId);
    }

    private String lastError(long teilRowId) {
        return jdbc.queryForObject("SELECT last_error FROM exam_set_run_teile WHERE id = ?", String.class, teilRowId);
    }

    private RunRow run(long id) {
        return jdbc.query("SELECT * FROM exam_set_runs WHERE id = ?", (rs, i) -> new RunRow(rs.getLong("id"),
                        rs.getString("exam_format"), rs.getString("cefr_level"), rs.getString("status"),
                        rs.getString("channel"), rs.getString("profile"), rs.getLong("created_by")), id)
                .stream().findFirst().orElseThrow(() -> new NotFoundException("Không có lượt tạo bộ đề #" + id + "."));
    }

    private TeilRow reload(long teilRowId) {
        return jdbc.query("SELECT * FROM exam_set_run_teile WHERE id = ?", this::mapTeil, teilRowId).get(0);
    }

    private List<TeilRow> teile(long runId) {
        return jdbc.query("SELECT * FROM exam_set_run_teile WHERE run_id = ? ORDER BY id", this::mapTeil, runId);
    }

    private TeilRow mapTeil(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        List<String> queue;
        try {
            queue = mapper.readValue(rs.getString("repair_queue"), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            queue = List.of();
        }
        long draft = rs.getLong("draft_id");
        Long draftId = rs.wasNull() ? null : draft;
        long art = rs.getLong("pending_article_id");
        Long artId = rs.wasNull() ? null : art;
        return new TeilRow(rs.getLong("id"), rs.getLong("run_id"), rs.getString("section"), rs.getInt("teil"), draftId,
                rs.getString("status"), rs.getString("stage"), rs.getString("theme"), rs.getInt("theme_try"),
                rs.getInt("repair_round"), rs.getInt("errors"), rs.getInt("source_tries"), artId, queue,
                rs.getTimestamp("updated_at").toInstant());
    }

    private String json(Object o) {
        try {
            return mapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static String iso(Timestamp t) {
        return t == null ? null : t.toInstant().toString();
    }
}
