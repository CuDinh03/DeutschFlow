package com.deutschflow.feedback.service;

import com.deutschflow.common.exception.BadRequestException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * Kiểm và mã hoá lại ảnh chụp màn hình của góp ý (BR-03, NFR-03).
 *
 * <ul>
 *   <li>Kiểu ảnh xác định bằng <b>byte đầu file</b>, không tin {@code Content-Type} hay đuôi file.</li>
 *   <li>Đọc kích thước TRƯỚC khi giải mã, để ảnh "bom giải nén" bị chặn mà không tốn bộ nhớ.</li>
 *   <li>Giải mã rồi mã hoá lại: file lưu chỉ còn điểm ảnh, mất hết EXIF/GPS và mọi khối lạ đi kèm.</li>
 * </ul>
 *
 * <p>Server nhận PNG và JPEG. JDK không giải mã được WebP, nên trình duyệt tự đổi WebP sang JPEG trước
 * khi tải lên (trang Góp ý); người dùng vẫn chọn được ảnh WebP.
 */
public final class FeedbackImageProcessor {

    public static final int MAX_BYTES = 5 * 1024 * 1024;
    public static final int MAX_EDGE = 8000;
    public static final long MAX_PIXELS = 40_000_000L;
    static final String WRONG_TYPE = "Ảnh phải là PNG, JPEG hoặc WebP, tối đa 5 MB.";
    static final String TOO_LARGE = "Ảnh quá lớn. Cạnh dài tối đa 8000 điểm ảnh.";

    public enum Format {
        PNG("png", "image/png"), JPEG("jpg", "image/jpeg");

        final String extension;
        final String contentType;

        Format(String extension, String contentType) {
            this.extension = extension;
            this.contentType = contentType;
        }

        public String extension() {
            return extension;
        }

        public String contentType() {
            return contentType;
        }
    }

    public record Processed(byte[] bytes, Format format, int width, int height) {}

    private FeedbackImageProcessor() {}

    /** Nhận dạng theo byte đầu; {@code null} khi không phải PNG/JPEG. */
    public static Format sniff(byte[] data) {
        if (data == null || data.length < 8) return null;
        if ((data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G'
                && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) {
            return Format.PNG;
        }
        if ((data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
            return Format.JPEG;
        }
        return null;
    }

    public static Processed process(byte[] data) {
        if (data == null || data.length == 0 || data.length > MAX_BYTES) {
            throw new BadRequestException(WRONG_TYPE);
        }
        Format format = sniff(data);
        if (format == null) {
            throw new BadRequestException(WRONG_TYPE);
        }
        BufferedImage image = decodeBounded(data);
        BufferedImage clean = format == Format.JPEG ? toRgb(image) : image;
        byte[] out = encode(clean, format);
        return new Processed(out, format, clean.getWidth(), clean.getHeight());
    }

    private static BufferedImage decodeBounded(byte[] data) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new BadRequestException(WRONG_TYPE);
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                int w = reader.getWidth(0);
                int h = reader.getHeight(0);
                if (w <= 0 || h <= 0 || w > MAX_EDGE || h > MAX_EDGE || (long) w * h > MAX_PIXELS) {
                    throw new BadRequestException(TOO_LARGE);
                }
                BufferedImage image = reader.read(0);
                if (image == null) {
                    throw new BadRequestException(WRONG_TYPE);
                }
                return image;
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof BadRequestException bad) throw bad;
            // File hỏng, JPEG CMYK, PNG cắt cụt… đều về một câu cho người dùng.
            throw new BadRequestException(WRONG_TYPE);
        }
    }

    /** JPEG không có kênh alpha; đưa về RGB thuần để bộ ghi không từ chối. */
    private static BufferedImage toRgb(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) return src;
        BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        var g = rgb.createGraphics();
        try {
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, src.getWidth(), src.getHeight());
            g.drawImage(src, 0, 0, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    private static byte[] encode(BufferedImage image, Format format) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            if (format == Format.PNG) {
                if (!ImageIO.write(image, "png", bytes)) throw new IllegalStateException("no PNG writer");
                return bytes.toByteArray();
            }
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            try (ImageOutputStream out = ImageIO.createImageOutputStream(bytes)) {
                writer.setOutput(out);
                ImageWriteParam param = writer.getDefaultWriteParam();
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(0.88f);
                // Không truyền metadata ⇒ file mới không mang EXIF/GPS của file gốc.
                writer.write(null, new IIOImage(image, null, null), param);
            } finally {
                writer.dispose();
            }
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Không mã hoá lại được ảnh góp ý", e);
        }
    }
}
