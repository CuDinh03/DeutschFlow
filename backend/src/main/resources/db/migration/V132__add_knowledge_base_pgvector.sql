CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_base (
    id BIGSERIAL PRIMARY KEY,
    cefr_level VARCHAR(10) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index using HNSW for fast nearest neighbor search
-- Note: Requires pgvector >= 0.5.0. If using an older version, IVFFlat might be needed.
CREATE INDEX knowledge_base_embedding_idx ON knowledge_base USING hnsw (embedding vector_cosine_ops);
