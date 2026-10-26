// generate embeddings (OpenAI example)

import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";
dotenv.config();

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(config);

/**
 * Returns a Float32Array (or plain Array<number>) of size 1536 for the given text.
 */
export async function getEmbedding(text) {
  const resp = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: text,
  });
  // OpenAI returns a regular JS array of numbers.
  return resp.data.data[0].embedding;
}
