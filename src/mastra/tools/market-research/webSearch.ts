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

class BraveSearchApiError extends Error {
  constructor(message: string, public status: number, public details?: any) {
    super(message);
    this.name = 'BraveSearchApiError';
  }
}

/**
 * @module webSearchTool
 * @description A tool to perform web searches using the Brave Search API.
 */
const outputSchema = z.object({
  results: z.array(z.object({
    title: z.string().describe('The title of the search result.'),
    url: z.string().url().describe('The URL of the search result.'),
    description: z.string().optional().describe('A short description or snippet of the page content.'),
  })).describe('A list of search results.'),
});

// Structured error response schema, according to the coding rules.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

// Structured success response schema.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Performs a web search for a given query and returns a list of relevant pages.',
  inputSchema: z.object({
    query: z.string().describe('The search query.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { query } = context;
    const apiKey = process.env.BRAVE_API_KEY;

    if (!apiKey) {
      const errorMessage = 'BRAVE_API_KEY environment variable is not set.';
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      } as const;
    }

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorDetails = await response.text().catch(() => 'Could not read error details.');
        const message = `Brave Search API request failed with status ${response.status}`;
        logger.error(message, { details: errorDetails });
        return {
          success: false,
          message,
          errorData: errorDetails,
        } as const;
      }

      const data = await response.json();
      const validatedData = outputSchema.safeParse({
          results: (data.web?.results || []).map((item: any) => ({
            title: item.title,
            url: item.url,
            description: item.description,
          }))
      });

      if (!validatedData.success) {
        const message = "Validation error occurred";
        logger.error(message, { error: validatedData.error.format() });
        return {
          success: false,
          message: message,
          error: validatedData.error.format(),
          errorData: data,
        } as const;
      }
      
      return { success: true, data: validatedData.data } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during web search.";
      logger.error(message, { error });
      return { 
        success: false, 
        message,
        error: error
      } as const;
    }
  },
}); 