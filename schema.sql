-- 1️⃣ Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector
CREATE EXTENSION IF NOT EXISTS btree_gin;   -- for GIN on vector (optional)
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- optional for fuzzy text
CREATE EXTENSION IF NOT EXISTS unaccent;    -- optional for better tokenisation

-- 2️⃣ Table that holds documents for all tenants
CREATE TABLE documents (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID NOT NULL,                     -- tenant identifier
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    meta_json   JSONB DEFAULT '{}'::jsonb,        -- any extra data
    created_at  TIMESTAMPTZ DEFAULT now(),

    -- Full‑text search
    tsv         TSVECTOR GENERATED ALWAYS AS (
                     setweight(to_tsvector('simple', coalesce(title,'')), 'A')
                   || setweight(to_tsvector('simple', coalesce(body,'')),  'B')
                 ) STORED,

    -- Semantic vector (embedding)
    embedding   VECTOR(1536)   -- size depends on model, e.g. OpenAI Ada‑002 = 1536
);

-- 3️⃣ Indexes
-- BM25 (PostgreSQL uses GIN + `pg_catalog` default weighting)
CREATE INDEX idx_documents_tsv ON documents USING GIN (tsv);

-- Approximate nearest‑neighbor index for vectors (ivfflat)
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_l2_ops) 
    WITH (lists = 100);   -- tune lists / probes per workload

-- Optional: index on tenant_id for RLS fast‑path (though primary key already includes it)
CREATE INDEX idx_documents_tenant ON documents (tenant_id);
