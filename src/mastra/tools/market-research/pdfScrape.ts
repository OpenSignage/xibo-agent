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
import axios from 'axios';
// import pdf from 'pdf-parse'; // <-- Remove static import

/**
 * @module pdfScrapeTool
 * @description A tool to scrape the main textual content from a given PDF URL.
 */
const outputSchema = z.object({
  url: z.string().url(),
  content: z.string().describe('The extracted text content of the PDF file.'),
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

export const pdfScrapeTool = createTool({
  id: 'pdf-scrape',
  description: 'Fetches a PDF from a URL and extracts its text content.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the PDF file to scrape.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { url } = context;
    logger.info({ url }, `Attempting to scrape PDF content...`);

    try {
      // More robust dynamic import for ESM/CJS compatibility
      const pdfParseModule = await import('pdf-parse');
      const pdf = pdfParseModule.default || pdfParseModule;

      const response = await axios.get(url, {
        responseType: 'arraybuffer', // Fetch PDF as a buffer
        timeout: 30000, // PDFs can be larger, so a longer timeout
      });

      // Use pdf-parse to extract text from the buffer
      const data = await pdf(response.data);
      const cleanedContent = data.text.replace(/\s\s+/g, ' ').trim();

      logger.info({ url, pages: data.numpages, chars: cleanedContent.length }, `Successfully scraped PDF.`);
      return {
        success: true,
        data: { url, content: cleanedContent }
      } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during PDF scraping.";
      logger.error({ url, error }, `Failed to scrape PDF.`);
      return {
        success: false,
        message,
        error,
      } as const;
    }
  },
}); 