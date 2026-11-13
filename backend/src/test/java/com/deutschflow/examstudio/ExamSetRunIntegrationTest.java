package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.examstudio.ExamSetRunService.CreateRunRequest;
import com.deutschflow.examstudio.ExamSetRunService.RunView;
import com.deutschflow.examstudio.ExamSetRunService.TeilView;
import com.deutschflow.examstudio.ExamStudioDtos.AddSourceRequest;
import com.deutschflow.examstudio.ExamStudioDtos.Check;
import com.deutschflow.examstudio.ExamStudioDtos.CreateDraftRequest;
import com.deutschflow.examstudio.ExamStudioDtos.Draft;
import com.deutschflow.examstudio.ExamStudioDtos.Fact;
import com.deutschflow.examstudio.ExamStudioDtos.Item;
import com.deutschflow.examstudio.ExamStudioDtos.Source;
import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ điều phối trên Postgres thật (V382), với trình 5 bước được thay bằng một bản giả ghi nhớ trạng thái: mỗi lời
 * gọi "AI" xong ngay. Test kiểm đúng thứ tự bước, sổ bài dùng một lần, vòng tự sửa, đổi chủ đề một lần và Teil kẹt.
 */
@SpringBootTest
@Transactional
@TestPropertySource(properties = {"app.ai-jobs.scheduled-enabled=false", "app.exam-studio.set-runs.scheduled-enabled=false"})
@DisplayName("Xưởng đề — bộ điều phối tạo bộ đề (V382)")
class ExamSetRunIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamSetRunService runs;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @MockBean private ExamDraftService drafts;
    @MockBean private SourceFetcher fetcher;
    @MockBean private UserNotificationService notifications;

    /** Bản nháp giả. */
    private static final class Fake {
        long id;
        CreateDraftRequest req;
        final List<Source> sources = new ArrayList<>();
        List<Item> items = new ArrayList<>();
        List<Check> checks = new ArrayList<>();
        String lastError;
        boolean discarded;
        int verifies;
        int textWrites;
        final List<String> regenerated = new ArrayList<>();
    }

    private final Map<Long, Fake> fakes = new HashMap<>();
    /** Khoá "SECTION#teil" → số lượt tự kiểm đầu tiên trả câu đỏ (Integer.MAX_VALUE = luôn đỏ). */
    private final Map<String, Integer> redVerifies = new HashMap<>();
    private long admin;
    private long nextSourceId = 1;

    private static String key(Fake f) {
        return f.req.section().toUpperCase() + "#" + f.req.teil();
    }

    private Draft view(Fake f) {
        TeilSpec spec = TeilSpec.find(f.req.examFormat(), f.req.cefrLevel(), f.req.section(), f.req.teil()).orElseThrow();
        return new Draft(f.id, spec.examFormat(), spec.cefrLevel(), spec.section(), spec.teil(), spec.teilType(),
                f.req.theme(), "EXAM", spec.itemCount(), f.req.difficultyPlan(), "REVIEW", f.discarded ? "DISCARDED" : "DRAFT",
                null, f.lastError, List.copyOf(f.sources), null, null, List.copyOf(f.items), List.copyOf(f.checks),
                Map.of(), Map.of(), null, null, Instant.now(), Instant.now(), null, !spec.situational(), List.of());
    }

    /** Câu hỏi và đáp án khác nhau theo bản nháp, để kiểm cấp bộ không coi các Teil giả là trùng câu. */
    private static Item item(long draft, String id, String light) {
        return new Item(id, "Frage " + draft + " " + id, Map.of("a", "Antwort " + draft + " " + id, "b", "y", "c", "z"),
                "a", null, null, List.of(), "EASY", null, false, light, List.of());
    }

    @BeforeEach
    void setUp() {
        fakes.clear();
        redVerifies.clear();
        admin = userRepository.save(User.builder().email("set-" + System.nanoTime() + "@local.test")
                .passwordHash("x").displayName("Owner").role(User.Role.ADMIN).build()).getId();
        // Không gọi mạng: feed "không đọc được", bộ điều phối phải chạy tiếp với sổ bài sẵn có.
        when(fetcher.fetchRaw(anyString())).thenThrow(new BadRequestException("test: không có mạng"));
        when(fetcher.fetchRaw(anyString(), anyInt())).thenThrow(new BadRequestException("test: không có mạng"));

        // Sổ bài: mỗi chủ đề 7 bài của Destatis, tiêu đề chứa gốc từ khoá đầu tiên của chủ đề.
        long destatis = jdbc.queryForObject("SELECT id FROM exam_source_feeds WHERE code = 'DESTATIS'", Long.class);
        jdbc.update("UPDATE exam_source_feeds SET last_polled_at = now()");
        for (ExamSetPlanner.Theme t : ExamSetPlanner.THEMES) {
            for (int i = 1; i <= 7; i++) {
                String url = "https://www.destatis.de/test/" + t.name().replace(' ', '-') + "/" + i + ".html";
                jdbc.update("INSERT INTO exam_source_articles (feed_id, url, url_hash, title) VALUES (?, ?, ?, ?)",
                        destatis, url, SourceCatalog.hash(url), "Bericht " + i + ": " + t.stems().get(0) + " in Zahlen");
            }
        }

        when(drafts.create(any(), anyLong())).thenAnswer(inv -> {
            Fake f = new Fake();
            f.req = inv.getArgument(0);
            TeilSpec spec = TeilSpec.find(f.req.examFormat(), f.req.cefrLevel(), f.req.section(), f.req.teil()).orElseThrow();
            f.id = jdbc.queryForObject("""
                    INSERT INTO exam_drafts (exam_format, cefr_level, section, teil, teil_type, theme, difficulty_plan)
                    VALUES (?, ?, ?, ?, ?, ?, '{}'::jsonb) RETURNING id
                    """, Long.class, spec.examFormat(), spec.cefrLevel(), spec.section(), spec.teil(), spec.teilType(),
                    f.req.theme());
            fakes.put(f.id, f);
            return view(f);
        });
        when(drafts.get(anyLong())).thenAnswer(inv -> view(fakes.get(inv.<Long>getArgument(0))));
        when(drafts.addSource(anyLong(), any(), anyLong())).thenAnswer(inv -> {
            Fake f = fakes.get(inv.<Long>getArgument(0));
            AddSourceRequest r = inv.getArgument(1);
            f.sources.add(new Source(nextSourceId++, r.url(), r.publisher(), "Titel", null, null, "CC BY 4.0", "ADAPT",
                    false, "OK", null, List.of(new Fact("f1", "Ein Fakt.", null, null, 1, false, false))));
            return view(f);
        });
        when(drafts.patchSource(anyLong(), anyLong(), any())).thenAnswer(inv -> view(fakes.get(inv.<Long>getArgument(0))));
        when(drafts.writeText(anyLong(), any(), anyLong())).thenAnswer(inv -> {
            Fake f = fakes.get(inv.<Long>getArgument(0));
            f.textWrites++;
            return view(f);
        });
        when(drafts.generateItems(anyLong(), anyLong())).thenAnswer(inv -> {
            Fake f = fakes.get(inv.<Long>getArgument(0));
            int n = TeilSpec.find(f.req.examFormat(), f.req.cefrLevel(), f.req.section(), f.req.teil()).orElseThrow().itemCount();
            f.items = new ArrayList<>();
            for (int i = 1; i <= n; i++) f.items.add(item(f.id, "Q" + i, null));
            return view(f);
        });
        when(drafts.regenerateItem(anyLong(), anyString(), any(), anyLong())).thenAnswer(inv -> {
            Fake f = fakes.get(inv.<Long>getArgument(0));
            f.regenerated.add(inv.getArgument(1));
            return view(f);
        });
        when(drafts.verify(anyLong(), anyLong())).thenAnswer(inv -> {
            Fake f = fakes.get(inv.<Long>getArgument(0));
            f.verifies++;
            boolean red = redVerifies.getOrDefault(key(f), 0) >= f.verifies
                    || redVerifies.getOrDefault(key(f), 0) == Integer.MAX_VALUE;
            List<Item> out = new ArrayList<>();
            for (int i = 0; i < f.items.size(); i++) out.add(item(f.id, f.items.get(i).id(), red && i == 0 ? "RED" : "GREEN"));
            f.items = out;
            f.checks = List.of(new Check("FORMAT", "Đúng khuôn Teil", "GREEN", null));
            return view(f);
        });
        doAnswer(inv -> {
            fakes.get(inv.<Long>getArgument(0)).discarded = true;
            return null;
        }).when(drafts).discard(anyLong());
        doAnswer(inv -> {
            Fake f = fakes.get(inv.<Long>getArgument(0));
            if (f != null) f.lastError = inv.getArgument(1);
            return null;
        }).when(drafts).finishBusy(anyLong(), any());
    }

    private RunView runToEnd(long runId) {
        for (int i = 0; i < 200; i++) {
            runs.tickAll();
            String status = runs.get(runId).status();
            if (!status.equals("PLANNING") && !status.equals("RUNNING")) return runs.get(runId);
        }
        throw new AssertionError("Lượt không kết thúc sau 200 nhịp: " + runs.get(runId));
    }

    private Fake live(String section, int teil) {
        return fakes.values().stream().filter(f -> !f.discarded && f.req.section().equalsIgnoreCase(section)
                && f.req.teil() == teil).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("mọi Teil xanh: 9 Teil telc B1 (có 3 Teil Nghe) chạy tới REVIEW, chủ đề không lặp, bài dùng một lần, báo admin một lần")
    void happyPath() {
        RunView created = runs.create(new CreateRunRequest("TELC", "B1", null, null), admin);
        assertThat(created.status()).isEqualTo("PLANNING");
        assertThat(created.channel()).isEqualTo("FIREWORKS");
        assertThat(created.teile()).hasSize(9);
        assertThat(created.teile()).filteredOn(t -> t.section().equals("HOEREN")).extracting(TeilView::teil)
                .containsExactly(1, 2, 3);
        assertThatThrownBy(() -> runs.create(new CreateRunRequest("TELC", "B1", null, null), admin))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Mỗi lúc máy chỉ chạy một lượt");

        RunView done = runToEnd(created.id());

        assertThat(done.status()).isEqualTo("REVIEW");
        assertThat(done.teile()).allSatisfy(t -> assertThat(t.status()).isEqualTo("READY"));
        Set<String> themes = new HashSet<>();
        for (TeilView t : done.teile()) themes.add(t.theme());
        assertThat(themes).hasSize(9).doesNotContainNull();

        Fake lesen1 = live("LESEN", 1);
        Fake lesen2 = live("LESEN", 2);
        assertThat(lesen1.sources).hasSize(5);                 // 5 văn bản ⇒ 5 nguồn
        assertThat(lesen2.sources).hasSize(1);
        // Lesen 1 trải trên 4 chủ đề: 2 bài của chủ đề đầu, mỗi chủ đề còn lại một bài; không chủ đề nào là của Lesen 2.
        List<String> mix = ExamSetPlanner.split(lesen1.req.theme());
        assertThat(mix).hasSize(4).doesNotHaveDuplicates().doesNotContain(lesen2.req.theme());
        java.util.Map<String, Long> perTheme = new java.util.HashMap<>();
        for (Source s : lesen1.sources) perTheme.merge(s.url().split("/")[4], 1L, Long::sum);
        assertThat(perTheme.values()).containsExactlyInAnyOrder(2L, 1L, 1L, 1L);
        assertThat(lesen2.req.difficultyPlan()).containsEntry("EASY", 2).containsEntry("MEDIUM", 2)
                .containsEntry("HARD", 1).containsEntry("EXPERT", 0);
        assertThat(lesen2.req.mode()).isEqualTo("EXAM");
        assertThat(live("LESEN", 3).sources).isEmpty();        // Teil theo tình huống: không lấy nguồn
        assertThat(live("SCHREIBEN", 1).items).isEmpty();      // Teil Viết: không sinh câu trắc nghiệm
        assertThat(live("SCHREIBEN", 1).verifies).isEqualTo(1);
        // Ba Teil Nghe: soạn theo tình huống (không nguồn), 5 / 10 / 5 câu, ma trận theo số câu.
        assertThat(live("HOEREN", 1).sources).isEmpty();
        assertThat(live("HOEREN", 1).items).hasSize(5);
        assertThat(live("HOEREN", 2).items).hasSize(10);
        assertThat(live("HOEREN", 2).req.difficultyPlan()).containsEntry("EASY", 4).containsEntry("MEDIUM", 4)
                .containsEntry("HARD", 2).containsEntry("EXPERT", 0);
        assertThat(live("HOEREN", 3).items).hasSize(5);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM exam_source_articles WHERE status = 'USED'", Integer.class))
                .isEqualTo(6);
        // Sáu bài khác nhau, không bài nào dùng hai lần.
        Set<String> urls = new HashSet<>();
        for (Source s : lesen1.sources) urls.add(s.url());
        urls.add(lesen2.sources.get(0).url());
        assertThat(urls).hasSize(6);

        verify(notifications, times(1)).onSystemAlert(eq("EXAM_STUDIO_SET"), anyString(), anyString(), any());
        verify(drafts, times(9)).create(any(), eq(admin));

        // Kiểm cấp bộ đã chạy và lưu kèm lượt: 7 mục, không mục nào đỏ.
        assertThat(done.setChecks()).extracting(ExamStudioDtos.Check::key).contains("SET_THEMES", "SET_UNIQUE_TEXT",
                "SET_UNIQUE_ITEMS", "SET_DIFFICULTY", "SET_THEME_MIX").hasSize(8);
        assertThat(done.setChecks()).noneMatch(c -> "RED".equals(c.light()));
    }

    @Test
    @DisplayName("câu đỏ ở lượt tự kiểm đầu: máy sinh lại đúng câu đó rồi tự kiểm lại, Teil qua ở vòng sửa 1")
    void repairsRedItem() {
        redVerifies.put("SPRACHBAUSTEINE#1", 1);
        RunView done = runToEnd(runs.create(new CreateRunRequest("TELC", "B1", "REAL", "FIREWORKS"), admin).id());

        assertThat(done.status()).isEqualTo("REVIEW");
        TeilView sb1 = done.teile().stream().filter(t -> t.section().equals("SPRACHBAUSTEINE") && t.teil() == 1)
                .findFirst().orElseThrow();
        assertThat(sb1.repairRound()).isEqualTo(1);
        assertThat(sb1.themeTry()).isZero();
        Fake f = live("SPRACHBAUSTEINE", 1);
        assertThat(f.regenerated).containsExactly("Q1");
        assertThat(f.verifies).isEqualTo(2);
    }

    @Test
    @DisplayName("Teil luôn đỏ: 2 vòng sửa, đổi chủ đề làm lại 1 lần, vẫn đỏ ⇒ Teil kẹt, lượt chuyển NEEDS_ATTENTION")
    void stuckAfterThemeRetry() {
        redVerifies.put("LESEN#3", Integer.MAX_VALUE);
        RunView done = runToEnd(runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id());

        assertThat(done.status()).isEqualTo("NEEDS_ATTENTION");
        TeilView lesen3 = done.teile().stream().filter(t -> t.section().equals("LESEN") && t.teil() == 3)
                .findFirst().orElseThrow();
        assertThat(lesen3.status()).isEqualTo("STUCK");
        assertThat(lesen3.themeTry()).isEqualTo(1);
        assertThat(lesen3.lastError()).contains("Câu đỏ");
        assertThat(done.teile()).filteredOn(t -> !(t.section().equals("LESEN") && t.teil() == 3))
                .allSatisfy(t -> assertThat(t.status()).isEqualTo("READY"));

        List<Fake> tries = fakes.values().stream().filter(f -> key(f).equals("LESEN#3")).toList();
        assertThat(tries).hasSize(2);                                   // bản nháp đầu + bản nháp sau khi đổi chủ đề
        assertThat(tries).filteredOn(f -> f.discarded).hasSize(1);      // bản đầu bị bỏ, bản kẹt giữ lại cho owner
        assertThat(tries).allSatisfy(f -> assertThat(f.verifies).isEqualTo(3)); // 1 lần đầu + 2 vòng sửa
        assertThat(tries.get(0).req.theme()).isNotEqualTo(tries.get(1).req.theme());
        // Chủ đề thay thế không trùng chủ đề của Teil khác trong bộ.
        Set<String> all = new HashSet<>();
        for (TeilView t : done.teile()) all.add(t.theme());
        assertThat(all).hasSize(9);
    }

    @Test
    @DisplayName("kiểm lại bộ: Teil kẹt hiện mục còn đỏ; owner sửa hết đỏ rồi kiểm lại ⇒ Teil xong, lượt sang REVIEW")
    void recheckAfterManualFix() {
        redVerifies.put("LESEN#3", Integer.MAX_VALUE);
        RunView stuck = runToEnd(runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id());
        assertThat(stuck.status()).isEqualTo("NEEDS_ATTENTION");
        TeilView lesen3 = stuck.teile().stream().filter(t -> t.section().equals("LESEN") && t.teil() == 3)
                .findFirst().orElseThrow();
        assertThat(lesen3.problems()).extracting(ExamSetRunService.Problem::kind, ExamSetRunService.Problem::ref)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("ITEM", "Q1"));
        assertThat(stuck.teile()).filteredOn(t -> t.status().equals("READY"))
                .allSatisfy(t -> assertThat(t.problems()).isEmpty());

        // Chưa sửa gì: kiểm lại vẫn kẹt.
        assertThat(runs.recheck(stuck.id()).status()).isEqualTo("NEEDS_ATTENTION");

        // Owner sửa tay câu đỏ và tự kiểm lại trong trình 5 bước ⇒ bản nháp hết đỏ.
        Fake f = live("LESEN", 3);
        List<Item> fixed = new ArrayList<>();
        for (Item i : f.items) fixed.add(item(f.id, i.id(), "GREEN"));
        f.items = fixed;

        RunView done = runs.recheck(stuck.id());
        assertThat(done.status()).isEqualTo("REVIEW");
        assertThat(done.teile()).allSatisfy(t -> {
            assertThat(t.status()).isEqualTo("READY");
            assertThat(t.problems()).isEmpty();
        });
        assertThat(done.setChecks()).isNotEmpty().noneMatch(c -> "RED".equals(c.light()));
        // Lượt đã sang REVIEW thì không kiểm lại nữa.
        assertThatThrownBy(() -> runs.recheck(stuck.id())).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("làm lại một Teil: bản nháp cũ bị bỏ, chủ đề mới không trùng Teil khác, lượt chạy lại rồi về REVIEW")
    void redoOneTeil() {
        RunView done = runToEnd(runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id());
        assertThat(done.status()).isEqualTo("REVIEW");
        Fake before = live("LESEN", 2);
        String oldTheme = before.req.theme();

        RunView redo = runs.redoTeil(done.id(), "LESEN", 2);
        assertThat(redo.status()).isEqualTo("RUNNING");
        assertThat(before.discarded).isTrue();
        // Đang làm lại thì không tạo được lượt mới.
        assertThatThrownBy(() -> runs.create(new CreateRunRequest("TELC", "B1", null, null), admin))
                .isInstanceOf(BadRequestException.class);

        RunView again = runToEnd(done.id());
        assertThat(again.status()).isEqualTo("REVIEW");
        Fake after = live("LESEN", 2);
        assertThat(after.id).isNotEqualTo(before.id);
        assertThat(after.req.theme()).isNotEqualTo(oldTheme);
        Set<String> all = new HashSet<>();
        for (TeilView t : again.teile()) all.addAll(ExamSetPlanner.split(t.theme()));
        assertThat(all).hasSize(12);  // Lesen 1 bốn chủ đề + tám Teil còn lại, không chủ đề nào lặp
        assertThat(again.setChecks()).isNotEmpty().noneMatch(c -> "RED".equals(c.light()));
    }

    @Test
    @DisplayName("lượt cũ không có phần Nghe: thêm ba Teil Nghe với chủ đề chưa dùng, lượt chạy lại rồi về REVIEW đủ 9 Teil")
    void addHoerenToOldRun() {
        RunView done = runToEnd(runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id());
        assertThat(done.status()).isEqualTo("REVIEW");
        // Lượt đã có phần Nghe thì không thêm nữa.
        assertThatThrownBy(() -> runs.addHoeren(done.id(), null)).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã có phần Nghe");

        // Dựng lại hình dạng lượt cũ (tạo trước khi máy soạn được Hören): chỉ còn 6 Teil.
        jdbc.update("DELETE FROM exam_set_run_teile WHERE run_id = ? AND section = 'HOEREN'", done.id());
        fakes.values().removeIf(f -> f.req.section().equals("HOEREN"));
        Set<String> before = new HashSet<>();
        for (TeilView t : runs.get(done.id()).teile()) before.addAll(ExamSetPlanner.split(t.theme()));
        assertThat(runs.get(done.id()).teile()).hasSize(6);
        Fake lesen2 = live("LESEN", 2);

        RunView started = runs.addHoeren(done.id(), "FIREWORKS");
        assertThat(started.status()).isEqualTo("RUNNING");
        assertThat(started.teile()).hasSize(9);
        List<TeilView> hoeren = started.teile().stream().filter(t -> t.section().equals("HOEREN")).toList();
        assertThat(hoeren).extracting(TeilView::teil).containsExactly(1, 2, 3);
        assertThat(hoeren).allSatisfy(t -> {
            assertThat(t.status()).isEqualTo("RUNNING");
            assertThat(t.draftId()).isNull();
            assertThat(before).doesNotContain(t.theme());
        });
        assertThat(hoeren).extracting(TeilView::theme).doesNotHaveDuplicates().doesNotContainNull();
        // Đang dựng phần Nghe thì không tạo được lượt mới, cũng không thêm lần hai.
        assertThatThrownBy(() -> runs.create(new CreateRunRequest("TELC", "B1", null, null), admin))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> runs.addHoeren(done.id(), null)).isInstanceOf(BadRequestException.class);

        RunView again = runToEnd(done.id());
        assertThat(again.status()).isEqualTo("REVIEW");
        assertThat(again.teile()).hasSize(9).allSatisfy(t -> assertThat(t.status()).isEqualTo("READY"));
        // Các Teil đã xong giữ nguyên bản nháp cũ.
        assertThat(live("LESEN", 2).id).isEqualTo(lesen2.id);
        assertThat(lesen2.discarded).isFalse();
        assertThat(live("HOEREN", 2).items).hasSize(10);
        assertThat(again.setChecks()).isNotEmpty().noneMatch(c -> "RED".equals(c.light()));
    }

    @Test
    @DisplayName("thêm phần Nghe: lượt đang chạy hoặc đã bỏ thì từ chối")
    void addHoerenNeedsFinishedRun() {
        long id = runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id();
        assertThatThrownBy(() -> runs.addHoeren(id, null)).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã chạy xong");
        runs.discard(id);
        assertThatThrownBy(() -> runs.addHoeren(id, null)).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("duyệt cả bộ: chỉ lượt REVIEW mới duyệt được; mọi bản nháp được duyệt với đủ 8 mục, hỏng một Teil thì không ghép")
    void approveWholeSet() {
        long id = runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id();
        assertThatThrownBy(() -> runs.approve(id, null, admin)).isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Sẵn sàng duyệt");
        assertThat(runToEnd(id).status()).isEqualTo("REVIEW");

        // Bản nháp giả không vào kho thật ⇒ lượt duyệt dừng ở Teil đầu tiên và lượt vẫn ở REVIEW.
        when(drafts.approve(anyLong(), any(), anyLong())).thenThrow(new BadRequestException("test: không duyệt được"));
        assertThatThrownBy(() -> runs.approve(id, null, admin)).isInstanceOf(BadRequestException.class);
        assertThat(runs.get(id).status()).isEqualTo("REVIEW");
        org.mockito.ArgumentCaptor<Map<String, Boolean>> checklist = org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(drafts).approve(anyLong(), checklist.capture(), eq(admin));
        assertThat(checklist.getValue()).containsOnlyKeys(TeilSpec.CHECKLIST_KEYS).containsValues(true)
                .doesNotContainValue(false);
    }

    @Test
    @DisplayName("duyệt cả bộ: kiểm trước MỌI Teil, báo một lần đủ Teil chưa đạt kèm bản nháp và việc cần làm, chưa Teil nào vào kho")
    void approveWholeSetReportsEveryFailingTeil() {
        long id = runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id();
        assertThat(runToEnd(id).status()).isEqualTo("REVIEW");
        List<ExamSetRunService.TeilView> teile = runs.get(id).teile();
        long first = teile.get(0).draftId();
        long last = teile.get(teile.size() - 1).draftId();
        ApprovalGuide.Blocker stale = ApprovalGuide.blockers(new ApprovalGuide.Facts(
                "DRAFT", false, true, true, false, List.of(), true, true, true, null)).get(0);
        when(drafts.approvalBlockers(first)).thenReturn(List.of(stale));
        when(drafts.approvalBlockers(last)).thenReturn(List.of(stale));

        assertThatThrownBy(() -> runs.approve(id, null, admin))
                .isInstanceOfSatisfying(com.deutschflow.common.exception.GuidedException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("EXAM_SET_RUN_NOT_APPROVABLE");
                    assertThat(e.getWhere()).containsEntry("runId", id);
                    assertThat(e.getIssues()).hasSize(2);
                    assertThat(e.getIssues()).extracting(i -> i.where().get("draftId")).containsExactly(first, last);
                    assertThat(e.getIssues()).allSatisfy(i -> assertThat(i.url()).startsWith("/v2/admin/exam-studio/"));
                    assertThat(e.getMessage()).contains("lượt #" + id, "bản nháp #" + first, "bản nháp #" + last,
                            "Chạy tự kiểm", "Duyệt cả bộ");
                });
        verify(drafts, org.mockito.Mockito.never()).approve(anyLong(), any(), anyLong());
        assertThat(runs.get(id).status()).isEqualTo("REVIEW");
    }

    @Test
    @DisplayName("bỏ lượt: bản nháp của lượt bị bỏ theo, lượt sang DISCARDED và cho tạo lượt mới")
    void discardRun() {
        long id = runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).id();
        runs.tickAll(); // lập kế hoạch
        runs.tickAll(); // tạo bản nháp
        assertThat(fakes).isNotEmpty();

        assertThat(runs.discard(id).status()).isEqualTo("DISCARDED");
        assertThat(fakes.values()).allSatisfy(f -> assertThat(f.discarded).isTrue());
        assertThat(runs.create(new CreateRunRequest("TELC", "B1", null, null), admin).status()).isEqualTo("PLANNING");
        assertThatThrownBy(() -> runs.create(new CreateRunRequest("GOETHE", "C2", null, null), admin))
                .isInstanceOf(BadRequestException.class);
    }

    private long lastRunId() {
        return jdbc.queryForObject("SELECT coalesce(max(id), 0) FROM exam_set_runs", Long.class);
    }

    @Test
    @DisplayName("tự nối lượt: bật thì máy tự tạo lượt; lượt xong thì tạo lượt kế; tắt thì dừng")
    void autoContinueChainsRuns() {
        assertThat(runs.auto().enabled()).isFalse();
        long base = lastRunId();
        runs.tickAll();
        assertThat(lastRunId()).isEqualTo(base);                            // tắt: không tự tạo gì

        var on = runs.setAuto(new ExamSetRunService.AutoRequest(true, "TELC", "B1", null, "FIREWORKS"), admin);
        assertThat(on.enabled()).isTrue();
        assertThat(on.examFormat()).isEqualTo("TELC");
        runs.tickAll();
        long first = lastRunId();
        assertThat(first).isGreaterThan(base);
        runs.tickAll();
        assertThat(lastRunId()).isEqualTo(first);                           // lượt đang chạy: không tạo thêm

        assertThat(runToEnd(first).status()).isEqualTo("REVIEW");
        runs.tickAll();
        long second = lastRunId();
        assertThat(second).isGreaterThan(first);
        assertThat(runs.get(second).channel()).isEqualTo("FIREWORKS");

        runs.setAuto(new ExamSetRunService.AutoRequest(false, null, null, null, null), admin);
        assertThat(runToEnd(second).status()).isEqualTo("REVIEW");
        runs.tickAll();
        assertThat(lastRunId()).isEqualTo(second);                          // đã tắt: lượt đang chạy xong là dừng
    }

    @Test
    @DisplayName("tự nối lượt tạm dừng khi đủ 5 bộ chờ xem, tự tắt khi lượt mới kẹt hết mọi Teil")
    void autoContinuePausesAndStops() {
        for (int i = 0; i < ExamSetRunService.AUTO_MAX_WAITING; i++) {
            jdbc.update("INSERT INTO exam_set_runs (exam_format, cefr_level, status) VALUES ('TELC', 'B1', 'REVIEW')");
        }
        long before = lastRunId();
        runs.setAuto(new ExamSetRunService.AutoRequest(true, "TELC", "B1", "REAL", "FIREWORKS"), admin);
        runs.tickAll();
        assertThat(lastRunId()).isEqualTo(before);
        assertThat(runs.auto().note()).contains("Tạm dừng").contains("5 bộ");
        assertThat(runs.auto().enabled()).isTrue();

        // Bỏ bớt một bộ chờ ⇒ chạy tiếp; lượt máy vừa tạo kẹt hết mọi Teil ⇒ máy tự tắt và báo owner.
        jdbc.update("UPDATE exam_set_runs SET status = 'DISCARDED' WHERE id = ?", before);
        runs.tickAll();
        long created = lastRunId();
        assertThat(created).isGreaterThan(before);
        assertThat(runs.auto().note()).isNull();
        jdbc.update("UPDATE exam_set_runs SET status = 'NEEDS_ATTENTION' WHERE id = ?", created);
        jdbc.update("UPDATE exam_set_run_teile SET status = 'STUCK' WHERE run_id = ?", created);
        runs.tickAll();
        assertThat(lastRunId()).isEqualTo(created);
        assertThat(runs.auto().enabled()).isFalse();
        assertThat(runs.auto().note()).contains("Đã tự tắt").contains("#" + created);
        verify(notifications).onSystemAlert(eq("EXAM_STUDIO_SET"), eq("Tự nối lượt đã tắt"), anyString(), any());
    }
}
