package com.deutschflow.grammar.service;

import com.deutschflow.examspeaking.weakness.ErrorRuleCatalog;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Đợt 4 kế hoạch sửa lỗi (09/11/2026): chấm Viết telc bỏ sót lỗi động từ vị trí 2 sau trạng ngữ đầu câu
 * („Am Wochenende ich gehe"). Luật máy thêm ghi chú khi mô hình không nói tới chỗ đó.
 */
class PracticeWritingV2RuleTest {

    private static final String BAI = """
            Liebe Lena,
            danke für deine E-Mail! Im Juli ich habe Zeit. Am Wochenende ich gehe oft am Fluss spazieren.
            Liebe Grüße
            Minh""";

    private static Map<String, Object> note(String quote, String correction) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("quote", quote);
        a.put("correction", correction);
        return a;
    }

    private static List<String> corrections(String text, List<Map<String, Object>> notes) {
        return AiExamEvaluatorService.v2Notes(text, notes).stream().map(n -> (String) n.get("correction")).toList();
    }

    @Test
    void trangNguDauCauMaChuNguDungTruocDongTu_themGhiChu() {
        var notes = AiExamEvaluatorService.v2Notes(BAI, List.of());

        assertThat(notes).extracting(n -> n.get("correction"))
                .containsExactly("Im Juli habe ich", "Am Wochenende gehe ich");
        Map<String, Object> first = notes.get(0);
        assertThat(first).containsEntry("quote", "Im Juli ich habe").containsEntry("category", "GRAMMATIK")
                .containsEntry("kriterium", "III").containsEntry("errorCode", "WORD_ORDER.INVERSION_AFTER_ADVERBIAL")
                .containsEntry("source", "RULE_V2")
                .containsEntry("ruleVi", ErrorRuleCatalog.ruleVi("WORD_ORDER.INVERSION_AFTER_ADVERBIAL"));
        assertThat((String) first.get("ruleVi")).isNotBlank();
        assertThat((String) first.get("whyVi")).contains("Im Juli").contains("habe");
    }

    @Test
    void moHinhDaGhiChuChoDo_khongThemTrung() {
        var existing = List.of(note("Am Wochenende ich gehe", "Am Wochenende gehe ich"));

        assertThat(corrections(BAI, existing)).containsExactly("Im Juli habe ich");
    }

    @Test
    void cauDaSuaTrongBaiDaSuaCuaGhiChuKhac_khongThemTrung() {
        // Ghi chú "sửa ngầm" trích đoạn rộng hơn vẫn phủ chỗ này.
        var existing = List.of(note("Im Juli ich habe Zeit.", "Im Juli habe ich Zeit."));

        assertThat(corrections(BAI, existing)).containsExactly("Am Wochenende gehe ich");
    }

    @Test
    void cauDung_khongBaoNham() {
        String ok = """
                Hallo Tim,
                am Wochenende gehe ich schwimmen. Heute habe ich Zeit. Ich gehe heute ins Kino.
                Mit ihr gehe ich oft spazieren. In Deutschland arbeite ich als Koch. Natürlich, ich komme gern.
                Viele Grüße""";

        assertThat(AiExamEvaluatorService.v2Notes(ok, List.of())).isEmpty();
    }

    @Test
    void sauChuNguLaLienTu_khongDoanCauSua() {
        assertThat(AiExamEvaluatorService.v2Notes("Heute ich und meine Frau gehen ins Kino.", List.of())).isEmpty();
    }

    @Test
    void dauPhayGioVaChuThuongSauLoiChao() {
        // Dấu phẩy sau trạng ngữ: bỏ qua (giống cụm dẫn ý „Im Gegenteil, ich finde…" vốn đúng).
        assertThat(AiExamEvaluatorService.v2Notes("Am Wochenende, ich gehe gern schwimmen.", List.of())).isEmpty();
        assertThat(corrections("Um 8 Uhr ich stehe auf.", List.of())).containsExactly("Um 8 Uhr stehe ich");
        assertThat(corrections("Hallo Lena,\nam Montag ich habe frei.", List.of())).containsExactly("am Montag habe ich");
        assertThat(corrections("Ich bin müde. In meiner Freizeit ich lese viel.", List.of()))
                .containsExactly("In meiner Freizeit lese ich");
    }

    @Test
    void tuSauChuNguKhongPhaiDongTuChia_khongDuaCauSuaSai() {
        // Động từ đứng cuối câu: không đoán được câu sửa ngắn ⇒ bỏ qua, không ra „Am Wochenende in ich".
        for (String s : List.of(
                "Am Wochenende ich in die Stadt fahre.",
                "Heute ich meine Freunde treffe.",
                "Morgen ich zu Hause bleibe.",
                "Heute ich ins Kino gehe.",
                "Am Samstag ich endlich habe Zeit.",
                "Dann ihr neuer Freund kommt.",
                "Dann sie ihn anruft.",
                "Heute ich leider keine Zeit habe.")) {
            assertThat(AiExamEvaluatorService.v2Notes(s, List.of())).as(s).isEmpty();
        }
    }

    @Test
    void dongTuChiaODuoiMenhDe_khongDuaCauSuaSai() {
        // Lượt soát 09/11 (143 câu): từ sau chủ ngữ có đuôi giống động từ mà động từ thật ở cuối mệnh đề.
        for (String s : List.of(
                "Heute ich viele Freunde treffe.",
                "Dann ich sie anrufe.",
                "Dann ich sie frage.",
                "Heute ich nie gehe.",
                "Jetzt ich gerade esse.",
                "Heute ich lange schlafe.",
                "Heute ich alleine gehe.",
                "Heute ich andere Leute treffe.",
                "Heute ich gute Laune habe.",
                "Im Winter es kalt ist.",
                "Heute es gut läuft.",
                "Heute er fast weint.",
                "Heute ihr gut aussieht.",
                "Am Samstag wir meinen Opa besuchen.",
                "Heute wir unseren Freund treffen.",
                "Heute wir deinen Bruder besuchen.",
                "Am Wochenende wir spazieren gehen.",
                "Danach wir einkaufen gehen.",
                "Am Montag wir schwimmen gehen.",
                "Am Abend wir fernsehen.")) {
            assertThat(AiExamEvaluatorService.v2Notes(s, List.of())).as(s).isEmpty();
        }
    }

    @Test
    void dongTuChiaSauTinhTuHoacTruocCumGioiTu_khongDuaCauSuaSai() {
        // Lượt soát lần ba (51 câu đối kháng): tính từ biến cách/danh từ viết thường mang đuôi động từ, bỏ dấu
        // phẩy trước liên từ, động từ vị trí 3 rồi cụm giới từ.
        for (String s : List.of(
                "Heute er spät kommt nach Hause.",
                "Heute es leicht regnet in Berlin.",
                "Heute er sofort geht zum Arzt.",
                "Heute ich neue Schuhe kaufe weil sie kaputt sind.",
                "Am Wochenende ich deutsche Filme sehe und meine Freundin kocht.",
                "Heute ich kaffee trinke mit Anna.",
                "Am Abend wir neuen Kollegen treffen und dann essen wir.",
                "Heute ich schöne Fotos mache und poste sie.",
                "Am Wochenende ich große Pizza esse mit Freunden.",
                "Heute ich leckere Suppe koche für meine Familie.")) {
            assertThat(AiExamEvaluatorService.v2Notes(s, List.of())).as(s).isEmpty();
        }
    }

    @Test
    void chuNguSoItCauNgan_vanBat_tieuDeXuongDong_khongBat() {
        assertThat(corrections("Morgens sie trinkt Kaffee.", List.of())).containsExactly("Morgens trinkt sie");
        // „Am Wochenende" đứng một dòng như tiêu đề: không nối với câu dưới.
        assertThat(AiExamEvaluatorService.v2Notes("Am Wochenende\nich gehe spazieren.", List.of())).isEmpty();
    }

    @Test
    void cumDanYCoDauPhay_vaCauThieuSein_khongBaoNhamKhongSuaSai() {
        for (String s : List.of(
                "Im Gegenteil, ich finde die Idee super.",
                "Im Gegenteil, wir freuen uns.",
                "Im Ernst, ich habe keine Zeit.",
                "Im Prinzip, ich habe nichts dagegen.",
                "Zum Beispiel, ich koche gern.",
                "Heute ich müde.",
                "Heute ich leise sprechen.",
                "Heute er spät kommen.",
                "Heute es laut.",
                "Heute ich zuhause.",
                "Heute wir zufrieden mit dem Hotel.",
                "Heute sie zufrieden mit dem Ergebnis.")) {
            assertThat(AiExamEvaluatorService.v2Notes(s, List.of())).as(s).isEmpty();
        }
    }

    @Test
    void troDongTuNgaySauChuNgu_vanBatDuDuoiCauConDongTuKhac() {
        assertThat(corrections("Im Winter es ist kalt.", List.of())).containsExactly("Im Winter ist es");
        assertThat(corrections("Am Montag ich bin müde.", List.of())).containsExactly("Am Montag bin ich");
        assertThat(corrections("Dann wir haben gegessen.", List.of())).containsExactly("Dann haben wir");
    }

    @Test
    void duoiDongTuKhopChuNgu_vanBatDung() {
        assertThat(corrections("Heute du hast Zeit.", List.of())).containsExactly("Heute hast du");
        assertThat(corrections("Am Montag er kommt.", List.of())).containsExactly("Am Montag kommt er");
        assertThat(corrections("Dann wir gehen ins Kino.", List.of())).containsExactly("Dann gehen wir");
        assertThat(corrections("Heute ich kann nicht kommen.", List.of())).containsExactly("Heute kann ich");
        assertThat(corrections("Am Montag ich habe gearbeitet.", List.of())).containsExactly("Am Montag habe ich");
    }

    @Test
    void cauDungKhacKhongBaoNham() {
        for (String s : List.of(
                // xuống dòng giữa câu (mệnh đề phụ) — không phải đầu câu
                "Ich freue mich, weil\nam Wochenende wir nach Berlin fahren.",
                "Ich glaube, dass\nim Sommer es wärmer ist.",
                // „Seit" là liên từ
                "Seit Peter sie kennt, ist er glücklich.",
                // „Um … zu"
                "Um Anna es zu erklären, brauche ich Zeit.",
                // dấu phẩy sau trạng từ đơn: lối nói thường ngày
                "Hier, ich schicke dir ein Foto.",
                "Morgen, du hast recht.")) {
            assertThat(AiExamEvaluatorService.v2Notes(s, List.of())).as(s).isEmpty();
        }
    }

    @Test
    void dauDoanSauDongTrong_vanXet() {
        assertThat(corrections("Hallo Tim\n\nam Montag ich habe frei.", List.of())).containsExactly("am Montag habe ich");
    }

    @Test
    void giuaCau_khongXet() {
        // Chỉ xét đầu câu: giữa câu khó đoán đúng câu sửa, thà bỏ sót còn hơn báo sai.
        assertThat(AiExamEvaluatorService.v2Notes("Ich glaube, heute ich habe Zeit.", List.of())).isEmpty();
    }

    @Test
    void toiDaBaGhiChu() {
        String many = "Heute ich habe Zeit. Morgen ich gehe. Dann ich esse. Danach ich schlafe.";

        assertThat(AiExamEvaluatorService.v2Notes(many, List.of())).hasSize(AiExamEvaluatorService.MAX_V2_NOTES);
    }

    @SuppressWarnings("unchecked")
    @Test
    void readAnnotations_moHinhBoSot_vanCoGhiChuV2() {
        String raw = "{\"annotations\": [], \"musterloesung_de\": \"\"}";
        Map<String, Object> eval = new LinkedHashMap<>();

        new AiExamEvaluatorService(null, null, null).readAnnotations(raw, BAI, eval);

        var notes = (List<Map<String, Object>>) eval.get("annotations");
        assertThat(notes).extracting(n -> n.get("source")).containsOnly("RULE_V2");
        assertThat(notes).hasSize(2);
    }
}
