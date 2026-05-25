package com.deutschflow.config;

import com.deutschflow.common.security.JwtAuthFilter;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.userdetails.UserDetailsService;

@TestConfiguration
public class TestSecurityConfig {

    @Bean
    @Primary
    public JwtAuthFilter jwtAuthFilter() {
        return org.mockito.Mockito.mock(JwtAuthFilter.class);
    }

    @Bean
    @Primary
    public UserDetailsService userDetailsService() {
        return org.mockito.Mockito.mock(UserDetailsService.class);
    }
}
