//  – CRUD + hybrid search

import { Router } from "express";
import { withTenant } from "../db.js";
import { getEmbedding } from "../embed.js";
import { mergeResults } from "../utils/hybrid.js";

const router = Router();

/**
 * Middleware that extracts `tenant-id` header and stores it on req.tenantId.
 * In production you would validate a JWT / API key instead.
 */
router.use((req, res, next) => {
  const tenant = req.header("x-tenant-id");
  if (!tenant) return res.status(400).json({ error: "Missing X-Tenant-Id header" });
  req.tenantId = tenant;
  next();
});

/* ---------- INSERT DOCUMENT ---------- */
router.post("/", async (req, res) => {
  const { title, body, meta } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title & body required" });

  // 1️⃣ Generate embedding (async, could be done in background queue)
  const embedding = await getEmbedding(`${title}\n${body}`);

  try {
    const result = await withTenant(req.tenantId, async (client) => {
      const sql = `
        INSERT INTO documents (tenant_id, title, body, meta_json, embedding)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at;
      `;
      const values = [req.tenantId, title, body, meta || {}, embedding];
      const { rows } = await client.query(sql, values);
      return rows[0];
    });
    res.status(201).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error" });
  }
});

/* ---------- HYBRID SEARCH ---------- */
router.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "q param required" });

  // Parameters that affect blending
  const bm25Weight = parseFloat(req.query.bm25Weight) || 0.6;    // default 0.6
  const semanticWeight = 1 - bm25Weight;                        // must sum to 1

  // 1️⃣ Generate query embedding
  const queryEmbedding = await getEmbedding(query);

  // 2️⃣ Run both searches inside the same tenant session
  const { keywordRows, vectorRows } = await withTenant(req.tenantId, async (client) => {
    // ---- Keyword (BM25) ----
    const kwSQL = `
      SELECT
        id, title, body,
        ts_rank_cd(tsv, query) AS rank
      FROM documents,
           to_tsquery('simple', $1) query
      WHERE tsv @@ query
      ORDER BY rank DESC
      LIMIT 50;  -- tune based on UI
    `;
    const kwRes = await client.query(kwSQL, [query]);

    // ---- Semantic (vector) ----
    const vecSQL = `
      SELECT
        id, title, body,
        embedding <=> $1::vector AS distance   -- L2 distance
      FROM documents
      ORDER BY embedding <=> $1::vector
      LIMIT 50;
    `;
    const vecRes = await client.query(vecSQL, [queryEmbedding]);

    return { keywordRows: kwRes.rows, vectorRows: vecRes.rows };
  });

  // 3️⃣ Merge and rank
  const merged = mergeResults(keywordRows, vectorRows, {
    keyword: bm25Weight,
    semantic: semanticWeight,
  });

  // 4️⃣ Return a tidy payload
  res.json({
    query,
    results: merged.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: r.body.slice(0, 200) + (r.body.length > 200 ? "…" : ""),
      bm25Score: parseFloat(r.rank?.toFixed(4) ?? 0),
      semanticDistance: parseFloat(r.semantic_distance?.toFixed(4) ?? 0),
      finalScore: parseFloat(r.finalScore.toFixed(4)),
    })),
  });
});

/* ---------- OPTIONAL: GET ONE DOCUMENT ---------- */
router.get("/:id", async (req, res) => {
  const docId = req.params.id;
  try {
    const doc = await withTenant(req.tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, title, body, meta_json, created_at FROM documents WHERE id = $1`,
        [docId]
      );
      return rows[0];
    });

    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
