package com.deutschflow.common.config;

import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

/**
 * Tách UserDetailsService ra config riêng để tránh circular dependency:
 * SecurityConfig → UserDetailsService → UserRepository → SecurityConfig
 */
@Configuration
@RequiredArgsConstructor
public class UserDetailsServiceConfig {

    private final UserRepository userRepository;

    @Bean
    public UserDetailsService userDetailsService() {
        // Trim + case-insensitive lookup: stored emails are canonical lowercase, but the submitted
        // email may carry a stray space (autofill/paste) or a leading capital (mobile auto-capitalize).
        // An exact match would miss → UsernameNotFoundException → DaoAuthenticationProvider reports it
        // as BadCredentials → user sees "wrong password" though the password was never checked.
        return rawEmail -> {
            String email = rawEmail == null ? "" : rawEmail.trim();
            return userRepository.findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        };
    }
}
