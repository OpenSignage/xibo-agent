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
import path from 'path';
import fs from 'fs/promises';
import { config } from '../xibo-agent/config';

/**
 * @module saveReportTool
 * @description A tool to save a market research report to a designated directory.
 */
const outputSchema = z.object({
  filePath: z.string().describe('The full, absolute path to the saved report file.'),
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

export const saveReportTool = createTool({
  id: 'save-market-research-report',
  description: 'Saves the provided market research report content to a timestamped Markdown file in a persistent storage directory. It returns the full, absolute path to the saved file.',
  inputSchema: z.object({
    title: z.string().describe('A descriptive title for the report (e.g., "Digital Signage Market Report"). This will be used to generate a safe filename.'),
    content: z.string().describe('The full text content of the report to save.'),
  }),
  outputSchema: z.union([successResponseSchema, errorResponseSchema]),
  execute: async ({ context }) => {
    const { title, content } = context;
    const reportsDir = config.reportsDir;

    // Generate filename from title and current date, preserving Japanese characters
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const dateStamp = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
    const fileName = `${sanitizedTitle}-${dateStamp}.md`;

    const safeFileName = path.basename(fileName); // Sanitize to prevent path traversal
    const filePath = path.join(reportsDir, safeFileName);

    // Security check: ensure the final path is within the intended directory
    if (!filePath.startsWith(reportsDir)) {
      const message = 'Error: Path traversal attempt detected.';
      logger.error({ fileName }, message);
      return { success: false, message } as const;
    }

    try {
      // Ensure the reports directory exists
      await fs.mkdir(reportsDir, { recursive: true });

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8');

      logger.info(`Successfully saved report to ${filePath}`);
      return {
        success: true,
        data: { filePath }
      } as const;

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred while saving the file.";
      logger.error({ error, filePath }, 'Failed to save file.');
      return {
        success: false,
        message,
        error,
      } as const;
    }
  },
}); 