package com.deutschflow.curriculum.service;

import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Nghiệm thu B3.4 (khung tier plans/2026-08-07): route curriculum qua tier CONTENT ở P2 KHÔNG
 * được làm regenerate nội dung đã cache — node có {@code content_json} sẵn phải trả từ cache,
 * giữ nguyên {@code content_hash}, và LLM client không được gọi.
 *
 * <p>Hợp đồng cache: unlock chỉ gọi LLM khi node (và mọi sibling cùng industry+cefr+strategy)
 * chưa có content. Model/tier đổi cũng không invalidate cache — chỉ regen chủ động ở P5 mới
 * thay content.
 */
@SpringBootTest
@DisplayName("skill-tree content cache vs khung tier")
class SkillTreeContentCacheIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private SkillTreeService skillTreeService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    // Mock để (a) khẳng định LLM KHÔNG bị gọi khi cache hit, (b) nếu có bug regenerate thì
    // test fail rõ ràng thay vì bắn request Groq thật từ CI.
    @MockBean private OpenAiChatClient chatClient;

    private static final String CONTENT_JSON = "{\"lesson\":\"cached\",\"exercises\":[]}";
    private static final String CONTENT_HASH = "hash-truoc-khi-route-tier-0000000000000000";

    @Test
    @DisplayName("node đã có content_json → unlock trả CACHE, content_hash giữ nguyên, LLM im lặng")
    void unlockCachedNode_doesNotRegenerate() {
        User learner = userRepository.save(User.builder()
                .email("cache-tier-" + System.nanoTime() + "@local.test")
                .passwordHash("x")
                .displayName("Cache Tier")
                .role(User.Role.STUDENT)
                .build());

        Long nodeId = jdbcTemplate.queryForObject("""
                INSERT INTO skill_tree_nodes
                    (node_type, title_de, title_vi, cefr_level, industry, vocab_strategy,
                     content_json, content_hash, content_generated_at, content_model)
                VALUES ('SATELLITE_LEAF', 'Pflege Basics', 'Điều dưỡng cơ bản', 'A1', 'Pflege-IT-Test',
                        'CONTEXT', ?::jsonb, ?, NOW(), 'openai/gpt-oss-120b')
                RETURNING id
                """, Long.class, CONTENT_JSON, CONTENT_HASH);

        Object response = skillTreeService.unlockSatelliteNode(learner.getId(), nodeId);

        assertThat(response).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response;
        assertThat(body.get("source"))
                .as("Node có content sẵn phải trả thẳng từ cache, không sinh lại")
                .isEqualTo("CACHE");

        String hashAfter = jdbcTemplate.queryForObject(
                "SELECT content_hash FROM skill_tree_nodes WHERE id = ?", String.class, nodeId);
        assertThat(hashAfter)
                .as("content_hash phải giữ nguyên sau unlock — tier route không invalidate cache")
                .isEqualTo(CONTENT_HASH);

        verifyNoInteractions(chatClient);
    }
}
