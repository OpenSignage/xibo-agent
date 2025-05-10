/*
 * Copyright (C) 2024 OpenSignage Project.
 * All rights reserved.
 *
 * This software is licensed under the Elastic License 2.0 (ELv2).
 * You may obtain a copy of the license at:
 * https://www.elastic.co/licensing/elastic-license
 */

/**
 * AI Model Configuration
 * This file configures and exports various AI models used in the application
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// Create Google Gemini AI provider
export const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

// Initialize embedding model instance
export const googleEmbeddingModel =
    google.textEmbeddingModel("text-embedding-004");

// Claude 3.7 Thinking model instance
export const claudeThinkingModel = "anthropic/claude-3.7-sonnet:thinking";

// Initialize OpenAI client with OpenRouter configuration
const openai = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: "https://openrouter.ai/api/v1",
});

// OpenRouter Claude 3.7 Thinking model specification
const openRouterClaudeThinkingModel = "anthropic/claude-3-7-sonnet:thinking";

// Export OpenRouter model configuration
export const openRouter = openai(openRouterClaudeThinkingModel);