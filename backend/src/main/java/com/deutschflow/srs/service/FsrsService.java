package com.deutschflow.srs.service;

import com.deutschflow.srs.entity.VocabReviewSchedule;
import com.deutschflow.srs.entity.VocabReviewSchedule.FsrsState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;

/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler) — phần tính lịch ôn.
 *
 * <h3>Nguồn chuẩn (đã tra, không viết từ trí nhớ)</h3>
 * <ul>
 *   <li>Công thức và 17 tham số mặc định: wiki "The Algorithm" của open-spaced-repetition, mục
 *       <b>FSRS-4.5</b> (đường cong quên, khoảng ôn kế) và mục <b>FSRS v4</b> (các công thức còn
 *       lại — 4.5 chỉ đổi đường cong quên và bộ tham số mặc định):
 *       <a href="https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm">
 *       awesome-fsrs/wiki/The-Algorithm</a> (trang cũ {@code fsrs4anki/wiki/The-Algorithm} đã
 *       chuyển về đây), đọc ngày 2026-11-11.</li>
 *   <li>Bản cài đặt tham chiếu đúng phiên bản 4.5 (17 tham số): <b>py-fsrs v2.5.1</b>, commit
 *       {@code 48423c5a7f1b37100ae2bd32296ca3e7340a38b0}, file {@code src/fsrs/fsrs.py} và
 *       {@code src/fsrs/models.py}:
 *       <a href="https://github.com/open-spaced-repetition/py-fsrs/blob/v2.5.1/src/fsrs/fsrs.py">
 *       py-fsrs v2.5.1</a>. Bộ tham số mặc định và từng công thức dưới đây khớp từng dòng với
 *       bản này; chuỗi khoảng ôn trong {@code tests/test_fsrs.py::test_repeat} của nó được dùng
 *       làm vector tham chiếu trong {@code FsrsServiceReferenceTest}.</li>
 * </ul>
 *
 * <h3>Thang chấm</h3>
 * 1 = Again (quên) · 2 = Hard · 3 = Good · 4 = Easy. Frontend vẫn gửi {@code quality} 0–5 kiểu
 * SM-2; {@link #mapSm2ToFsrs(int)} đổi: 0–1 → Again, 2 → Hard, 3–4 → Good, 5 → Easy.
 *
 * <h3>Công thức FSRS-4.5 ({@code w[i]} là tham số thứ i, G là rating 1–4)</h3>
 * <pre>
 *   DECAY = −0,5 ; FACTOR = 19/81  (= 0,9^(1/DECAY) − 1)
 *   S0(G)        = max(w[G−1], 0,1)
 *   D0(G)        = clamp(w4 − (G−3)·w5, 1, 10)
 *   D'(D,G)      = clamp(w7·D0(3) + (1−w7)·(D − w6·(G−3)), 1, 10)      // mean reversion về w4
 *   R(t,S)       = (1 + FACTOR·t/S)^DECAY                               // R = 0,9 khi t = S
 *   I(r,S)       = clamp(round(S/FACTOR · (r^(1/DECAY) − 1)), 1, 36500) // I = S khi r = 0,9
 *   S'r(D,S,R,G) = S·(1 + e^w8·(11−D)·S^(−w9)·(e^(w10·(1−R)) − 1)·[w15 nếu G=2]·[w16 nếu G=4])
 *   S'f(D,S,R)   = w11·D^(−w12)·((S+1)^w13 − 1)·e^(w14·(1−R))
 * </pre>
 * {@code w15} là hard penalty (&lt; 1), {@code w16} là easy bonus (&gt; 1).
 *
 * <h3>Chỗ dự án cố ý khác bản tham chiếu (không phải công thức)</h3>
 * <ul>
 *   <li><b>Không có bước học theo phút</b> (learning/relearning steps 1′/5′/10′ của py-fsrs).
 *       Thẻ từ vựng ở đây được xếp lịch theo NGÀY ngay từ lần chấm đầu và ngay sau khi quên:
 *       khoảng ôn = {@code I(r, S)} của độ ổn định vừa tính. Bản tham chiếu, sau các bước theo
 *       phút, cũng ra đúng khoảng ôn đó (trong trạng thái Learning/Relearning nó không đổi S, D).</li>
 *   <li>Không ép "Hard &lt; Good &lt; Easy lệch nhau ít nhất 1 ngày" như py-fsrs làm khi hiển thị
 *       cả bốn lựa chọn — mỗi lần chấm ở đây chỉ tính một rating.</li>
 *   <li>Độ ổn định sau mọi cập nhật được chặn dưới ở 0,1 ngày (bản tham chiếu chỉ chặn ở S0)
 *       và chặn trên ở 36500 ngày.</li>
 *   <li><b>Sau khi quên, S mới không vượt S cũ</b>: {@code S' = min(S'f, S)}. Công thức 4.5 thuần
 *       cho phép S'f &gt; S khi thẻ có S nhỏ mà bị bỏ rất lâu (ví dụ S = 3,7 ngày, ôn trễ 200 ngày
 *       rồi bấm "quên" → S'f ≈ 3,85). Bản 4.5 tham chiếu không chặn; các phiên bản FSRS sau đó có
 *       chặn đúng như vậy. Với thẻ ôn gần đúng hạn, chặn này không có tác dụng.</li>
 *   <li>S lưu 4 chữ số thập phân, D lưu 2 chữ số (kiểu cột) — sai khác làm tròn rất nhỏ.</li>
 * </ul>
 *
 * <h3>Trọng số theo người dùng</h3>
 * {@link FsrsWeightProvider} trả vector 17 phần tử của người dùng nếu có và hợp lệ; ngoài ra dùng
 * {@link #defaultWeights()}. Vector sai độ dài (ví dụ 20 phần tử do {@link FsrsWeightOptimizerService}
 * bản cũ lưu) bị bỏ qua.
 */
