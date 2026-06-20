package com.deutschflow.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    /** Name of the HTTP bearer (JWT) security scheme referenced by every operation. */
    private static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI deutschFlowOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("DeutschFlow API")
                        .version("w2")
                        .description("DeutschFlow contract for student & auth endpoints "
                                + "(web W2 group + native iOS group)."))
                // Base URLs the generated client can target. Production is confirmed;
                // staging follows the prod naming convention (confirm host before release),
                // local is the dev server.
                .servers(List.of(
                        new Server().url("https://api.mydeutschflow.com").description("Production"),
                        new Server().url("https://staging-api.mydeutschflow.com")
                                .description("Staging (confirm host)"),
                        new Server().url("http://localhost:8080").description("Local")))
                // HTTP bearer (JWT) so swift-openapi-generator emits an Authorization header
                // parameter; applied globally below.
                .components(new Components().addSecuritySchemes(BEARER_SCHEME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT access token. Send as: Authorization: Bearer <token>")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME));
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

    /**
     * Native iOS surface: every student & auth path the SwiftUI app consumes, so
     * {@code swift-openapi-generator} can emit a typed client + DTOs from
     * {@code /v3/api-docs/ios}. Mirrors the path list in
     * {@code plans/2026-06-20-openapi-coverage-audit.md} (P0).
     *
     * <p>Deliberately excludes {@code /api/skill-tree/**}: the node tree is served by the
     * typed {@code RoadmapTreeController} ({@code /api/roadmap/tree}); {@code SkillTreeController}
     * is still {@code Map}-based and would pollute codegen.
     */
    @Bean
    public GroupedOpenApi iosApi() {
        return GroupedOpenApi.builder()
                .group("ios")
                .pathsToMatch(
                        "/api/auth/**",
                        "/api/onboarding/**",
                        "/api/today/**",
                        "/api/student/**",
                        "/api/progress/**",
                        "/api/xp/**",
                        "/api/srs/**",
                        "/api/vocabulary/**",
                        "/api/words/**",
                        "/api/tags/**",
                        "/api/grammar/**",
                        "/api/ai-speaking/**",
                        "/api/speaking/**",
                        "/api/roadmap/**",
                        "/api/curriculum/**",
                        "/api/phase/**",
                        "/api/mock-exam*/**",
                        "/api/assessment/**",
                        "/api/ability/**",
                        "/api/achievements/**",
                        "/api/certificates/**",
                        "/api/notifications/**",
                        "/api/profile/**",
                        "/api/payments/**"
                )
                .build();
    }
}
