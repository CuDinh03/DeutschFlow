package com.deutschflow.common.config;

import com.deutschflow.common.security.JwtAuthFilter;
import com.deutschflow.common.security.SecurityExceptionLoggingHandler;
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
import org.springframework.http.HttpMethod;
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
    private final SecurityExceptionLoggingHandler securityExceptionLoggingHandler;

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
                .exceptionHandling(e -> e
                        .accessDeniedHandler(securityExceptionLoggingHandler.accessDeniedHandler())
                        .authenticationEntryPoint(securityExceptionLoggingHandler.authenticationEntryPoint()))
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
                        // ASYNC: SSE/async continuations reuse SecurityContext from the initial request.
                        // ERROR: Spring forwards to /error on unhandled exceptions — must permitAll or the
                        // security filter returns 401 instead of the actual error response, masking root causes.
                        auth.dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll();
                        // Auth endpoints: login, register, refresh, forgot-password, and reset-password are public
                        auth.requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/forgot-password", "/api/auth/reset-password").permitAll();
                        auth.requestMatchers("/api/auth/logout").authenticated();
                        auth.requestMatchers("/api/auth/me", "/api/auth/me/**").authenticated();
                        auth.requestMatchers("/api/quiz/*/join").permitAll();  // guest join
                        // MoMo IPN webhook: called by MoMo servers (no JWT), secured via HMAC-SHA256 signature verification
                        auth.requestMatchers("/api/payments/momo/ipn").permitAll();
                        // Stripe webhook: called by Stripe servers (no JWT), secured via HMAC-SHA256 signature verification
                        auth.requestMatchers("/api/payments/stripe/webhook").permitAll();
                        // Apple App Store Server Notifications V2: called by Apple servers (no JWT), secured via JWS signature verification
                        auth.requestMatchers("/api/payments/apple/notifications").permitAll();

                        // Public media reads for landing page and direct asset links (no directory listing)
                        auth.requestMatchers(HttpMethod.GET, "/api/v2/media/by-tag").permitAll();
                        auth.requestMatchers(HttpMethod.GET, "/api/v2/media/**").permitAll();

                        // No STOMP/WebSocket config in this app yet — do not expose /ws until handshake auth exists.

                        // Keep health open; restrict info (build/git metadata) and prometheus + OpenAPI
                        auth.requestMatchers("/actuator/health").permitAll();
                        auth.requestMatchers("/actuator/info").hasRole("ADMIN");
                        // env/metrics expose config topology + operational data — ADMIN only.
                        // (Previously fell through to anyRequest().authenticated() → any logged-in STUDENT could read them.)
                        auth.requestMatchers("/actuator/env", "/actuator/env/**",
                                             "/actuator/metrics", "/actuator/metrics/**").hasRole("ADMIN");
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
                .exceptionHandling(e -> e
                        .accessDeniedHandler(securityExceptionLoggingHandler.accessDeniedHandler())
                        .authenticationEntryPoint(securityExceptionLoggingHandler.authenticationEntryPoint()))
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
