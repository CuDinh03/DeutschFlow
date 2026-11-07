package com.deutschflow.user.registration;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Nhận diện email của dịch vụ hộp thư tạm. Mã PIN chứng minh người đăng ký ĐỌC được hộp thư, nhưng
 * hộp thư tạm thì máy đọc được — nên chặn từ bước điền form. Danh sách ở
 * {@code registration/disposable-email-domains.txt}; khớp cả tên miền con.
 */
@Component
public class DisposableEmailDomains {

    static final String RESOURCE = "registration/disposable-email-domains.txt";

    private final Set<String> domains;

    public DisposableEmailDomains() {
        this(load());
    }

    DisposableEmailDomains(Set<String> domains) {
        this.domains = Set.copyOf(domains);
    }

    public boolean isDisposable(String email) {
        if (email == null) return false;
        int at = email.lastIndexOf('@');
        if (at < 0 || at == email.length() - 1) return false;
        String domain = email.substring(at + 1).trim().toLowerCase(Locale.ROOT);
        while (!domain.isEmpty()) {
            if (domains.contains(domain)) return true;
            int dot = domain.indexOf('.');
            if (dot < 0) return false;
            domain = domain.substring(dot + 1);
        }
        return false;
    }

    int size() {
        return domains.size();
    }

    private static Set<String> load() {
        try (var in = new ClassPathResource(RESOURCE).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8).lines()
                    .map(String::trim)
                    .filter(l -> !l.isEmpty() && !l.startsWith("#"))
                    .map(l -> l.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException e) {
            throw new UncheckedIOException("Không đọc được " + RESOURCE, e);
        }
    }
}