@Slf4j
@Service
public class FsrsService {

    /**
     * 17 tham số mặc định của FSRS-4.5 — chép từ wiki (mục FSRS-4.5, "Default parameters") và
     * khớp {@code Parameters.w} của py-fsrs v2.5.1.
     */
    private static final double[] DEFAULT_WEIGHTS = {
        /*w0  S0(Again)*/ 0.4872, /*w1  S0(Hard)*/ 1.4003, /*w2  S0(Good)*/ 3.7145, /*w3 S0(Easy)*/ 13.8206,
        /*w4  D0(Good)*/  5.1618, /*w5*/  1.2298, /*w6*/  0.8975, /*w7  mean reversion*/ 0.031,
        /*w8*/  1.6474,   /*w9*/  0.1367, /*w10*/ 1.0461,
        /*w11*/ 2.1072,   /*w12*/ 0.0793, /*w13*/ 0.3246, /*w14*/ 1.587,
        /*w15 hard penalty*/ 0.2272, /*w16 easy bonus*/ 2.8755
    };

    /** Số tham số của một vector FSRS-4.5 hợp lệ. */
    public static final int WEIGHT_COUNT = 17;

    /** Số mũ của đường cong quên FSRS-4.5. */
    static final double DECAY = -0.5;

    /** Hệ số của đường cong quên FSRS-4.5: 19/81, chọn sao cho R(S, S) = 0,9. */
    static final double FACTOR = 19.0 / 81.0;

    /**
     * Retention mục tiêu: xếp lịch sao cho xác suất nhớ lúc tới hạn là 90%. Dự án chưa có cấu
     * hình cho giá trị này; 0,9 cũng là mặc định của bản tham chiếu.
     */
    static final double TARGET_RETENTION = 0.9;

    /** Khoảng ôn tối đa (ngày) — như {@code maximum_interval} mặc định của bản tham chiếu. */
    static final int MAX_INTERVAL_DAYS = 36500;

    private static final double D_MIN = 1.0;
    private static final double D_MAX = 10.0;

    /** Sàn độ ổn định (ngày). */
    private static final double S_MIN = 0.1;

    private static final RoundingMode RM = RoundingMode.HALF_UP;

    // ─── Public API ───────────────────────────────────────────────────────────

    /** Bản sao của bộ 17 tham số mặc định FSRS-4.5. */
    public double[] defaultWeights() {
        return DEFAULT_WEIGHTS.clone();
    }

    /** {@code true} khi {@code weights} là vector FSRS-4.5 dùng được: đủ 17 phần tử, đều hữu hạn. */
    public static boolean isValidWeights(double[] weights) {
        if (weights == null || weights.length != WEIGHT_COUNT) return false;
        for (double v : weights) {
            if (!Double.isFinite(v)) return false;
        }
        return true;
    }

    /**
     * Đổi quality kiểu SM-2 (0–5) sang rating FSRS (1–4):
     * 0–1 → Again(1), 2 → Hard(2), 3–4 → Good(3), 5 → Easy(4).
     */
    public int mapSm2ToFsrs(int sm2Quality) {
        return switch (sm2Quality) {
            case 0, 1 -> 1; // Again
            case 2    -> 2; // Hard
            case 3, 4 -> 3; // Good
            case 5    -> 4; // Easy
            default   -> 3; // Good (mặc định an toàn)
        };
    }

