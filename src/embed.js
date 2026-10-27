// generate embeddings (OpenAI example)

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Returns an embedding array for the provided text.
 */
export async function getEmbedding(text) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });

  return response.data[0].embedding;
}
