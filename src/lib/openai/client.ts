import "server-only";
import OpenAI from "openai";

export const AI_MODEL = "gpt-4.1-mini";

export function createOpenAiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
