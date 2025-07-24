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
 * @description A tool to summarize and analyze text content using an LLM.
 */
const outputSchema = z.object({
  summary: z.string().describe('The generated summary or analysis.'),
});

export const summarizeAndAnalyzeTool = createTool({
  id: 'summarize-and-analyze',
  description: 'Summarizes or analyzes a given text based on a specific objective.',
  inputSchema: z.object({
    text: z.string().describe('The text content to be analyzed.'),
    objective: z.string().describe('The objective of the analysis (e.g., "Summarize the key points", "Extract all mentions of competitors").'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { text, objective } = context;
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.');
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

      const prompt = `Based on the following text, please perform this objective: "${objective}".

Text:
---
${text}
---

Result:`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      return { summary };
    } catch (error) {
      logger.error('Failed to generate summary with LLM', { error });
      throw error;
    }
  },
}); 