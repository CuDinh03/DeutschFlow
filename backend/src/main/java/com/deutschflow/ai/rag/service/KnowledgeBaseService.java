package com.deutschflow.ai.rag.service;

import com.deutschflow.ai.rag.entity.KnowledgeBase;
import com.deutschflow.ai.rag.repository.KnowledgeBaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KnowledgeBaseService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final EmbeddingClient embeddingClient;

    @Transactional
    public void addDocument(String cefrLevel, String topic, String content) {
        float[] embedding = embeddingClient.getEmbedding(content);

        KnowledgeBase kb = KnowledgeBase.builder()
                .cefrLevel(cefrLevel)
                .topic(topic)
                .content(content)
                .embedding(embedding)
                .build();

        knowledgeBaseRepository.save(kb);
    }

    @Transactional(readOnly = true)
    public String searchRelevantContext(String userMessage, String cefrLevel, int limit) {
        try {
            float[] embedding = embeddingClient.getEmbedding(userMessage);
            
            // Format float array to PostgreSQL vector string format: "[0.1, 0.2, ...]"
            String vectorString = Arrays.toString(embedding);

            List<KnowledgeBase> results = knowledgeBaseRepository.findSimilarContext(cefrLevel, vectorString, limit);
            
            if (results.isEmpty()) {
                return "";
            }

            StringBuilder contextBuilder = new StringBuilder();
            contextBuilder.append("Tham khảo tài liệu sau để giải thích cho học viên:\n\n");
            
            for (KnowledgeBase kb : results) {
                contextBuilder.append("--- [Chủ đề: ").append(kb.getTopic()).append("] ---\n");
                contextBuilder.append(kb.getContent()).append("\n\n");
            }
            return contextBuilder.toString();
            
        } catch (Exception e) {
            // Fallback gracefully if embedding fails
            return "";
        }
    }
}
