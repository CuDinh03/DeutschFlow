package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.ParticipantBundle;
import com.deutschflow.examspeaking.api.model.Utterance;

/**
 * Tín hiệu ĐẾM ĐƯỢC về mức tham gia hội thoại của thí sinh trong một Teil.
 *
 * <p><b>Vì sao cần.</b> telc chấm „Aufgabenbewältigung" theo <i>Gesprächsbeteiligung</i> — và chính
 * tài liệu ôn thi cảnh báo Teil 2 rất dễ biến thành đơn phương nếu thí sinh học thuộc phần chuẩn bị
 * rồi đọc lại. Trước đợt này không có tín hiệu nào kéo tiêu chí đó xuống: mô hình chỉ thấy bản ghi
 * và tự cảm nhận. Nay prompt nhận các con số cụ thể — số lượt, tỉ lệ lời nói, có hỏi lại hay không —
 * để nhận định dựa trên bằng chứng thay vì ấn tượng.
 *
 * <p>Cố ý CHỈ đo những thứ đếm được. Những thứ như "có bám vào ý của bạn thi không" là việc của mô
 * hình đọc bản ghi; đoán bằng từ khoá sẽ sai nhiều hơn đúng.
 */
public record InteractionSignals(
        int candidateTurns,
        int partnerTurns,
        int candidateWords,
        int partnerWords,
        int candidateQuestions
) {

    /** Tỉ lệ phần trăm lời nói của thí sinh trên tổng lời nói; không ai nói gì thì 0. */
    public int candidateSharePct() {
        int total = candidateWords + partnerWords;
        return total == 0 ? 0 : (int) Math.round(candidateWords * 100.0 / total);
    }

    /**
     * Thí sinh chưa hỏi lại câu nào trong một Teil CÓ bạn thi — dấu hiệu rõ nhất của lối nói một
     * chiều. Teil không có bạn thi (độc thoại, trình bày) thì không tính.
     */
    public boolean noQuestionToPartner() {
        return partnerTurns > 0 && candidateQuestions == 0;
    }

    public static InteractionSignals of(ParticipantBundle.PartTranscript pt) {
        int candTurns = 0, partTurns = 0, candWords = 0, partWords = 0, questions = 0;
        for (Utterance u : pt.candidate()) {
            String text = u.text() == null ? "" : u.text().trim();
            if (text.isEmpty()) continue;
            candTurns++;
            candWords += wordCount(text);
            questions += countQuestions(text);
        }
        for (Utterance u : pt.others()) {
            String text = u.text() == null ? "" : u.text().trim();
            if (text.isEmpty()) continue;
            // Giám khảo điều phối chứ không phải bạn hội thoại — không tính vào tỉ lệ đối đáp.
            if ("PRUEFER".equalsIgnoreCase(u.role())) continue;
            partTurns++;
            partWords += wordCount(text);
        }
        return new InteractionSignals(candTurns, partTurns, candWords, partWords, questions);
    }

    private static int wordCount(String text) {
        String trimmed = text.trim();
        return trimmed.isEmpty() ? 0 : trimmed.split("\\s+").length;
    }

    /** Đếm dấu hỏi; nhiều dấu liền nhau ("???") vẫn chỉ là một câu hỏi. */
    private static int countQuestions(String text) {
        int n = 0;
        for (int i = 0; i < text.length(); i++) {
            if (text.charAt(i) == '?' && (i == 0 || text.charAt(i - 1) != '?')) n++;
        }
        return n;
    }

    /** Khối chèn vào prompt chấm; rỗng khi Teil không có bạn thi (không có gì để nói về tương tác). */
    public String promptBlock() {
        if (partnerTurns == 0) return "";
        StringBuilder sb = new StringBuilder("\nINTERAKTIONSSIGNALE (gemessen, nicht geschätzt):\n");
        sb.append("- Redeanteil Kandidat: ").append(candidateSharePct()).append(" % (")
                .append(candidateWords).append(" von ").append(candidateWords + partnerWords).append(" Wörtern)\n");
        sb.append("- Redebeiträge: Kandidat ").append(candidateTurns)
                .append(", Partner ").append(partnerTurns).append('\n');
        sb.append("- Rückfragen des Kandidaten: ").append(candidateQuestions).append('\n');
        sb.append("Werte diese Zahlen in AUFGABENBEWAELTIGUNG bzw. INTERAKTION mit ein: ");
        sb.append("Wer auswendig Vorbereitetes vorträgt, ohne auf den Partner einzugehen und ohne eine einzige ");
        sb.append("Rückfrage, erfüllt die Aufgabe NICHT vollständig — auch wenn die Sprache gut ist.\n");
        return sb.toString();
    }
}
