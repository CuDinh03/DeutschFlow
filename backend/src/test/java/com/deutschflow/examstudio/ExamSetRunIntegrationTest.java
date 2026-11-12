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

    private static Item item(String id, String light) {
        return new Item(id, "Frage", Map.of("a", "x", "b", "y", "c", "z"), "a", null, null, List.of(), "EASY", null,
                false, light, List.of());
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
            for (int i = 1; i <= n; i++) f.items.add(item("Q" + i, null));
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
            for (int i = 0; i < f.items.size(); i++) out.add(item(f.items.get(i).id(), red && i == 0 ? "RED" : "GREEN"));
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
    @DisplayName("mọi Teil xanh: 6 Teil telc B1 chạy tới REVIEW, chủ đề không lặp, bài dùng một lần, báo admin một lần")
    void happyPath() {
        RunView created = runs.create(new CreateRunRequest("TELC", "B1", null, null), admin);
        assertThat(created.status()).isEqualTo("PLANNING");
        assertThat(created.channel()).isEqualTo("FIREWORKS");
        assertThat(created.teile()).hasSize(6);
        assertThatThrownBy(() -> runs.create(new CreateRunRequest("TELC", "B1", null, null), admin))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Đang có một lượt");

        RunView done = runToEnd(created.id());

        assertThat(done.status()).isEqualTo("REVIEW");
        assertThat(done.teile()).allSatisfy(t -> assertThat(t.status()).isEqualTo("READY"));
        Set<String> themes = new HashSet<>();
        for (TeilView t : done.teile()) themes.add(t.theme());
        assertThat(themes).hasSize(6).doesNotContainNull();

        Fake lesen1 = live("LESEN", 1);
        Fake lesen2 = live("LESEN", 2);
        assertThat(lesen1.sources).hasSize(5);                 // 5 văn bản ⇒ 5 nguồn
        assertThat(lesen2.sources).hasSize(1);
        assertThat(lesen2.req.difficultyPlan()).containsEntry("EASY", 2).containsEntry("MEDIUM", 2)
                .containsEntry("HARD", 1).containsEntry("EXPERT", 0);
        assertThat(lesen2.req.mode()).isEqualTo("EXAM");
        assertThat(live("LESEN", 3).sources).isEmpty();        // Teil theo tình huống: không lấy nguồn
        assertThat(live("SCHREIBEN", 1).items).isEmpty();      // Teil Viết: không sinh câu trắc nghiệm
        assertThat(live("SCHREIBEN", 1).verifies).isEqualTo(1);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM exam_source_articles WHERE status = 'USED'", Integer.class))
                .isEqualTo(6);
        // Sáu bài khác nhau, không bài nào dùng hai lần.
        Set<String> urls = new HashSet<>();
        for (Source s : lesen1.sources) urls.add(s.url());
        urls.add(lesen2.sources.get(0).url());
        assertThat(urls).hasSize(6);

        verify(notifications, times(1)).onSystemAlert(eq("EXAM_STUDIO_SET"), anyString(), anyString(), any());
        verify(drafts, times(6)).create(any(), eq(admin));
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
        assertThat(all).hasSize(6);
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
}
