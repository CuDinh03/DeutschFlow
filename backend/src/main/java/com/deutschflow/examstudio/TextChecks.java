package com.deutschflow.examstudio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;

/**
 * Kiểm văn bản thuần (0 token): đếm từ, hash cụm 6 từ để kiểm chép nguyên văn, ngắt dòng cho bài đọc.
 *
 * <p>Vì sao hash thay vì lưu bài gốc: luật nguồn (07/11) cấm giữ văn bản báo có bản quyền. Hash 64 bit
 * của từng cụm {@value TeilSpec#OVERLAP_LIMIT} từ đủ để biết bài mới có trùng cụm nào không, mà không
 * dựng lại được bài gốc.
 */
public final class TextChecks {

    private TextChecks() {}

    public static List<String> words(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(text.split("[^\\p{L}\\p{N}]+"))
                .filter(t -> !t.isBlank())
                .toList();
    }

    public static int wordCount(String text) {
        return words(text).size();
    }

    static long gramHash(List<String> lowerWords, int from, int n) {
        String gram = String.join(" ", lowerWords.subList(from, from + n));
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(gram.getBytes(StandardCharsets.UTF_8));
            long h = 0;
            for (int i = 0; i < 8; i++) h = (h << 8) | (d[i] & 0xff);
            return h;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static List<String> lower(List<String> ws) {
        return ws.stream().map(w -> w.toLowerCase(Locale.ROOT)).toList();
    }

    /** Hash mọi cụm n từ liên tiếp của bài gốc (đã sắp, không trùng). */
    public static List<Long> shingleHashes(String sourceText, int n) {
        List<String> ws = lower(words(sourceText));
        Set<Long> out = new TreeSet<>();
        for (int i = 0; i + n <= ws.size(); i++) out.add(gramHash(ws, i, n));
        return new ArrayList<>(out);
    }

    /** Kết quả kiểm chép: đoạn trùng dài nhất (số từ) và các đoạn trùng trong BÀI MỚI. */
    public record Overlap(int maxRun, List<String> snippets) {}

    public static Overlap overlap(String newText, Set<Long> sourceHashes, int n) {
        List<String> original = words(newText);
        List<String> ws = lower(original);
        if (sourceHashes.isEmpty() || ws.size() < n) return new Overlap(0, List.of());
        boolean[] covered = new boolean[ws.size()];
        for (int i = 0; i + n <= ws.size(); i++) {
            if (sourceHashes.contains(gramHash(ws, i, n))) {
                for (int k = i; k < i + n; k++) covered[k] = true;
            }
        }
        int maxRun = 0;
        List<String> snippets = new ArrayList<>();
        int i = 0;
        while (i < covered.length) {
            if (!covered[i]) {
                i++;
                continue;
            }
            int j = i;
            while (j < covered.length && covered[j]) j++;
            maxRun = Math.max(maxRun, j - i);
            snippets.add(String.join(" ", original.subList(i, j)));
            i = j;
        }
        return new Overlap(maxRun, snippets);
    }

    /** Tỉ lệ cụm n từ của bài a có trong tập hash của bài b — dùng để chặn Teil trùng kho. */
    public static double containment(String a, Set<Long> bHashes, int n) {
        List<String> ws = lower(words(a));
        int total = 0;
        int hit = 0;
        for (int i = 0; i + n <= ws.size(); i++) {
            total++;
            if (bHashes.contains(gramHash(ws, i, n))) hit++;
        }
        return total == 0 ? 0 : (double) hit / total;
    }

    /** Ngắt mỗi đoạn thành dòng ≤ width ký tự (bài đọc telc in số dòng, khoá {@code context_lines}). */
    public static String wrap(String text, int width) {
        if (text == null) return "";
        List<String> out = new ArrayList<>();
        for (String para : text.replace("\r\n", "\n").split("\n\\s*\n")) {
            String flat = para.replaceAll("\\s+", " ").trim();
            if (flat.isEmpty()) continue;
            StringBuilder line = new StringBuilder();
            List<String> lines = new ArrayList<>();
            for (String w : flat.split(" ")) {
                if (line.length() > 0 && line.length() + 1 + w.length() > width) {
                    lines.add(line.toString());
                    line.setLength(0);
                }
                if (line.length() > 0) line.append(' ');
                line.append(w);
            }
            if (line.length() > 0) lines.add(line.toString());
            out.add(String.join("\n", lines));
        }
        return String.join("\n\n", out);
    }

    /** Các đoạn của bài (cách nhau bằng dòng trống), đã gộp dòng. */
    public static List<String> paragraphs(String text) {
        if (text == null) return List.of();
        List<String> out = new ArrayList<>();
        for (String para : text.replace("\r\n", "\n").split("\n\\s*\n")) {
            String flat = para.replaceAll("\\s+", " ").trim();
            if (!flat.isEmpty()) out.add(flat);
        }
        return out;
    }

    public static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static Set<Long> toSet(List<? extends Number> hashes) {
        Set<Long> s = new HashSet<>();
        if (hashes != null) for (Number h : hashes) s.add(h.longValue());
        return s;
    }
}
