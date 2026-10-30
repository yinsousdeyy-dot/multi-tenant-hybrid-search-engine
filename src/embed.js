// generate embeddings via Ollama

import dotenv from "dotenv";

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "nomic-embed-text";

/**
 * Returns an embedding array for the provided text.
 * Uses a local Ollama embedding model instead of OpenAI.
 */
export async function getEmbedding(text) {
  const url = `${OLLAMA_BASE_URL.replace(/\/$/, "")}/api/embed`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embedding request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Ollama response shape can vary slightly by version.
  if (Array.isArray(data.embedding)) return data.embedding;
  if (Array.isArray(data.embeddings) && data.embeddings.length > 0) return data.embeddings[0];

  throw new Error("Unexpected Ollama embedding response format");
}