    /** Khởi tạo thẻ mới (lần chấm đầu) bằng tham số mặc định, "bây giờ" là đồng hồ hệ thống. */
    public void initializeCard(VocabReviewSchedule card, int rating) {
        initializeCard(card, rating, DEFAULT_WEIGHTS, OffsetDateTime.now());
    }

    /** Khởi tạo thẻ mới (lần chấm đầu), "bây giờ" là đồng hồ hệ thống. */
    public void initializeCard(VocabReviewSchedule card, int rating, double[] weights) {
        initializeCard(card, rating, weights, OffsetDateTime.now());
    }

    /**
     * Khởi tạo thẻ mới (lần chấm đầu): S0, D0 theo rating; xếp lịch theo ngày.
     *
     * @param card    thẻ cần khởi tạo (sửa tại chỗ)
     * @param rating  rating FSRS 1–4
     * @param weights vector 17 tham số (của người dùng hoặc mặc định)
     * @param now     thời điểm chấm — ghi vào {@code lastReviewAt} và làm gốc cho {@code nextReviewAt}
     */
    public void initializeCard(VocabReviewSchedule card, int rating, double[] weights, OffsetDateTime now) {
        double[] w = safeWeights(weights);
        int g = clampRating(rating);

        double s0 = initStability(g, w);
        double d0 = initDifficulty(g, w);
        int intervalDays = nextInterval(s0);

        card.setStability(bd(s0, 4));
        card.setDifficulty(bd(d0, 2));
        card.setRetrievability(bd(1.0, 4)); // vừa chấm xong: t = 0
        card.setFsrsState(FsrsState.REVIEW.value);
        card.setAlgorithmVersion(VocabReviewSchedule.AlgorithmVersion.FSRS.name());
        card.setIntervalDays(intervalDays);
        card.setNextReviewAt(now.plusDays(intervalDays));
        card.setLastReviewAt(now);

        log.debug("[FSRS] Init card '{}': S={} D={} interval={}d",
                card.getGerman(), s0, d0, intervalDays);
    }

    /** Cập nhật lịch sau một lần ôn bằng tham số mặc định, "bây giờ" là đồng hồ hệ thống. */
    public void scheduleReview(VocabReviewSchedule card, int rating, long elapsedDays) {
        scheduleReview(card, rating, elapsedDays, DEFAULT_WEIGHTS, OffsetDateTime.now());
    }

    /** Cập nhật lịch sau một lần ôn, "bây giờ" là đồng hồ hệ thống. */
    public void scheduleReview(VocabReviewSchedule card, int rating, long elapsedDays, double[] weights) {
        scheduleReview(card, rating, elapsedDays, weights, OffsetDateTime.now());
    }

    /**
     * Cập nhật lịch sau một lần ôn của thẻ đã có trạng thái FSRS.
     *
     * @param card        thẻ cần cập nhật (sửa tại chỗ); đọc {@code stability}, {@code difficulty}
     * @param rating      rating FSRS 1–4
     * @param elapsedDays số ngày THẬT đã trôi kể từ lần ôn trước (người gọi phải tính TRƯỚC khi
     *                    ghi đè {@code lastReviewAt}); giá trị âm được coi là 0
     * @param weights     vector 17 tham số (của người dùng hoặc mặc định)
     * @param now         thời điểm chấm — ghi vào {@code lastReviewAt} và làm gốc cho {@code nextReviewAt}
     */
    public void scheduleReview(VocabReviewSchedule card, int rating, long elapsedDays,
                               double[] weights, OffsetDateTime now) {
        double[] w = safeWeights(weights);
        int g = clampRating(rating);
        long t = Math.max(0L, elapsedDays);

        double s = card.getStability() != null ? Math.max(card.getStability().doubleValue(), S_MIN) : initStability(3, w);
        double d = card.getDifficulty() != null ? clamp(card.getDifficulty().doubleValue(), D_MIN, D_MAX) : initDifficulty(3, w);
        double r = retrievability(s, t);

        double newS;
        if (g >= 2) { // Hard / Good / Easy → nhớ
            newS = stabilityAfterPass(s, d, r, g, w);
            card.setFsrsState(FsrsState.REVIEW.value);
        } else { // Again → quên
            // Chặn trên ở S cũ: quên thì độ ổn định không được tăng (xem Javadoc lớp).
            newS = Math.min(stabilityAfterFail(s, d, r, w), s);
            card.setFsrsState(FsrsState.RELEARNING.value);
        }
        // Sàn 0,1 ngày; trần 36500 ngày để không vượt kiểu cột NUMERIC(10,4).
        newS = clamp(newS, S_MIN, MAX_INTERVAL_DAYS);
        double newD = updateDifficulty(d, g, w);

        int intervalDays = nextInterval(newS);

        card.setStability(bd(newS, 4));
        card.setDifficulty(bd(newD, 2));
        card.setRetrievability(bd(r, 4));
        card.setAlgorithmVersion(VocabReviewSchedule.AlgorithmVersion.FSRS.name());
        card.setIntervalDays(intervalDays);
        card.setNextReviewAt(now.plusDays(intervalDays));
        card.setLastReviewAt(now);

        log.debug("[FSRS] Review '{}' rating={} elapsed={}d: S={}->{} D={}->{} R={} interval={}d",
                card.getGerman(), g, t, s, newS, d, newD, r, intervalDays);
    }

