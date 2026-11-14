package com.deutschflow.speaking.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Danh sách persona của sidecar (bài nghe mỗi nhân vật một giọng, 14/11/2026). Sidecar gặp persona lạ
 * thì lặng lẽ đọc bằng DEFAULT, nên backend phải biết sidecar ĐANG CHẠY có persona {@code HOER_*} hay
 * chưa. Test thuần — không Spring context, không DB, không Docker.
 */
class EdgeTtsServicePersonasTest {

    private static final String URL = "http://edge-tts.test:5050";
    private static final String OLD_SIDECAR = "{\"DEFAULT\":{},\"ANNA\":{},\"THOMAS\":{}}";
    private static final String NEW_SIDECAR =
            "{\"DEFAULT\":{},\"ANNA\":{},\"THOMAS\":{},\"HOER_F1\":{},\"HOER_F2\":{},\"HOER_F3\":{},"
                    + "\"HOER_M1\":{},\"HOER_M2\":{},\"HOER_M3\":{}}";

    private EdgeTtsService service;
    private MockRestServiceServer sidecar;

    @BeforeEach
    void setup() {
        service = new EdgeTtsService();
        ReflectionTestUtils.setField(service, "edgeTtsUrl", URL);
        RestTemplate rest = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        sidecar = MockRestServiceServer.bindTo(rest).build();
    }

    @Test
    @DisplayName("sidecar mới: liệt kê đủ sáu persona HOER_* và chỉ hỏi sidecar một lần trong thời gian nhớ")
    void newSidecarListsHoerenPersonasAndIsCached() {
        sidecar.expect(ExpectedCount.once(), requestTo(URL + "/voices"))
                .andRespond(withSuccess(NEW_SIDECAR, MediaType.APPLICATION_JSON));

        List<String> personas = service.supportedPersonas();

        assertThat(personas).contains("ANNA", "THOMAS",
                "HOER_F1", "HOER_F2", "HOER_F3", "HOER_M1", "HOER_M2", "HOER_M3");
        assertThat(service.isUnsupportedHoerenPersona("HOER_F1")).isFalse();
        assertThat(service.isUnsupportedHoerenPersona("hoer_m3")).isFalse();
        assertThat(service.supportedPersonas()).isEqualTo(personas);
        sidecar.verify();
    }

    @Test
    @DisplayName("sidecar cũ: persona HOER_* bị coi là chưa hỗ trợ, persona cũ và persona lạ khác thì không chặn")
    void oldSidecarRejectsOnlyHoerenPersonas() {
        sidecar.expect(ExpectedCount.once(), requestTo(URL + "/voices"))
                .andRespond(withSuccess(OLD_SIDECAR, MediaType.APPLICATION_JSON));

        assertThat(service.isUnsupportedHoerenPersona("HOER_F1")).isTrue();
        assertThat(service.isUnsupportedHoerenPersona("ANNA")).isFalse();
        assertThat(service.isUnsupportedHoerenPersona("SOMETHING_ELSE")).isFalse();
        assertThat(service.isUnsupportedHoerenPersona(null)).isFalse();
        sidecar.verify();
    }

    @Test
    @DisplayName("không hỏi được sidecar: danh sách rỗng, không chặn oan, và không gọi lại ngay")
    void sidecarErrorGivesEmptyListWithoutBlocking() {
        sidecar.expect(ExpectedCount.once(), requestTo(URL + "/voices")).andRespond(withServerError());

        assertThat(service.supportedPersonas()).isEmpty();
        assertThat(service.isUnsupportedHoerenPersona("HOER_F1")).isFalse();
        sidecar.verify();
    }

    @Test
    @DisplayName("chưa cấu hình sidecar: danh sách rỗng, không gọi mạng")
    void notConfiguredGivesEmptyList() {
        ReflectionTestUtils.setField(service, "edgeTtsUrl", "");

        assertThat(service.supportedPersonas()).isEmpty();
        assertThat(service.isUnsupportedHoerenPersona("HOER_F1")).isFalse();
        sidecar.verify();
    }

