package com.deutschflow.common.config;

import com.deutschflow.common.security.JwtAuthFilter;
import jakarta.servlet.DispatcherType;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService; // inject từ UserDetailsServiceConfig
    private final Environment environment;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean isLocalProfile = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("local") || p.equalsIgnoreCase("dev") || p.equalsIgnoreCase("test"));

        return http
                // Stateless JSON API: clients send Bearer JWT. If you add cookie-based sessions, re-enable CSRF
                // or use token-based CSRF and strict SameSite cookies.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> {})
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .headers(h -> h
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'none'; " +
                                "frame-ancestors 'none'; " +
                                "base-uri 'none'; " +
                                "form-action 'none'"))
                        .permissionsPolicy(p -> p.policy("geolocation=(), microphone=(), camera=()"))
                )
                .authorizeHttpRequests(auth -> {
                        // SSE/async continuations reuse SecurityContext from the initial request — do not treat
                        // this as weakening auth; regression-test streaming endpoints if changing the filter chain.
                        auth.dispatcherTypeMatchers(DispatcherType.ASYNC).permitAll();
                        // Auth endpoints: only login/register/refresh are public
                        auth.requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/refresh").permitAll();
                        auth.requestMatchers("/api/auth/logout").authenticated();
                        auth.requestMatchers("/api/auth/me", "/api/auth/me/**").authenticated();
                        auth.requestMatchers("/api/quiz/*/join").permitAll();  // guest join

                        // No STOMP/WebSocket config in this app yet — do not expose /ws until handshake auth exists.

                        // Keep health open; restrict info (build/git metadata) and prometheus + OpenAPI
                        auth.requestMatchers("/actuator/health").permitAll();
                        auth.requestMatchers("/actuator/info").hasRole("ADMIN");
                        if (isLocalProfile) {
                                auth.requestMatchers("/actuator/prometheus").permitAll();
                                auth.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll();
                        } else {
                                auth.requestMatchers("/actuator/prometheus").hasRole("ADMIN");
                                auth.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").hasRole("ADMIN");
                        }

                        auth.anyRequest().authenticated();
                })
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        var provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
