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
import { pdfToText } from 'pdf-ts';
import Tesseract from 'tesseract.js';

/**
 * @module pdfScrapeTool
 * @description A tool to scrape textual content from a PDF URL using a hybrid approach with pdf-ts and Tesseract.js OCR.
 */
const outputSchema = z.object({
  url: z.string().url(),
  content: z.string().describe('The extracted text content of the PDF file.'),
  method: z.enum(['pdf-ts', 'tesseract', 'hybrid']).describe('The method used for extraction.'),
});

const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

const successResponseSchema = z.object({
  success: z.literal(true),
  data: outputSchema,
});

export const pdfScrapeTool = createTool({
  id: 'pdf-scrape',
  description: 'Fetches a PDF from a URL and extracts its text content using pdf-ts, with Tesseract.js OCR as a fallback for image-based PDFs.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the PDF file to scrape.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { url } = context;
    logger.info({ url }, `Attempting to scrape PDF content with hybrid approach...`);

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000, // Increased timeout for potentially long OCR process
      });
      const buffer = Buffer.from(response.data);

      // 1. Try extracting text with pdf-ts
      logger.info(`Parsing PDF with pdf-ts...: ${url}`);
      let textFromPdfTs = '';
      try {
        textFromPdfTs = await pdfToText(buffer);
        logger.info({ url, length: textFromPdfTs.length }, 'Successfully extracted text with pdf-ts');
      } catch (pdfTsError) {
        logger.warn({ url, error: pdfTsError }, 'pdf-ts failed to extract text. This might be an image-based PDF or a corrupted file.');
      }

      // 2. If pdf-ts returns little or no text, use Tesseract.js OCR as a fallback
      let textFromOcr = '';
      let method: 'pdf-ts' | 'tesseract' | 'hybrid' = 'pdf-ts';

      if (textFromPdfTs.replace(/\s/g, '').length < 100) {
        logger.info({ url }, 'pdf-ts extracted minimal text. Attempting OCR with Tesseract.js...');
        
        const result = await Tesseract.recognize(buffer, 'jpn+eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    logger.info(`Tesseract OCR progress: ${Math.round(m.progress * 100)}%`);
                }
            },
        });
        textFromOcr = result.data.text;
        method = textFromPdfTs.length > 0 ? 'hybrid' : 'tesseract';
        logger.info({ url, length: textFromOcr.length }, 'Successfully extracted text with Tesseract.js');
      }

      const combinedText = `${textFromPdfTs}\n\n${textFromOcr}`;
      const cleanedContent = combinedText.replace(/\s\s+/g, ' ').trim();
      
      logger.info({ url, finalLength: cleanedContent.length, method }, `Successfully scraped PDF.`);
      return {
        success: true,
        data: { url, content: cleanedContent, method }
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