    @Test
    @DisplayName("công tắc tắt: danh sách không còn HOER_* (persona cũ vẫn còn) và mọi persona HOER_* bị từ chối")
    void switchOffHidesAndRejectsHoerenPersonas() {
        ReflectionTestUtils.setField(service, "hoerenVoicesEnabled", false);
        sidecar.expect(ExpectedCount.once(), requestTo(URL + "/voices"))
                .andRespond(withSuccess(NEW_SIDECAR, MediaType.APPLICATION_JSON));

        assertThat(service.supportedPersonas()).containsExactly("ANNA", "DEFAULT", "THOMAS");
        assertThat(service.isUnsupportedHoerenPersona("HOER_F1")).isTrue();
        assertThat(service.isUnsupportedHoerenPersona("hoer_m3")).isTrue();
        assertThat(service.isUnsupportedHoerenPersona("ANNA")).isFalse();
        sidecar.verify();
    }

    @Test
    @DisplayName("công tắc tắt mà không hỏi được sidecar: HOER_* vẫn bị từ chối, không gọi mạng thêm")
    void switchOffRejectsEvenWhenSidecarListUnknown() {
        ReflectionTestUtils.setField(service, "hoerenVoicesEnabled", false);

        assertThat(service.isUnsupportedHoerenPersona("HOER_M2")).isTrue();
        sidecar.verify();
    }

    @Test
    @DisplayName("application.yml khai công tắc app.tts.hoeren-voices-enabled, mặc định bật qua HOEREN_VOICES_ENABLED")
    void switchIsDeclaredInApplicationYml() throws Exception {
        String yml = Files.readString(Path.of("src", "main", "resources", "application.yml"), StandardCharsets.UTF_8);
        assertThat(yml).contains("hoeren-voices-enabled: ${HOEREN_VOICES_ENABLED:true}");
    }

    /**
     * Bảng persona của sidecar (Python) không có test riêng: đọc thẳng {@code server.py} để canh sáu
     * persona bài nghe — đúng sáu giọng gốc, cao độ tự nhiên, tốc độ lệch tối đa 3 %.
     */
    @Test
    @DisplayName("server.py: sáu persona HOER_* dùng sáu giọng gốc khác nhau, +0Hz, tốc độ lệch ≤ 3 %")
    void sidecarTableHasSixNaturalPitchHoerenVoices() throws Exception {
        Path file = Path.of("edge-tts-sidecar", "server.py");
        assertThat(file).exists();
        String source = Files.readString(file, StandardCharsets.UTF_8);
        Matcher m = Pattern.compile(
                "\"(HOER_[FM][1-3])\":\\s*\\{\"voice\":\\s*\"([^\"]+)\",\\s*\"pitch\":\\s*\"([^\"]+)\",\\s*\"rate\":\\s*\"([+-]\\d+)%\"}")
                .matcher(source);
        java.util.Map<String, String> voices = new java.util.TreeMap<>();
        while (m.find()) {
            assertThat(m.group(3)).as("pitch của %s", m.group(1)).isEqualTo("+0Hz");
            assertThat(Math.abs(Integer.parseInt(m.group(4)))).as("rate của %s", m.group(1)).isLessThanOrEqualTo(3);
            voices.put(m.group(1), m.group(2));
        }
        assertThat(voices).containsOnlyKeys("HOER_F1", "HOER_F2", "HOER_F3", "HOER_M1", "HOER_M2", "HOER_M3");
        assertThat(voices.values()).containsExactlyInAnyOrder(
                "de-DE-KatjaNeural", "de-DE-AmalaNeural", "de-DE-SeraphinaMultilingualNeural",
                "de-DE-ConradNeural", "de-DE-KillianNeural", "de-DE-FlorianMultilingualNeural");
        // Persona cũ của phòng thi nói không được đổi.
        assertThat(source).contains("\"ANNA\":      {\"voice\": \"de-DE-AmalaNeural\",                 \"pitch\": \"+0Hz\",  \"rate\": \"-3%\"}");
        assertThat(source).contains("\"THOMAS\":    {\"voice\": \"de-DE-FlorianMultilingualNeural\",    \"pitch\": \"+0Hz\",  \"rate\": \"+0%\"}");
    }
}
