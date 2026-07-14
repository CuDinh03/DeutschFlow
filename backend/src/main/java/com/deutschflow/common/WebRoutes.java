package com.deutschflow.common;

/**
 * Đường dẫn trang WEB (frontend) mà backend nhúng vào dữ liệu trả về hoặc vào email.
 *
 * <p>Vì sao tồn tại: các path này từng nằm rải rác dưới dạng chuỗi literal trong nhiều service. Hệ quả
 * là chúng âm thầm lệch khỏi frontend mà không ai biết — {@code /vocabulary/review} và
 * {@code /speaking/drill} nằm trong API suốt thời gian dài dù KHÔNG CÓ trang nào như vậy ở bất kỳ
 * phiên bản giao diện nào (bấm vào là 404). Gom về một chỗ để lần sau frontend đổi route thì chỉ phải
 * sửa một file, và để việc sửa đó nhìn thấy được trong code review.
 *
 * <p><b>Đây là đường dẫn của cây giao diện v2 ("Galerie")</b> — bề mặt mặc định. Cây v1 legacy đang
 * được gỡ bỏ theo {@code plans/2026-07-14-xoa-sach-v1-web.md}.
 *
 * <p>⚠️ <b>THỨ TỰ DEPLOY:</b> các route {@code /v2/...} dưới đây chỉ tồn tại sau khi frontend đợt 1
 * lên prod. KHÔNG deploy backend mang file này ra trước frontend đó — nếu không, mọi link sinh ra sẽ
 * trỏ vào route chưa tồn tại.
 */
public final class WebRoutes {

    private WebRoutes() {
    }

    /**
     * Trang nhận lời mời vào tổ chức — CÔNG KHAI (người nhận thường chưa có tài khoản), token nằm ở
     * query string.
     *
     * <p>⚠️ Email ĐÃ GỬI là BẤT BIẾN. Mọi lời mời phát trước 2026-07-15 vẫn trỏ {@code /org/accept},
     * nên redirect {@code /org/accept → /v2/org/accept} (giữ nguyên {@code ?token=}) phải sống VĨNH
     * VIỄN ở tầng web, kể cả sau khi cây v1 bị xoá.
     */
    public static final String ORG_ACCEPT_INVITE = "/v2/org/accept";

    /** Lộ trình học của học viên. */
    public static final String STUDENT_ROADMAP = "/v2/student/roadmap";

    /**
     * Màn chọn chủ đề/bạn đồng hành trước khi vào hội thoại nói. Đây là điểm vào ĐÚNG cho mọi gợi ý
     * luyện nói: nó đọc {@code ?topic=}, {@code ?cefr=} và {@code ?focus=} rồi mới mở engine hội thoại.
     */
    public static final String STUDENT_SPEAKING_SETUP = "/v2/student/speaking/setup";

    /** Trang chủ khu luyện nói (danh sách chế độ). Dùng khi không có gợi ý cụ thể để truyền vào. */
    public static final String STUDENT_SPEAKING = "/v2/student/speaking";

    /** Ôn tập: gộp từ vựng tới hạn (FSRS) và các bài sửa lỗi tới hạn. */
    public static final String STUDENT_REVIEW = "/v2/student/review";

    /** Sổ từ vựng của học viên. */
    public static final String STUDENT_VOCABULARY = "/v2/student/vocabulary";
}
