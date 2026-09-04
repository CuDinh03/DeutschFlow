package com.deutschflow.vocabulary.galerie;

import com.deutschflow.speaking.ai.ChatMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GaleriePromptFactoryTest {

    private final GaleriePromptFactory factory = new GaleriePromptFactory();

    @Test
    @DisplayName("conceptMessages: system chứa từ khoá JSON (bắt buộc cho json_object mode) + đủ 5 family")
    void conceptMessages_containsJsonKeywordAndFamilies() {
        List<ChatMessage> messages = factory.conceptMessages("Apfel", "der", "NOUN", "quả táo", "A1");

        assertThat(messages).hasSize(2);
        String system = messages.get(0).content();
        // Groq/Fireworks json_object mode từ chối request nếu prompt không nhắc chữ "json"
        assertThat(system).containsIgnoringCase("json");
        assertThat(system).contains("OBJEKT", "LEBEN", "HANDLUNG", "ORT", "GEFUEHL_IDEE");
        assertThat(messages.get(1).content()).contains("der Apfel").contains("quả táo");
    }

    @Test
    @DisplayName("conceptMessages: từ không có mạo từ (động từ) không bị ghép 'null'")
    void conceptMessages_verbWithoutGender() {
        List<ChatMessage> messages = factory.conceptMessages("lesen", null, "VERB", "đọc", "A1");
        assertThat(messages.get(1).content()).contains("\"lesen\"").doesNotContain("null");
    }

    @Test
    @DisplayName("imagePromptCondensed: đủ 5 mã màu palette + concept + né vượt trần T5 (~512 token)")
    void condensed_withinT5Budget_andCarriesPalette() {
        String prompt = factory.imagePromptCondensed("One expressive brick-red apple with a gold leaf.");

        assertThat(prompt).contains("#F6F3EC", "#FFCD00", "#C79A00", "#DA291C", "#161513");
        assertThat(prompt).contains("brick-red apple");
        assertThat(prompt).contains("no text");
        // ~4 ký tự/token: giữ dưới ~1800 ký tự để concept dài vẫn lọt cửa sổ T5 512 token
        assertThat(prompt.length()).isLessThan(1800);
    }

    @Test
    @DisplayName("imagePromptCondensed: concept nhiều dòng được ép về một dòng")
    void condensed_flattensMultilineConcept() {
        String prompt = factory.imagePromptCondensed("line one\n  line two");
        assertThat(prompt).contains("line one line two");
    }

    @Test
    @DisplayName("imagePromptFull: mang đủ ngữ cảnh từ + family + avoid-list cốt lõi")
    void full_carriesWordContextAndAvoidList() {
        String prompt = factory.imagePromptFull("Apfel", "der", "quả táo",
                GalerieFamily.OBJEKT, "One expressive brick-red apple.");

        assertThat(prompt).contains("\"Apfel\"", "\"der\"", "\"quả táo\"", "OBJEKT");
        assertThat(prompt).contains("#FFCD00").contains("60–68%");
        assertThat(prompt).containsIgnoringCase("no").containsIgnoringCase("Bauhaus");
        assertThat(prompt).containsIgnoringCase("watermark");
    }

    @Test
    @DisplayName("svgSystemPrompt: mang 3 quy tắc owner (mặt biểu cảm / đối chứng / micro-scene) + luật kỹ thuật")
    void svgSystemPrompt_carriesOwnerRulesAndTechnicalConstraints() {
        String system = factory.svgSystemPrompt();

        // Quy tắc 1: hình người phải có mặt biểu cảm
        assertThat(system).contains("cream face").contains("expressive eyes");
        // Quy tắc 2: tính từ cần chủ thể + vật đối chứng
        assertThat(system).contains("contrasting reference");
        // Quy tắc 3: động từ cần micro-scene
        assertThat(system).contains("micro-scene");
        // Luật kỹ thuật khớp sanitizer (element whitelist + viewBox + cấm text)
        assertThat(system).contains("svg,rect,circle,ellipse,path,polygon,g");
        assertThat(system).contains("0 0 1024 1024");
        assertThat(system).contains("#F6F3EC", "#FFCD00", "#C79A00", "#DA291C", "#161513");
    }

    @Test
    @DisplayName("svgAnchorsBlock: nạp đủ 3 anchor, mỗi anchor là SVG palette-compliant")
    void svgAnchorsBlock_containsThreeAnchors() {
        String block = factory.svgAnchorsBlock();

        assertThat(block).contains("match their style, not their subjects");
        // 3 anchor = 3 lần mở khối <svg
        assertThat(block.split("<svg", -1)).hasSize(4);
        assertThat(block).contains("viewBox=\"0 0 1024 1024\"");
    }

    @Test
    @DisplayName("svgUserMessage: format WORD/MEANING/FAMILY/CONCEPT; động từ không dính 'null'")
    void svgUserMessage_formatAndNullGender() {
        String msg = factory.svgUserMessage("lesen", null, "đọc",
                GalerieFamily.HANDLUNG, "One figure reading\n in an armchair.");

        assertThat(msg).contains("GERMAN WORD: \"lesen\"");
        assertThat(msg).contains("MEANING (vi): đọc");
        assertThat(msg).contains("SEMANTIC FAMILY: HANDLUNG");
        assertThat(msg).contains("One figure reading in an armchair.");
        assertThat(msg).doesNotContain("null");
    }
}
