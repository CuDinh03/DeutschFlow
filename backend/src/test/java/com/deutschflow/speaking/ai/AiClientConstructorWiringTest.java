package com.deutschflow.speaking.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.lang.reflect.Constructor;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guard cho một lỗi CHỈ hiện trên CI: các client Groq có thêm constructor package-private nhận
 * {@code baseUrl} để test trỏ vào stub HTTP cục bộ. Khi một {@code @Component} có NHIỀU constructor
 * mà không cái nào đánh dấu {@link Autowired}, Spring không chọn được ⇒ toàn bộ ApplicationContext
 * không load ⇒ mọi test {@code @SpringBootTest} đỏ.
 *
 * <p>Vì sao cần guard riêng: bộ test full-context của repo tự bỏ qua khi máy không có Postgres
 * (xem {@code AbstractPostgresIntegrationTest}), nên `./mvnw test` ở máy dev vẫn XANH trong khi CI
 * đỏ hàng chục case RBAC. Test này chạy được ở mọi nơi, không cần Postgres.
 */
class AiClientConstructorWiringTest {

    @ParameterizedTest(name = "{0}")
    @ValueSource(classes = {GroqChatClient.class, GroqWhisperClient.class})
    @DisplayName("component nhiều constructor phải có ĐÚNG MỘT constructor @Autowired")
    void multiConstructorComponentsMarkTheInjectionPoint(Class<?> componentClass) {
        Constructor<?>[] constructors = componentClass.getDeclaredConstructors();
        if (constructors.length < 2) {
            return; // một constructor: Spring tự suy ra, không cần đánh dấu
        }

        long annotated = Arrays.stream(constructors)
                .filter(c -> c.isAnnotationPresent(Autowired.class))
                .count();

        assertThat(annotated)
                .as("%s có %d constructor — Spring cần đúng một cái @Autowired để chọn",
                        componentClass.getSimpleName(), constructors.length)
                .isEqualTo(1);
    }
}
