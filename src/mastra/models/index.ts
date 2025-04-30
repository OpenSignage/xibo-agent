import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// Google Gemini AIプロバイダーの作成
export const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

// エンべディングモデルのインスタンス
export const googleEmbeddingModel =
    google.textEmbeddingModel("text-embedding-004");

// anthropic/claude-3.7-sonnet:thinking
// Claude 3.7 Thinking モデルのインスタンス
export const claudeThinkingModel = "anthropic/claude-3.7-sonnet:thinking";

const openai = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: "https://openrouter.ai/api/v1",
});

// OpenRouter経由でのClaude 3.7 Thinkingモデル指定
const openRouterClaudeThinkingModel = "anthropic/claude-3-7-sonnet:thinking";

// OpenRouter経由でのモデル利用設定
export const openRouter = openai(openRouterClaudeThinkingModel);