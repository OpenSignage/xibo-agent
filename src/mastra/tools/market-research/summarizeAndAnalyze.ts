/*
 * Copyright (C) 2025 Open Source Digital Signage Initiative.
 *
 * You can redistribute it and/or modify
 * it under the terms of the Elastic License 2.0 (ELv2) as published by
 * the Search AI Company, either version 3 of the License, or
 * any later version.
 *
 * You should have received a copy of the GElastic License 2.0 (ELv2).
 * see <https://www.elastic.co/licensing/elastic-license>.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { logger } from '../../logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * @module summarizeAndAnalyzeTool
 * @description A tool to summarize and analyze text using Google's Generative AI.
 * Supports temperature and topP parameters for controlling response creativity and focus.
 */
const outputSchema = z.object({
  summary: z.string().describe('The generated summary or analysis of the text.'),
});

// Structured error response schema.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

// Structured success response schema.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});

export const summarizeAndAnalyzeTool = createTool({
  id: 'summarize-and-analyze',
  description: 'Summarizes or analyzes a given block of text based on a specific objective.',
  inputSchema: z.object({
    text: z.string().describe('The text to be processed.'),
    objective: z.string().describe('The goal of the analysis (e.g., "Summarize the key findings").'),
    temperature: z.number().optional().default(0.7).describe('Controls randomness in the response (0.0-1.0, default: 0.7). Lower values make responses more focused and deterministic.'),
    topP: z.number().optional().default(0.9).describe('Controls diversity via nucleus sampling (0.0-1.0, default: 0.9). Lower values make responses more focused.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  /** Call Gemini API once with basic retry on quota/429. */
  execute: async ({ context }) => {
    const { text, objective, temperature = 0.7, topP = 0.9 } = context;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const message = 'GEMINI_API_KEY environment variable is not set.';
      logger.error(message);
      return { success: false, message } as const;
    }

    // Helper: sleep
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runOnce = async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: temperature,
          topP: topP,
        }
      });
      const prompt = `${objective}:\n\n---\n\n${text}\n\n---\n\n`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();
      return { success: true as const, data: { summary } };
    };

    try {
      return await runOnce();
    } catch (error: any) {
      // Extract status/code and optional retry delay if available
      const status: number | null = (error && (error.statusCode || error.status || error.response?.status)) ?? null;
      const code: string | null = (error && (error.code || error.statusText)) ?? null;
      const retryInfo = (error && (error.retryDelay || error.response?.headers?.['retry-after'])) ?? null;
      const retryMs = typeof retryInfo === 'string' && /s$/.test(retryInfo)
        ? Number(retryInfo.replace(/s$/, '')) * 1000
        : Number(retryInfo) * 1000 || 8000;

      // Only backoff-and-retry once for 429-like conditions
      if (status === 429 || (typeof (error?.message) === 'string' && /quota|rate/i.test(error.message))) {
        logger.warn({ status, code, retryMs }, 'Gemini quota/rate error; backing off and retrying once');
        try {
          await sleep(Math.max(2000, Math.min(20000, retryMs)));
          return await runOnce();
        } catch (e2: any) {
          const status2: number | null = (e2 && (e2.statusCode || e2.status || e2.response?.status)) ?? null;
          const code2: string | null = (e2 && (e2.code || e2.statusText)) ?? null;
          logger.error({ status: status2, code: code2 }, 'Summarize retry failed');
          return { success: false as const, message: 'Gemini API rate limit exceeded. Please retry later.', error: { status: status2, code: code2 } };
        }
      }

      const message = error instanceof Error ? error.message : 'An unknown error occurred during text analysis.';
      logger.error({ status, code }, 'Failed to analyze text');
      return { success: false as const, message, error: { status, code } };
    }
  },
}); 