    /**
     * Retrievability hiện tại của thẻ (không sửa thẻ) — cho thống kê/dự báo.
     *
     * @return R ∈ [0, 1]; 1,0 nếu thẻ chưa từng được ôn
     */
    public double computeCurrentRetrievability(VocabReviewSchedule card, OffsetDateTime now) {
        if (card.getStability() == null || card.getLastReviewAt() == null) return 1.0;
        long elapsed = Math.max(0L, java.time.Duration.between(card.getLastReviewAt(), now).toDays());
        return retrievability(card.getStability().doubleValue(), elapsed);
    }

    // ─── Công thức FSRS-4.5 ───────────────────────────────────────────────────

    /** S0(G) = max(w[G−1], 0,1). */
    double initStability(int rating, double[] w) {
        return Math.max(w[rating - 1], S_MIN);
    }

    /** D0(G) = clamp(w4 − (G−3)·w5, 1, 10). */
    double initDifficulty(int rating, double[] w) {
        return clamp(w[4] - (rating - 3.0) * w[5], D_MIN, D_MAX);
    }

    /** R(t,S) = (1 + FACTOR·t/S)^DECAY — bằng 0,9 khi t = S. */
    double retrievability(double stability, long elapsedDays) {
        if (stability <= 0) return 0.0;
        return Math.pow(1.0 + FACTOR * elapsedDays / stability, DECAY);
    }

    /**
     * I(r,S) = S/FACTOR · (r^(1/DECAY) − 1), làm tròn, kẹp trong [1, 36500] ngày.
     * Với retention mục tiêu 0,9 thì I = S.
     */
    int nextInterval(double stability) {
        double interval = stability / FACTOR * (Math.pow(TARGET_RETENTION, 1.0 / DECAY) - 1.0);
        long rounded = Math.round(interval);
        return (int) Math.min(Math.max(rounded, 1L), MAX_INTERVAL_DAYS);
    }

    /**
     * Độ ổn định sau khi nhớ (Hard/Good/Easy):
     * S' = S·(1 + e^w8·(11−D)·S^(−w9)·(e^(w10·(1−R)) − 1)·hardPenalty·easyBonus),
     * hardPenalty = w15 khi Hard, easyBonus = w16 khi Easy.
     */
    double stabilityAfterPass(double s, double d, double r, int rating, double[] w) {
        double hardPenalty = (rating == 2) ? w[15] : 1.0;
        double easyBonus   = (rating == 4) ? w[16] : 1.0;
        return s * (1.0
                + Math.exp(w[8])
                * (11.0 - d)
                * Math.pow(s, -w[9])
                * (Math.exp((1.0 - r) * w[10]) - 1.0)
                * hardPenalty
                * easyBonus);
    }

    /** Độ ổn định sau khi quên (Again): S' = w11·D^(−w12)·((S+1)^w13 − 1)·e^(w14·(1−R)). */
    double stabilityAfterFail(double s, double d, double r, double[] w) {
        return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1.0, w[13]) - 1.0) * Math.exp((1.0 - r) * w[14]);
    }

    /** D' = clamp(w7·D0(3) + (1−w7)·(D − w6·(G−3)), 1, 10) — mean reversion về D0(Good) = w4. */
    double updateDifficulty(double d, int rating, double[] w) {
        double next = d - w[6] * (rating - 3.0);
        return clamp(w[7] * w[4] + (1.0 - w[7]) * next, D_MIN, D_MAX);
    }

    // ─── Tiện ích ─────────────────────────────────────────────────────────────

    /** Trả {@code weights} nếu hợp lệ (17 phần tử, hữu hạn); ngược lại dùng mặc định. */
    private double[] safeWeights(double[] weights) {
        return isValidWeights(weights) ? weights : DEFAULT_WEIGHTS;
    }

    private int clampRating(int r) {
        return Math.max(1, Math.min(4, r));
    }

    private double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private BigDecimal bd(double v, int scale) {
        return BigDecimal.valueOf(v).setScale(scale, RM);
    }
}
