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
import * as cheerio from 'cheerio';

/**
 * @module contentScrapeTool
 * @description A tool to scrape the main textual content from a given URL.
 */
const outputSchema = z.object({
  url: z.string().url(),
  content: z.string().describe('The extracted main text content of the web page.'),
});

export const contentScrapeTool = createTool({
  id: 'content-scrape',
  description: 'Fetches a URL and extracts its main text content, removing HTML tags and boilerplate.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the web page to scrape.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { url } = context;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script, style, and other non-content tags
      $('script, style, nav, header, footer, aside').remove();

      // Get text from the body, which tends to be the main content area
      const content = $('body').text();
      const cleanedContent = content.replace(/\s\s+/g, ' ').trim(); // Clean up whitespace

      return { url, content: cleanedContent };
    } catch (error) {
      logger.error(`Failed to scrape content from ${url}`, { error });
      throw error;
    }
  },
}); 