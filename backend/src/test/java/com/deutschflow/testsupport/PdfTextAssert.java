package com.deutschflow.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * So khớp chuỗi trên văn bản trích từ PDF, KHÔNG phụ thuộc chỗ ngắt dòng của bố cục.
 *
 * <p><b>Vì sao cần.</b> {@code PDFTextStripper} trả về văn bản đã ngắt dòng theo đúng bố cục thật
 * của trang, nên một chuỗi liền mạch trong mã nguồn có thể bị cắt làm đôi trong kết quả trích. Khi
 * dữ liệu dựng sẵn của test sinh ngẫu nhiên (tên lớp, tên giáo viên, token), độ rộng dòng đổi theo
 * từng lần chạy và phép {@code contains} thường sẽ đỏ **ngẫu nhiên**. Quan sát thật trên CI
 * 15/09/2026 (PR #661):
 *
 * <pre>
 * Expecting actual:
 *   "TT Phiếu e61285 DEUTSCHFLOW …"
 * to contain:
 *   "TT Phiếu ffe61285"
 * </pre>
 *
 * Hai ký tự {@code ff} nằm ở dòng trước — mã phiếu bị gãy dòng, không phải lỗi sinh PDF.
 *
 * <p><b>Dấu hiệu nhận diện họ lỗi này:</b> phần "actual" có chứa ĐUÔI của chuỗi trong phần
 * "to contain".
 *
 * <p><b>Phép kiểm KHÔNG bị nới lỏng.</b> Chuỗi vẫn phải có mặt; chỉ khoảng trắng giữa các ký tự là
 * được bỏ qua. Riêng {@link #doesNotContain} còn NGHIÊM hơn trước: nó kiểm trên cả bản gốc lẫn bản
 * đã bỏ khoảng trắng, nên một bí mật bị ngắt dòng giữa chừng vẫn bị bắt — trước đây thì lọt.
 */
public final class PdfTextAssert {

    /** Độ dài văn bản gốc in kèm khi thất bại; đủ để đọc mà không ngập màn hình. */
    private static final int PREVIEW = 1200;

    private final String raw;
    private final String flat;

    private PdfTextAssert(String pdfText) {
        this.raw = pdfText == null ? "" : pdfText;
        this.flat = flatten(this.raw);
    }

    public static PdfTextAssert assertThatPdfText(String pdfText) {
        return new PdfTextAssert(pdfText);
    }

    /** Bỏ MỌI khoảng trắng (gồm xuống dòng) để phép so không dính vào bố cục trang. */
    public static String flatten(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }

    public PdfTextAssert contains(String... needles) {
        for (String needle : needles) {
            assertThat(flat)
                    .as("PDF phải chứa \"%s\" (so sau khi bỏ khoảng trắng — xem PdfTextAssert).%nVăn bản PDF:%n%s",
                            needle, preview())
                    .contains(flatten(needle));
        }
        return this;
    }

    /**
     * Kiểm trên CẢ bản gốc lẫn bản đã bỏ khoảng trắng. Bản thứ hai mới là bản nghiêm: một chuỗi bị
     * ngắt dòng giữa chừng sẽ lọt phép kiểm trên bản gốc.
     */
    public PdfTextAssert doesNotContain(String... needles) {
        for (String needle : needles) {
            assertThat(raw)
                    .as("PDF KHÔNG được chứa \"%s\".%nVăn bản PDF:%n%s", needle, preview())
                    .doesNotContain(needle);
            assertThat(flat)
                    .as("PDF KHÔNG được chứa \"%s\" — kể cả khi bị ngắt dòng giữa chừng.%nVăn bản PDF:%n%s",
                            needle, preview())
                    .doesNotContain(flatten(needle));
        }
        return this;
    }

    private String preview() {
        return raw.length() <= PREVIEW ? raw : raw.substring(0, PREVIEW) + "… (còn " + (raw.length() - PREVIEW) + " ký tự)";
    }
}
