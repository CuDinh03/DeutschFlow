package com.deutschflow.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI deutschFlowOpenApi() {
        return new OpenAPI().info(new Info()
                .title("DeutschFlow API")
                .version("w2")
                .description("Minimal W2 contract for auth, plan, words, and reports endpoints."));
    }

    @Bean
    public GroupedOpenApi w2ContractApi() {
        return GroupedOpenApi.builder()
                .group("w2")
                .pathsToMatch(
                        "/api/auth/**",
                        "/api/plan/**",
                        "/api/reviews/**",
                        "/api/grammar/**",
                        "/api/words/**",
                        "/api/admin/reports/**",
                        "/api/student/dashboard",
                        "/api/notifications/**"
                )
                .build();
    }
}
