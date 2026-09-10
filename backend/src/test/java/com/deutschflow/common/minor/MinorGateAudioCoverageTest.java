package com.deutschflow.common.minor;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CA CHỐNG HỒI QUY ĐẾM ĐIỂM CẮM — sót một đường ghi âm là FAIL-OPEN IM LẶNG, và một ca đếm là thứ
 * DUY NHẤT bắt được nó.
 *
 * <p><b>Vì sao phải quét mã nguồn thay vì test hành vi.</b> Ca hành vi chỉ kiểm được đường mà nó
 * gọi tới. Rủi ro thật ở đây không phải "gate tính sai" — {@code MinorGateTest} lo việc đó — mà là
 * "có một đường ghi âm THỨ BẢY không ai cắm gate". Không đường test hành vi nào phát hiện được sự
 * VẮNG MẶT của một lời gọi ở một tệp chưa ai nghĩ tới; chỉ có kiểm kê trên toàn cây nguồn mới thấy.
 * Và cái giá của việc sót là im lặng tuyệt đối: mọi thứ vẫn chạy, chỉ là giọng nói của một đứa trẻ
 * chưa có đồng ý đi thẳng ra nhà cung cấp bên ngoài.
 *
 * <p><b>Hai chiều, cố ý thừa.</b> {@link #dungSoDiemCamGate()} khoá phía CUNG (gate nằm ở đâu);
 * {@link #moiDuongPhienAmDeuCoGate()} khoá phía CẦU (chỗ nào gửi audio đi). Chỉ có chiều thứ nhất
 * thì thêm một endpoint phiên âm mới vẫn xanh; chỉ có chiều thứ hai thì gỡ một lời gọi gate ở tệp
 * đã khai báo vẫn xanh. Thêm một đường mới ⇒ phải sửa CẢ HAI bảng dưới đây, và lúc sửa thì buộc
 * phải trả lời "gate của đường này đâu".
 *
 * <p>🪤 Khi ca này đỏ, ĐỪNG sửa bảng cho hết đỏ. Đọc tệp mới xuất hiện trước: nếu nó gửi audio ra
 * ngoài thì việc cần làm là cắm gate, không phải thêm một dòng vào danh sách.
 */
@DisplayName("MinorGate — kiểm kê điểm cắm trên đường ghi âm (DEC-22)")
class MinorGateAudioCoverageTest {

    /** Surefire chạy với thư mục làm việc là {@code backend/} — cùng quy ước với các ca đọc migration. */
    private static final Path MAIN_SOURCES = Path.of("src/main/java/com/deutschflow");

    /** Lời gọi gate. Đòi dấu chấm phía trước để không đếm nhầm chính khai báo trong {@code MinorGate}. */
    private static final Pattern GATE_CALL = Pattern.compile("\\.\\s*assertAudioAllowed\\s*\\(");

    /**
     * Lời gọi phiên âm — nơi audio THẬT SỰ rời khỏi hệ thống. Cũng đòi dấu chấm phía trước để bỏ
     * qua các khai báo {@code public ... transcribeVerbose(...)} trong chính client Whisper.
     */
    private static final Pattern TRANSCRIBE_CALL =
            Pattern.compile("\\.\\s*transcribe(?:Verbose|Text|WithTimestamps)?\\s*\\(");

    /**
     * BẢY điểm cắm, kèm số lời gọi mong đợi ở mỗi tệp: sáu đường PHIÊN ÂM của PR-1B, cộng một đường
     * LƯU TRỮ (tệp ghi âm nộp bài lên S3 — V320 §4 ghi nợ, C8a trả). Đường lưu trữ không gọi
     * Whisper nên không có mặt ở {@link #DUONG_PHIEN_AM_VA_GATE}; nó vẫn phải nằm ở đây vì gỡ lời gọi
     * gate khỏi nó là fail-open y như sáu đường kia — giọng nói của trẻ vẫn rời khỏi máy, chỉ là tới
     * kho của mình thay vì tới nhà cung cấp AI.
     */
    private static final Map<String, Integer> DIEM_CAM_GATE = new LinkedHashMap<>(Map.of(
            // Nhận dạng giọng nói dùng chung (/api/ai-speaking/transcribe).
            "speaking/controller/AiSessionController.java", 1,
            // Luyện phát âm — đường đồng bộ (/api/speaking/pronunciation-check).
            "speaking/controller/PronunciationController.java", 1,
            // Luyện phát âm — Phoneme Coach (/api/phoneme/evaluate).
            "phoneme/controller/PhonemeController.java", 1,
            // Đánh giá phát âm trong cây kỹ năng (/api/skill-tree/evaluate-pronunciation).
            "curriculum/controller/SkillTreeController.java", 1,
            // Thi nói — lượt nói dạng audio. Cắm ở SERVICE vì controller còn đi qua idempotency.
            "examspeaking/session/ExamSessionService.java", 1,
            // Luyện phát âm — đường HÀNG ĐỢI (/api/jobs/pronunciation-eval). Gate ở lúc enqueue:
            // worker chạy ở luồng nền, không còn request nào để trả 403 về cho người dùng.
            "ai/queue/AiJobController.java", 1,
            // Nộp bài — URL tải lên tệp ghi âm/video (/api/v2/students/assignments/presigned-url).
            // Gate TRƯỚC khi ký URL, chỉ với MIME audio/* và video/*; ảnh/PDF/text đi qua tự do.
            "user/controller/StudentAssignmentController.java", 1
    ));

    /**
     * Mọi tệp GỬI AUDIO ĐI, ánh xạ sang tệp CHẶN nó. Với tệp tự chặn lấy mình thì hai bên trùng nhau;
     * với service/worker thì gate nằm ở cửa vào tương ứng, và ánh xạ này chính là chỗ ghi lại lý do.
     */
    private static final Map<String, String> DUONG_PHIEN_AM_VA_GATE = new LinkedHashMap<>(Map.of(
            "speaking/controller/AiSessionController.java",
            "speaking/controller/AiSessionController.java",

            "curriculum/controller/SkillTreeController.java",
            "curriculum/controller/SkillTreeController.java",

            "examspeaking/session/ExamSessionService.java",
            "examspeaking/session/ExamSessionService.java",

            // Service không có principal; cửa vào duy nhất là controller phía trên nó.
            "phoneme/service/PhonemeService.java",
            "phoneme/controller/PhonemeController.java",

            "speaking/service/PronunciationScorerService.java",
            "speaking/controller/PronunciationController.java",

            // Worker chạy ở luồng nền sau khi job đã nằm trong hàng đợi — chặn phải xảy ra ở enqueue.
            "ai/queue/AiJobWorker.java",
            "ai/queue/AiJobController.java"
    ));

    @Test
    @DisplayName("số điểm gọi MinorGate khớp đúng bảng kiểm kê — không thừa, không thiếu")
    void dungSoDiemCamGate() {
        assertThat(demTheoTep(GATE_CALL))
                .as("""
                        Điểm gọi minorGate.assertAudioAllowed(...) trong src/main.
                        THIẾU một tệp = đường ghi âm đó đang fail-open.
                        THỪA một tệp = có đường mới; hãy thêm nó vào CẢ hai bảng của ca này.""")
                .containsExactlyInAnyOrderEntriesOf(new TreeMap<>(DIEM_CAM_GATE));
    }

    @Test
    @DisplayName("mọi tệp gửi audio ra nhà cung cấp AI đều có một gate đứng trước")
    void moiDuongPhienAmDeuCoGate() {
        assertThat(demTheoTep(TRANSCRIBE_CALL).keySet())
                .as("""
                        Tệp gọi Whisper/STT trong src/main. Xuất hiện một tệp lạ nghĩa là vừa có thêm
                        một đường audio đi ra ngoài — việc cần làm là cắm MinorGate cho nó, KHÔNG
                        phải thêm một dòng vào bảng cho hết đỏ.""")
                .containsExactlyInAnyOrderElementsOf(DUONG_PHIEN_AM_VA_GATE.keySet());
    }

    @Test
    @DisplayName("mỗi đường phiên âm trỏ tới một tệp CÓ THẬT trong bảng điểm cắm")
    void anhXaGateKhongTroVaoHuKhong() {
        // Buộc hai bảng dính nhau: gỡ một điểm cắm mà quên sửa ánh xạ (hoặc ngược lại) là đỏ ngay,
        // thay vì để lại một ánh xạ trỏ tới một tệp không còn gate nào.
        assertThat(DIEM_CAM_GATE.keySet())
                .as("mọi tệp được viện dẫn làm nơi chặn đều phải thật sự gọi gate")
                .containsAll(DUONG_PHIEN_AM_VA_GATE.values());
    }

    /** Đếm số lần {@code pattern} khớp, theo từng tệp .java, bỏ qua tệp không khớp lần nào. */
    private static Map<String, Integer> demTheoTep(Pattern pattern) {
        Map<String, Integer> found = new TreeMap<>();
        try (Stream<Path> files = Files.walk(MAIN_SOURCES)) {
            files.filter(p -> p.toString().endsWith(".java"))
                    // MinorGate tự khai báo hàm; đếm nó vào là đếm chính cái cổng như một điểm cắm.
                    .filter(p -> !p.endsWith("common/minor/MinorGate.java"))
                    .forEach(p -> {
                        int n = dem(pattern, doc(p));
                        if (n > 0) {
                            found.put(MAIN_SOURCES.relativize(p).toString(), n);
                        }
                    });
        } catch (IOException e) {
            throw new UncheckedIOException("Không quét được " + MAIN_SOURCES.toAbsolutePath(), e);
        }
        return found;
    }

    private static int dem(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        int n = 0;
        while (m.find()) {
            n++;
        }
        return n;
    }

    private static String doc(Path p) {
        try {
            return Files.readString(p, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Không đọc được " + p, e);
        }
    }
}
