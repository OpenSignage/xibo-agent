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

export const webSearchTool = createTool({
  id: 'web-search',
  description: 'Performs a web search for a given query and returns a list of relevant pages.',
  inputSchema: z.object({
    query: z.string().describe('The search query.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { query } = context;
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY environment variable is not set.');
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
        const errorText = await response.text();
        logger.error(`Brave Search API error: ${response.status}`, { error: errorText });
        throw new Error(`Brave Search API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const results = (data.web?.results || []).map((item: any) => ({
        title: item.title,
        url: item.url,
        description: item.description,
      }));

      return { results };
    } catch (error) {
      logger.error('Failed to execute web search', { error });
      throw error;
    }
  },
}); 