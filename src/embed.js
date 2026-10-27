import dotenv from "dotenv";
dotenv.config();

const EMBED_URL = process.env.EMBED_SERVICE_URL || "http://localhost:8001/embed";

export async function getEmbedding(text) {
  const response = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding service failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}
