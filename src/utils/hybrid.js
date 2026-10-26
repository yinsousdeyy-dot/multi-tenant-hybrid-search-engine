// – combine BM25 & vector scores

/**
 * Normalise an array of numbers to [0, 1] using min‑max scaling.
 */
function normalize(scores) {
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max === min) return scores.map(() => 1); // all equal → give full weight
  return scores.map((s) => (s - min) / (max - min));
}

/**
 * Given two result sets (keyword & semantic) return a merged, ranked array.
 *
 * @param {Array} keywordRows  [{id, title, body, rank}] – rank = ts_rank_cd
 * @param {Array} vectorRows   [{id, title, body, distance}] – distance = l2
 * @param {Object} weights      {keyword: 0.6, semantic: 0.4}
 */
export function mergeResults(keywordRows, vectorRows, weights = { keyword: 0.6, semantic: 0.4 }) {
  // Map by id for fast lookup
  const vecMap = new Map(vectorRows.map((r) => [r.id, r]));

  // Normalise scores
  const kwScores = keywordRows.map((r) => r.rank);
  const vecScores = vectorRows.map((r) => -r.distance); // we want *higher* = better, so invert distance

  const kwNorm = normalize(kwScores);
  const vecNorm = normalize(vecScores);

  // Build combined list
  const combined = [];

  // Add all keyword rows (they may already be in vector set)
  keywordRows.forEach((row, idx) => {
    const vec = vecMap.get(row.id);
    const semanticScore = vec ? vecNorm[vectorRows.findIndex((v) => v.id === row.id)] : 0;
    const finalScore = weights.keyword * kwNorm[idx] + weights.semantic * semanticScore;

    combined.push({ ...row, semantic_distance: vec?.distance, finalScore });
    // Remove from vecMap so we don't double‑count later
    if (vec) vecMap.delete(row.id);
  });

  // Add any remaining pure‑vector rows (no BM25 match)
  let vecIdx = 0;
  for (const [id, vec] of vecMap.entries()) {
    const semanticScore = vecNorm[vecIdx];
    const finalScore = weights.semantic * semanticScore; // keyword part = 0
    combined.push({
      id,
      title: vec.title,
      body: vec.body,
      rank: 0,
      semantic_distance: vec.distance,
      finalScore,
    });
    vecIdx++;
  }

  // Sort by finalScore descending
  combined.sort((a, b) => b.finalScore - a.finalScore);
  return combined;
}
