package com.deutschflow.srs.service;

import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.entity.VocabReviewSchedule.FsrsState;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Vector tham chiếu và tính chất của FSRS-4.5 trong {@link FsrsService}. Unit thuần, không Spring.
 *
 * <p>Nguồn số liệu:
 * <ul>
 *   <li><b>Đối chiếu được với nguồn ngoài:</b> {@link #pyFsrsTestRepeatIntervals()} — chuỗi khoảng
 *       ôn của {@code tests/test_fsrs.py::test_repeat} trong py-fsrs v2.5.1 (commit
 *       48423c5a7f1b37100ae2bd32296ca3e7340a38b0), cùng bộ tham số riêng của test đó; và bộ 17
 *       tham số mặc định ({@link #defaultWeightsMatchPublishedFsrs45()}) chép từ wiki
 *       open-spaced-repetition mục FSRS-4.5.</li>
 *   <li><b>Chỉ tự tính:</b> {@link #defaultWeightsSequence()} — số S, D, R, khoảng ôn tính bằng một
 *       script độc lập viết thẳng từ công thức trong wiki (không dùng mã Java này).</li>
 * </ul>
 */
class FsrsServiceReferenceTest {

    private static final int AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;
    private static final OffsetDateTime T0 = OffsetDateTime.of(2026, 3, 1, 8, 0, 0, 0, ZoneOffset.UTC);

    private final FsrsService fsrs = new FsrsService();

    private VocabReviewSchedule newCard() {
        return VocabReviewSchedule.builder()
                .userId(1L).vocabId("w1").german("Hallo").meaning("Xin chào")
                .algorithmVersion(VocabReviewSchedule.AlgorithmVersion.FSRS.name())
                .build();
    }

    private VocabReviewSchedule cardAt(double s, double d) {
        VocabReviewSchedule card = newCard();
        card.setStability(BigDecimal.valueOf(s));
        card.setDifficulty(BigDecimal.valueOf(d));
        card.setLastReviewAt(T0);
        return card;
    }

    @Test
    @DisplayName("17 tham số mặc định đúng bộ FSRS-4.5 đã công bố")
    void defaultWeightsMatchPublishedFsrs45() {
        assertThat(fsrs.defaultWeights()).containsExactly(
                0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
                0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755);
        assertThat(FsrsService.WEIGHT_COUNT).isEqualTo(17);
    }

    @Test
    @DisplayName("đường cong quên 4.5: R(S,S) = 0,9; R(0,S) = 1; khoảng ôn ở retention 0,9 bằng S")
    void forgettingCurveAnchors() {
        assertThat(fsrs.retrievability(10.0, 10)).isCloseTo(0.9, within(1e-12));
        assertThat(fsrs.retrievability(10.0, 0)).isEqualTo(1.0);
        // FSRS-4.5 (DECAY −0,5): R(2S, S) = sqrt(81/119) ≈ 0,82503; đường cong v4 cũ cho 9/11 ≈ 0,8182.
        assertThat(fsrs.retrievability(10.0, 20)).isCloseTo(Math.sqrt(81.0 / 119.0), within(1e-12));
        assertThat(fsrs.retrievability(10.0, 20)).isCloseTo(0.82503, within(1e-5));
        assertThat(fsrs.nextInterval(10.0)).isEqualTo(10);
        assertThat(fsrs.nextInterval(0.2)).isEqualTo(1);          // sàn 1 ngày
        assertThat(fsrs.nextInterval(1e9)).isEqualTo(36500);      // trần
    }

    @Test
    @DisplayName("vector tham chiếu py-fsrs v2.5.1 test_repeat: 5,16,43,106,236 → quên → 12,25,47,85,147")
    void pyFsrsTestRepeatIntervals() {
        // Bộ tham số của chính test_repeat trong py-fsrs v2.5.1.
        double[] w = {1.14, 1.01, 5.44, 14.67, 5.3024, 1.5662, 1.2503, 0.0028, 1.5489, 0.1763,
                0.9953, 2.7473, 0.0179, 0.3105, 0.3976, 0.0, 2.0902};
        // py-fsrs: [0, 5, 16, 43, 106, 236, 0, 0, 12, 25, 47, 85, 147] với 6 Good, 2 Again, 5 Good.
        // Ba số 0 là các bước học theo phút (thẻ mới; hai lần Again) — dự án không có các bước đó,
        // và bản tham chiếu không đổi S/D trong các bước ấy, nên phần còn lại phải trùng khít.
        int[] ratings = {GOOD, GOOD, GOOD, GOOD, GOOD, AGAIN, GOOD, GOOD, GOOD, GOOD};
        List<Integer> intervals = new ArrayList<>();

        VocabReviewSchedule card = newCard();
        OffsetDateTime now = T0;
        fsrs.initializeCard(card, ratings[0], w, now);
        intervals.add(card.getIntervalDays());
        for (int i = 1; i < ratings.length; i++) {
            long elapsed = card.getIntervalDays(); // ôn đúng hạn, như test tham chiếu
            now = now.plusDays(elapsed);
            fsrs.scheduleReview(card, ratings[i], elapsed, w, now);
            intervals.add(card.getIntervalDays());
            assertThat(card.getNextReviewAt()).isEqualTo(now.plusDays(card.getIntervalDays()));
            assertThat(card.getLastReviewAt()).isEqualTo(now);
        }

        assertThat(intervals).containsExactly(5, 16, 43, 106, 236, 12, 25, 47, 85, 147);
    }

    @Test
    @DisplayName("tham số mặc định: Good, Good+4d, Hard+15d, Again+20d, Good+2d, Easy+10d cho S, D, R, khoảng ôn đúng")
    void defaultWeightsSequence() {
        double[] w = fsrs.defaultWeights();
        // {rating, số ngày trôi, R lúc ôn, S sau ôn, D sau ôn, khoảng ôn kế} — tự tính từ công thức wiki.
        double[][] expected = {
                {GOOD,   0, 1.0000000000,  3.7145000000, 5.1618000000,  4},
                {GOOD,   4, 0.8934995007, 14.8081005065, 5.1618000000, 15},
                {HARD,  15, 0.8988940398, 22.6813767152, 6.0314775000, 23},
                {AGAIN, 20, 0.9102812800,  3.7785985253, 7.7438724975,  4},
                {GOOD,   2, 0.9431628851,  7.0425820288, 7.6638282501,  7},
                {EASY,  10, 0.8661106497, 47.4400019295, 6.7165878743, 47},
        };

        // (a) Chuỗi công thức thuần, không làm tròn giữa chừng.
        double s = fsrs.initStability(GOOD, w);
        double d = fsrs.initDifficulty(GOOD, w);
        assertThat(s).isCloseTo(expected[0][3], within(1e-9));
        assertThat(d).isCloseTo(expected[0][4], within(1e-9));
        assertThat(fsrs.nextInterval(s)).isEqualTo((int) expected[0][5]);
        for (int i = 1; i < expected.length; i++) {
            int g = (int) expected[i][0];
            long t = (long) expected[i][1];
            double r = fsrs.retrievability(s, t);
            double nextS = g >= 2 ? fsrs.stabilityAfterPass(s, d, r, g, w) : fsrs.stabilityAfterFail(s, d, r, w);
            d = fsrs.updateDifficulty(d, g, w);
            s = nextS;
            assertThat(r).as("R bước %d", i).isCloseTo(expected[i][2], within(1e-9));
            assertThat(s).as("S bước %d", i).isCloseTo(expected[i][3], within(1e-8));
            assertThat(d).as("D bước %d", i).isCloseTo(expected[i][4], within(1e-9));
            assertThat(fsrs.nextInterval(s)).as("khoảng ôn bước %d", i).isEqualTo((int) expected[i][5]);
        }

        // (b) Qua thẻ thật (S lưu 4 số lẻ, D lưu 2 số lẻ): khoảng ôn, interval_days, trạng thái.
        VocabReviewSchedule card = newCard();
        OffsetDateTime now = T0;
        fsrs.initializeCard(card, GOOD, w, now);
        assertThat(card.getIntervalDays()).isEqualTo(4);
        assertThat(card.getFsrsState()).isEqualTo(FsrsState.REVIEW.value);
        for (int i = 1; i < expected.length; i++) {
            int g = (int) expected[i][0];
            long t = (long) expected[i][1];
            now = now.plusDays(t);
            fsrs.scheduleReview(card, g, t, w, now);
            assertThat(card.getIntervalDays()).as("interval_days bước %d", i).isEqualTo((int) expected[i][5]);
            assertThat(card.getNextReviewAt()).isEqualTo(now.plusDays((long) expected[i][5]));
            assertThat(card.getLastReviewAt()).isEqualTo(now);
            assertThat(card.getStability().doubleValue()).as("S bước %d", i)
                    .isCloseTo(expected[i][3], within(expected[i][3] * 0.005));
            assertThat(card.getDifficulty().doubleValue()).as("D bước %d", i)
                    .isCloseTo(expected[i][4], within(0.02));
            assertThat(card.getRetrievability().doubleValue()).isCloseTo(expected[i][2], within(0.001));
            assertThat(card.getFsrsState())
                    .isEqualTo(g == AGAIN ? FsrsState.RELEARNING.value : FsrsState.REVIEW.value);
        }
    }

    @Test
    @DisplayName("cùng trạng thái, cùng số ngày trôi > 0: Again < Hard < Good < Easy; Again giảm S, Good tăng S")
    void ratingOrderingProperty() {
        double[] w = fsrs.defaultWeights();
        double[][] states = {{3.7145, 5.16}, {14.8, 5.16}, {40.0, 3.0}, {120.0, 8.5}};
        long[] elapsedOptions = {1, 4, 30, 200};
        for (double[] st : states) {
            for (long t : elapsedOptions) {
                int[] interval = new int[5];
                double[] stability = new double[5];
                for (int g = AGAIN; g <= EASY; g++) {
                    VocabReviewSchedule card = cardAt(st[0], st[1]);
                    fsrs.scheduleReview(card, g, t, w, T0.plusDays(t));
                    interval[g] = card.getIntervalDays();
                    stability[g] = card.getStability().doubleValue();
                }
                String ctx = "S=" + st[0] + " D=" + st[1] + " t=" + t;
                // Quên không bao giờ làm tăng S; giảm hẳn khi thẻ không bị bỏ quá lâu so với S.
                assertThat(stability[AGAIN]).as(ctx).isLessThanOrEqualTo(st[0]);
                if (t <= 2 * st[0]) {
                    assertThat(stability[AGAIN]).as(ctx).isLessThan(st[0]);
                }
                assertThat(stability[HARD]).as(ctx).isGreaterThan(st[0]).isLessThan(stability[GOOD]);
                assertThat(stability[GOOD]).as(ctx).isGreaterThan(st[0]).isLessThan(stability[EASY]);
                assertThat(interval[AGAIN]).as(ctx).isLessThan(interval[GOOD]);
                assertThat(interval[HARD]).as(ctx).isLessThanOrEqualTo(interval[GOOD]);
                assertThat(interval[GOOD]).as(ctx).isLessThan(interval[EASY]);
            }
        }
        // Ôn đúng hạn (t ≈ S): các khoảng ôn tách hẳn khỏi sai số làm tròn ngày → chặt Hard < Good < Easy.
        VocabReviewSchedule h = cardAt(14.8, 5.16);
        VocabReviewSchedule g = cardAt(14.8, 5.16);
        VocabReviewSchedule e = cardAt(14.8, 5.16);
        fsrs.scheduleReview(h, HARD, 15, w, T0.plusDays(15));
        fsrs.scheduleReview(g, GOOD, 15, w, T0.plusDays(15));
        fsrs.scheduleReview(e, EASY, 15, w, T0.plusDays(15));
        assertThat(h.getIntervalDays()).isLessThan(g.getIntervalDays());
        assertThat(g.getIntervalDays()).isLessThan(e.getIntervalDays());
    }

    @Test
    @DisplayName("lỗi cũ: Good sau 0 ngày trôi không tăng S; Good sau số ngày trôi thật thì tăng")
    void elapsedDaysDriveStabilityGrowth() {
        double[] w = fsrs.defaultWeights();
        VocabReviewSchedule sameDay = cardAt(3.7145, 5.16);
        fsrs.scheduleReview(sameDay, GOOD, 0, w, T0);
        assertThat(sameDay.getStability().doubleValue()).isCloseTo(3.7145, within(1e-4));

        VocabReviewSchedule later = cardAt(3.7145, 5.16);
        fsrs.scheduleReview(later, GOOD, 4, w, T0.plusDays(4));
        assertThat(later.getStability().doubleValue()).isGreaterThan(14.0);
    }

    @Test
    @DisplayName("quên sau khi bỏ rất lâu một thẻ S nhỏ: S không tăng (4.5 thuần cho 3,85 > 3,7145)")
    void lapseNeverIncreasesStability() {
        double[] w = fsrs.defaultWeights();
        double pure = fsrs.stabilityAfterFail(3.7145, 5.16, fsrs.retrievability(3.7145, 200), w);
        assertThat(pure).isGreaterThan(3.7145); // công thức thuần vượt S cũ

        VocabReviewSchedule card = cardAt(3.7145, 5.16);
        fsrs.scheduleReview(card, AGAIN, 200, w, T0.plusDays(200));
        assertThat(card.getStability()).isEqualByComparingTo("3.7145");
        assertThat(card.getIntervalDays()).isEqualTo(4);
    }

    @Test
    @DisplayName("độ khó: Again tăng, Easy giảm, luôn trong [1, 10], Good kéo về w4")
    void difficultyUpdate() {
        double[] w = fsrs.defaultWeights();
        assertThat(fsrs.updateDifficulty(5.0, AGAIN, w)).isGreaterThan(5.0);
        assertThat(fsrs.updateDifficulty(5.0, EASY, w)).isLessThan(5.0);
        assertThat(fsrs.updateDifficulty(10.0, AGAIN, w)).isEqualTo(10.0);
        assertThat(fsrs.updateDifficulty(1.0, EASY, w)).isEqualTo(1.0);
        assertThat(fsrs.updateDifficulty(9.0, GOOD, w)).isLessThan(9.0).isGreaterThan(w[4]);
        assertThat(fsrs.initDifficulty(AGAIN, w)).isCloseTo(5.1618 + 2 * 1.2298, within(1e-12));
        assertThat(fsrs.initDifficulty(EASY, w)).isCloseTo(5.1618 - 1.2298, within(1e-12));
    }
}
