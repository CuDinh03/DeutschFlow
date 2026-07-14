package com.deutschflow.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Khoá hợp đồng: MỌI đường dẫn web mà backend phát ra đều phải thuộc cây giao diện v2.
 *
 * <p>Vì sao cần bài test này: cây v1 đang bị gỡ bỏ (plans/2026-07-14-xoa-sach-v1-web.md). Nếu sau này
 * ai đó thêm một hằng số trỏ về path v1 (hoặc lỡ tay sửa ngược lại), link sẽ chết ngay khi cây v1 bị
 * xoá — mà loại lỗi đó chỉ lộ ra ở production, trong một cái email hoặc một nút bấm hiếm khi ai thử.
 * Bài test đọc hằng số bằng reflection nên hằng số MỚI cũng tự động bị kiểm.
 */
class WebRoutesContractTest {

    private static List<Field> routeConstants() {
        List<Field> fields = new ArrayList<>();
        for (Field f : WebRoutes.class.getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())
                    && Modifier.isPublic(f.getModifiers())
                    && f.getType() == String.class) {
                fields.add(f);
            }
        }
        return fields;
    }

    private static String valueOf(Field f) {
        try {
            return (String) f.get(null);
        } catch (IllegalAccessException e) {
            throw new AssertionError("không đọc được hằng số " + f.getName(), e);
        }
    }

    @Test
    @DisplayName("có ít nhất một hằng số — nếu rỗng thì bài test này im lặng vô dụng")
    void hasConstants() {
        assertThat(routeConstants()).isNotEmpty();
    }

    @Test
    @DisplayName("mọi đường dẫn web đều nằm trong cây v2 và không có dấu / thừa ở cuối")
    void everyRouteIsV2() {
        for (Field f : routeConstants()) {
            String route = valueOf(f);
            assertThat(route)
                    .as("WebRoutes.%s phải trỏ vào cây v2 — cây v1 sắp bị xoá, trỏ vào đó là link chết",
                            f.getName())
                    .startsWith("/v2/");
            // Đuôi "/" thừa sẽ tạo ra "/v2/x/?topic=…" khi nối thêm query — vẫn chạy nhưng xấu và dễ
            // sinh so-sánh-chuỗi sai ở phía frontend.
            assertThat(route)
                    .as("WebRoutes.%s không được kết thúc bằng '/'", f.getName())
                    .doesNotEndWith("/");
            // Hằng số là PHẦN ĐƯỜNG DẪN; query do nơi gọi tự nối vào.
            assertThat(route)
                    .as("WebRoutes.%s chỉ được chứa đường dẫn, không mang sẵn query string", f.getName())
                    .doesNotContain("?");
        }
    }
}
