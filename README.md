# Multi-Tenant Hybrid Search Engine

A lightweight example of a multi-tenant search service that combines:

- Full-text search using PostgreSQL `tsvector` / `ts_rank_cd` (BM25-style ranking)
- Semantic search using vector embeddings (`pgvector`)
- Multi-tenant isolation using PostgreSQL Row-Level Security (RLS)
- A simple Express API for indexing and searching documents

This project is designed to help you understand how a hybrid search system works in practice and how tenant-level data isolation is enforced in a shared database.

## Why this project exists

In many real-world systems, a single database stores data for multiple customers or tenants. A naive query may accidentally return data from another tenant. This project demonstrates a practical pattern:

1. Each document has a `tenant_id`
2. Every search request is executed inside a tenant-scoped database session
3. Row-Level Security restricts visibility to only the current tenant
4. Search results are blended from both keyword and semantic signals

The result is a search engine that can handle both:

- exact keyword matching and lexical search
- meaning-based retrieval using embeddings

## High-level architecture

```text
Client / API Request
        |
        v
Express API (src/index.js)
        |
        +--> /api/documents (src/routes/documents.js)
        |         |
        |         +--> generate embedding with OpenAI / embedding model
        |         +--> insert document into PostgreSQL
        |         +--> run hybrid search (BM25 + vector)
        |
        +--> withTenant() sets app.current_tenant
                   |
                   v
              PostgreSQL
              - documents table
              - pgvector embeddings
              - tsvector for fast text search
              - RLS policy for tenant isolation
```

## Core workflow

### 1. Data ingestion

When a document is submitted:

- the API reads `title`, `body`, and optional `meta`
- it generates an embedding for `title + body`
- it stores the record in the `documents` table with:
  - `tenant_id`
  - `title`
  - `body`
  - `meta_json`
  - `embedding`
  - generated `tsv` column for full-text indexing

This means every document can be searched by:

- text relevance (BM25-like ranking using `tsvector`)
- semantic similarity (vector distance)

### 2. Tenant-aware database session

The project uses `withTenant(tenantId, userFn)` in `src/db.js`:

```js
await client.query("SET LOCAL app.current_tenant = $1", [tenantId]);
```

This sets a database session variable that is then checked by the Row-Level Security policy. In other words, each query is executed “as if” it belongs to the current tenant.

### 3. Hybrid search

When a search request comes in:

- the query is converted into an embedding
- a keyword search is run on the text index
- a vector search is run against the embeddings
- both result sets are normalized and merged
- the final ranking is returned to the client

The blending logic lives in `src/utils/hybrid.js`.

### 4. Tenant isolation

The project enables RLS on the `documents` table and adds a policy:

```sql
CREATE POLICY tenant_isolation ON documents
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

This guarantees that a tenant can only access rows belonging to their own `tenant_id`.

## Project structure

```text
.
├── .env.example
├── Doscker-compose.yaml
├── README.md
├── RSL.sql
├── schema.sql
└── src
    ├── db.js
    ├── embed.js
    ├── index.js
    ├── routes
    │   └── documents.js
    └── utils
        └── hybrid.js
```

### Important files

- `schema.sql` — creates the `documents` table, pgvector extension, and indexes
- `RSL.sql` — enables Row-Level Security for tenant isolation
- `src/db.js` — database pool and tenant-scoped query helper
- `src/embed.js` — embedding generation layer
- `src/routes/documents.js` — CRUD + hybrid search API
- `src/utils/hybrid.js` — merges BM25 + vector scores
- `src/index.js` — Express app bootstrap

## Technical concepts you should know

### 1. Full-text search with PostgreSQL

The `documents` table stores a generated `tsv` column:

```sql
tsv VECTOR GENERATED ALWAYS AS ...
```

This gives PostgreSQL a searchable text representation and allows ranking using `ts_rank_cd`.

This is useful when the user searches for keywords such as:

- "invoice"
- "refund policy"
- "customer onboarding"

### 2. Semantic search with embeddings

A text query is turned into an embedding using a model such as OpenAI `text-embedding-ada-002`.

The database then compares the query vector against stored document vectors using vector distance (`<=>` in pgvector).

This helps when the query is not an exact keyword match but expresses the same concept in different words.

### 3. Hybrid retrieval

Hybrid search is powerful because it combines both signals:

- keyword relevance
- semantic similarity

The ranking helper does this by:

- normalizing both score sets to a comparable range
- combining scores using configured weights
- returning the best overall matches

### 4. Multi-tenancy and security

This project demonstrates a common SaaS pattern:

- all tenant data is stored in the same table
- the current tenant is set in a database session
- RLS ensures read/write access is restricted to the current tenant

This is more secure than simply filtering application-side results, because the database enforces the restriction.

## Prerequisites

Before running the project, make sure you have:

- Node.js
- PostgreSQL with `pgvector` support
- Docker (optional, for local database setup)
- An OpenAI API key or another embedding provider

## Quick start

### 1. Configure environment variables

Copy `.env.example` to a local `.env` file and update the values:

```bash
cp .env.example .env
```

Example:

```env
DATABASE_URL=postgres://admin:secret@localhost:5432/search
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXX
```

### 2. Start PostgreSQL with Docker

The repo includes `Doscker-compose.yaml`:

```bash
docker compose -f Doscker-compose.yaml up -d
```

This starts a PostgreSQL container with the `pgvector` image.

### 3. Initialize the database schema

Run the schema file:

```bash
psql "$DATABASE_URL" -f schema.sql
```

Then enable the tenant isolation policy:

```bash
psql "$DATABASE_URL" -f RSL.sql
```

### 4. Start the application

Run the Express server:

```bash
node src/index.js
```

If your environment uses a different runner or package script, use that instead. The API listens on port `3000` by default.

## API behavior

### Insert a document

```bash
curl -X POST http://localhost:3000/api/documents \
  -H "x-tenant-id: 11111111-1111-1111-1111-111111111111" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Customer refund policy",
    "body": "Refunds are processed within 7 business days for eligible purchases.",
    "meta": { "category": "support" }
  }'
```

### Search documents

```bash
curl "http://localhost:3000/api/documents/search?q=refund+policy&bm25Weight=0.6" \
  -H "x-tenant-id: 11111111-1111-1111-1111-111111111111"
```

### Fetch one document

```bash
curl http://localhost:3000/api/documents/1 \
  -H "x-tenant-id: 11111111-1111-1111-1111-111111111111"
```

## Search flow in plain English

Here is the normal end-to-end workflow:

1. The client sends a search request with `x-tenant-id`
2. The app validates that a tenant ID is present
3. A query embedding is generated from the user input
4. PostgreSQL runs:
   - a text search for keyword matches
   - a vector search for semantic matches
5. The two result sets are merged and re-ranked
6. The API returns the best results only from that tenant
7. RLS makes sure no other tenant’s data leaks into the response

## Notes and ideas for improvement

This project is a strong starting point, but real production systems often add:

- JWT-based tenant authentication
- background job queues for embeddings
- caching for frequent queries
- pagination and filtering
- more advanced ranking strategies
- observability and monitoring
- separate vector index tuning for large datasets

## Summary

This repository demonstrates a practical hybrid search architecture for multi-tenant SaaS applications:

- text search for exact matches
- semantic search for meaning-based retrieval
- vector database support via `pgvector`
- database-enforced tenant isolation via RLS
- a simple Express API to tie the system together

If you are learning search systems, this project is useful because it shows the full pipeline from indexing to ranking, while also introducing the key ideas behind multi-tenant data security.
