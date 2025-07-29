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
import fs from 'fs/promises';
import officeParser from 'nodejs-pptx';

/**
 * @module powerpointExtractTool
 * @description A tool to extract text content from a PowerPoint (.pptx) file.
 */
const outputSchema = z.object({
  filePath: z.string(),
  content: z.string().describe('The extracted text content of the PowerPoint file.'),
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

export const powerpointExtractTool = createTool({
  id: 'powerpoint-extract',
  description: 'Extracts all text from a PowerPoint (.pptx) file located at the given path.',
  inputSchema: z.object({
    filePath: z.string().describe('The local file path of the .pptx file to extract text from.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { filePath } = context;
    logger.info({ filePath }, `Attempting to extract text from PowerPoint file...`);

    try {
      // Check if the file exists
      await fs.access(filePath);

      const buffer = await fs.readFile(filePath);
      
      const parser = new officeParser(buffer);
      const text = await parser.extractText();

      if (!text) {
        logger.warn({ filePath }, 'No text could be extracted from the PowerPoint file.');
        return {
          success: true,
          data: { filePath, content: '' },
        } as const;
      }

      const cleanedContent = text.replace(/\s\s+/g, ' ').trim();
      logger.info({ filePath, length: cleanedContent.length }, `Successfully extracted text from PowerPoint file.`);
      
      return {
        success: true,
        data: { filePath, content: cleanedContent },
      } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred during PowerPoint text extraction.";
      logger.error({ filePath, error }, `Failed to extract text from PowerPoint file.`);
      return {
        success: false,
        message,
        error,
      } as const;
    }
  },
}); 