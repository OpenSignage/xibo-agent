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
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { text, objective } = context;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const message = 'GEMINI_API_KEY environment variable is not set.';
      logger.error(message);
      return { success: false, message } as const;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
//      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `${objective}:\n\n---\n\n${text}\n\n---\n\n`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text();

      return { 
        success: true, 
        data: { summary }
      } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during text analysis.";
      logger.error('Failed to analyze text', { error });
      return { 
        success: false, 
        message,
        error 
      } as const;
    }
  },
}); 