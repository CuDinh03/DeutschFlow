package com.deutschflow.common.retention;

import com.deutschflow.common.minor.MinorPolicy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * PHẦN QUYẾT ĐỊNH của job dọn bản ghi âm trẻ vị thành niên: cho một danh sách ứng viên và một thời
 * điểm, trả lời "cái nào bị xoá, cái nào giữ, cái nào không phân loại được".
 *
 * <p><b>Vì sao tách khỏi job.</b> Đây là một job XOÁ KHÔNG HOÀN LẠI, và phần dễ sai nhất của nó
 * không phải câu DELETE mà là phép so tuổi. Tách ra thành một lớp thuần — không Spring, không
 * JdbcTemplate, không S3, không đồng hồ hệ thống — thì luật đó kiểm được bằng ca test chạy trong
 * mili-giây, và một lần sửa luật không kéo theo cả context. Cùng lối với
 * {@code UserNotificationRetentionJob} tách phần {@code @Transactional} ra service, chỉ khác lý do:
 * ở đó là proxy, ở đây là khả năng kiểm chứng.
 *
 * <p><b>Ba luật, theo đúng thứ tự này:</b>
 * <ol>
 *   <li><b>Đủ cũ chưa.</b> {@code capturedAt} phải trước {@code now - retentionDays}. Câu SQL nạp ứng
 *       viên đã lọc rồi; kiểm lại ở đây là phòng vệ nhiều lớp, vì một lần sửa câu SQL mà quên mệnh đề
 *       thời gian sẽ biến job này thành "xoá mọi bản ghi âm của trẻ ngay lập tức".</li>
 *   <li><b>Chưa thành niên TẠI THỜI ĐIỂM THU.</b> {@link MinorPolicy#statusAt} với chính
 *       {@code capturedAt}, KHÔNG phải {@code statusOf} (tuổi hôm nay). Một em thu bản ghi lúc 17
 *       tuổi, nay 18, vẫn phải dọn: nghĩa vụ gắn với dữ liệu lúc nó được tạo ra, không gắn với tình
 *       trạng hôm nay của chủ thể.</li>
 *   <li><b>UNKNOWN thì KHÔNG dọn.</b> Chưa khai ngày sinh nghĩa là chưa xác lập được đây có phải dữ
 *       liệu trẻ em hay không. Xoá trong tình trạng đó là đánh đổi sai chiều: giữ nhầm dữ liệu người
 *       lớn thêm một thời gian là việc sửa được, xoá nhầm bản ghi âm của người lớn là mất vĩnh viễn.
 *       Nhưng nhóm này KHÔNG được im lặng — nó là KHOẢNG MÙ của job, và
 *       {@link MinorAudioRetentionService} phải {@code log.warn} số lượng mỗi lượt chạy. Khoảng mù
 *       co lại khi trung tâm nhập đủ ngày sinh; muốn nó co lại thì phải đo được.</li>
 * </ol>
 *
 * <p>🪤 <b>Không gọi {@code Instant.now()} bên trong.</b> Thời điểm đánh giá là tham số. Bẫy đã ghi
 * trong repo: "test ngày cứng + {@code now()} tự đỏ theo lịch" — một planner tự đọc đồng hồ thì ca
 * test biên tuổi sẽ xanh hôm nay và đỏ vào một ngày nào đó không ai đoán được.
 */
public final class MinorAudioRetentionPlanner {

    private final MinorPolicy minorPolicy;
    private final int retentionDays;

    public MinorAudioRetentionPlanner(MinorPolicy minorPolicy, int retentionDays) {
        if (minorPolicy == null) {
            throw new IllegalArgumentException("MinorAudioRetentionPlanner cần MinorPolicy");
        }
        if (retentionDays < 1) {
            // Hạn 0 ngày = xoá bản ghi âm ngay khi vừa thu. Đó không phải một cấu hình, đó là một sự
            // cố — chặn ngay lúc dựng, cùng lối fail-fast với ràng buộc `legal <= center` của
            // MinorPolicy và với MinorGate.parsePolicy.
            throw new IllegalArgumentException(
                    "app.minor.audio-retention-days = " + retentionDays + " không hợp lệ — phải >= 1 ngày");
        }
        this.minorPolicy = minorPolicy;
        this.retentionDays = retentionDays;
    }

    /** Mốc thời gian: mọi bản ghi thu TRƯỚC thời điểm này là đã qua hạn lưu. */
    public Instant cutoff(Instant now) {
        return now.minus(retentionDays, ChronoUnit.DAYS);
    }

    public int retentionDays() {
        return retentionDays;
    }

    /**
     * Phân loại toàn bộ ứng viên. Không xoá gì, không đọc gì ngoài tham số truyền vào.
     *
     * @param candidates ứng viên đã nạp từ ba kho
     * @param now        thời điểm chạy — truyền vào để ca test ghim được, xem javadoc lớp
     */
    public Plan plan(List<MinorAudioCandidate> candidates, Instant now) {
        Instant cutoff = cutoff(now);
        List<MinorAudioCandidate> due = new ArrayList<>();
        List<MinorAudioCandidate> unclassified = new ArrayList<>();
        int keptAdult = 0;
        int keptTooRecent = 0;
        int keptMalformed = 0;

        for (MinorAudioCandidate c : candidates == null ? List.<MinorAudioCandidate>of() : candidates) {
            if (c == null || !c.isWellFormed()) {
                // Không biết chủ thể là ai hoặc không biết thu lúc nào ⇒ không chứng minh được gì.
                // Cùng chiều đánh đổi với UNKNOWN: giữ lại.
                keptMalformed++;
                continue;
            }
            if (!c.capturedAt().isBefore(cutoff)) {
                keptTooRecent++;
                continue;
            }
            MinorPolicy.Status status = minorPolicy.statusAt(c.birthDate(), c.capturedAt());
            switch (status) {
                case UNKNOWN -> unclassified.add(c);
                case MINOR_LEGAL, MINOR_CENTER_POLICY -> due.add(c);
                case ADULT -> keptAdult++;
            }
        }
        return new Plan(List.copyOf(due), List.copyOf(unclassified), keptAdult, keptTooRecent, keptMalformed);
    }

    /**
     * Kết quả phân loại.
     *
     * @param due           sẽ bị xoá — chủ thể chưa thành niên TẠI THỜI ĐIỂM THU và đã qua hạn lưu
     * @param unclassified  KHÔNG xoá vì chưa khai ngày sinh; trả về cả danh sách (không chỉ số đếm) để
     *                      {@link MinorAudioRetentionService} quy được khoảng mù về từng trung tâm
     * @param keptAdult     giữ vì chủ thể đã đủ tuổi lúc thu
     * @param keptTooRecent giữ vì chưa qua hạn lưu
     * @param keptMalformed giữ vì dòng dữ liệu thiếu chủ thể hoặc thiếu thời điểm thu
     */
    public record Plan(
            List<MinorAudioCandidate> due,
            List<MinorAudioCandidate> unclassified,
            int keptAdult,
            int keptTooRecent,
            int keptMalformed
    ) {
        public int unclassifiedCount() {
            return unclassified.size();
        }

        public int dueCount() {
            return due.size();
        }
    }
}
