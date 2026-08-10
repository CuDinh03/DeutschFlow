package com.deutschflow.speaking.ai;

import java.util.Map;

/**
 * Dữ kiện TĨNH đã kiểm duyệt cho các bài LESSON có đáp án cố định (QA prod 09/08 mục B:
 * model tự "nhớ" bảng chữ cái và dạy sai — A đọc thành "baa" là cách đọc của B, ví dụ bịa
 * "das A-Kaffee"). LLM không đáng tin cho dữ liệu tra cứu: mọi cách đọc, con số, ví dụ ở
 * chế độ LESSON phải lấy từ đây; model chỉ đóng vai dẫn dắt quanh nội dung này.
 *
 * <p>Key khớp {@code lessonScenarios[].id} phía frontend ({@code lib/personas.ts}).
 * Chủ đề không có sheet (tình huống hội thoại: Anmeldung, ga tàu…) nhận ràng buộc chung
 * trong {@link SystemPromptBuilder}. Nội dung do người biên soạn duyệt qua PR — model
 * KHÔNG được sửa/bổ sung lúc chạy.
 */
public final class LessonFactSheets {

    private LessonFactSheets() {
    }

    private static final String ALPHABET = """
            BẢNG CHỮ CÁI TIẾNG ĐỨC (cách đọc TÊN chữ cái — phiên âm gần đúng cho người Việt + IPA):
            A = "a" [aː] · B = "bê" [beː] · C = "xê" [tseː] · D = "đê" [deː] · E = "ê" [eː]
            F = "ép" [ɛf] · G = "gê" [geː] · H = "ha" [haː] · I = "i" [iː] · J = "giót" [jɔt]
            K = "ka" [kaː] · L = "el" [ɛl] · M = "em" [ɛm] · N = "en" [ɛn] · O = "ô" [oː]
            P = "pê" [peː] · Q = "ku" [kuː] · R = "e-rơ" [ɛʁ] · S = "ét" [ɛs] · T = "tê" [teː]
            U = "u" [uː] · V = "phao" [faʊ] · W = "vê" [veː] · X = "ích" [ɪks]
            Y = "úp-xi-lon" [ˈʏpsilɔn] · Z = "txét" [tsɛt]
            Ä = "e (dài)" [ɛː] · Ö = "ơ" [øː] · Ü = "uy" [yː] · ß = "ét-xét" (scharfes S)
            LƯU Ý HAY NHẦM: A đọc là "a" — KHÔNG phải "bê"; "bê" là chữ B.
            CÂU MẪU ĐƯỢC DÙNG (không tự đặt câu khác):
            - "Wie schreibt man das?" (Cái đó viết thế nào?)
            - "Können Sie das bitte buchstabieren?" (Anh/chị đánh vần giúp được không?)
            - "Mein Name ist Nam: N-A-M." (Tên tôi là Nam: N-A-M.)
            """;

    private static final String NUMBERS = """
            SỐ ĐẾM TIẾNG ĐỨC 0-100 (dữ kiện chuẩn):
            0 null · 1 eins · 2 zwei · 3 drei · 4 vier · 5 fünf · 6 sechs · 7 sieben · 8 acht · 9 neun
            10 zehn · 11 elf · 12 zwölf · 13 dreizehn · 14 vierzehn · 15 fünfzehn
            16 sechzehn (chú ý: bỏ -s của sechs) · 17 siebzehn (chú ý: bỏ -en của sieben)
            18 achtzehn · 19 neunzehn
            20 zwanzig · 30 dreißig · 40 vierzig · 50 fünfzig · 60 sechzig · 70 siebzig
            80 achtzig · 90 neunzig · 100 (ein)hundert
            QUY TẮC 21-99: hàng ĐƠN VỊ đứng TRƯỚC hàng chục, nối bằng "und":
            21 = einundzwanzig, 35 = fünfunddreißig, 99 = neunundneunzig.
            CÂU MẪU ĐƯỢC DÙNG (không tự đặt câu khác):
            - "Ich bin dreißig Jahre alt." (Tôi 30 tuổi.)
            - "Das kostet zwanzig Euro." (Cái đó giá 20 euro.)
            - "Meine Handynummer ist null eins fünf zwei…" (Số điện thoại của tôi là 0152…)
            """;

    private static final String UMLAUT = """
            UMLAUT TIẾNG ĐỨC (ä, ö, ü — dữ kiện chuẩn):
            ä [ɛ/ɛː]: đọc như "e" tiếng Việt. Ví dụ ĐƯỢC DÙNG: Mädchen (cô bé), spät (muộn), Käse (phô mai).
            ö [œ/øː]: môi tròn như khi nói "ô" nhưng lưỡi đặt như "ê". Ví dụ ĐƯỢC DÙNG: schön (đẹp), hören (nghe), zwölf (số 12).
            ü [ʏ/yː]: môi tròn như khi nói "u" nhưng lưỡi đặt như "i". Ví dụ ĐƯỢC DÙNG: fünf (số 5), Tür (cái cửa), über (trên/về).
            Khi bàn phím không có umlaut, viết thay: ä→ae, ö→oe, ü→ue.
            """;

    private static final String EMERGENCY_NUMBERS = """
            SỐ KHẨN CẤP Ở ĐỨC (dữ kiện chuẩn — tuyệt đối không nhầm):
            110 = Polizei (cảnh sát).
            112 = Feuerwehr + cấp cứu y tế (Rettungsdienst/Notarzt) — miễn phí, gọi được từ mọi mạng, dùng chung toàn EU.
            116117 = bác sĩ trực ngoài giờ (ärztlicher Bereitschaftsdienst) — cho ca KHÔNG nguy hiểm tính mạng.
            CÂU MẪU ĐƯỢC DÙNG (không tự đặt câu khác):
            - "Hilfe!" (Cứu tôi với!)
            - "Ich brauche einen Krankenwagen." (Tôi cần xe cấp cứu.)
            - "Es brennt!" (Cháy!)
            - "Meine Adresse ist Hauptstraße eins." (Địa chỉ của tôi là Hauptstraße 1.)
            """;

    /** Key = {@code lessonScenarios[].id} client gửi làm {@code topic} khi tạo phiên LESSON. */
    private static final Map<String, String> SHEETS = Map.of(
            "alphabet", ALPHABET,
            "numbers", NUMBERS,
            "umlaut", UMLAUT,
            "emergency_numbers", EMERGENCY_NUMBERS);

    /** Fact sheet cho chủ đề LESSON, hoặc {@code null} nếu chủ đề không có đáp án cố định. */
    public static String factSheetFor(String topic) {
        if (topic == null) {
            return null;
        }
        return SHEETS.get(topic.trim().toLowerCase());
    }
}
