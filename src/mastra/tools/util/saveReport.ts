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

// Remove common AI preamble from the beginning of a report
function sanitizeReportContent(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const preambles: RegExp[] = [
    /^(?:はい、?承知いたしました。?|承知しました。?|かしこまりました。?|了解しました。?)(?:\s*\n)+/,
    /^(?:ご提供いただいた情報に基づき[^\n]*?作成します。?)(?:\s*\n)+/,
    /^(?:では、?以下の[^\n]*)(?:\s*\n)+/,
    /^(?:次のとおり[^\n]*)(?:\s*\n)+/,
    /^(?:Sure[,\s].*|Okay[,\s].*|I (?:will|can) .*)(?:\s*\n)+/i,
  ];
  const removeLeadingSeparators = () => {
    let changed = false;
    while (/^(?:\*{3,}|-{3,}|_{3,})\s*\n/.test(text)) {
      text = text.replace(/^(?:\*{3,}|-{3,}|_{3,})\s*\n/, '');
      changed = true;
    }
    return changed;
  };
  let iterations = 0;
  while (iterations++ < 10) {
    const before = text;
    text = text.replace(/^(?:\s*\n)+/, '');
    let matched = false;
    for (const re of preambles) {
      const m = text.match(re);
      if (m && m.index === 0) {
        text = text.slice(m[0].length);
        matched = true;
        break;
      }
    }
    const sepRemoved = removeLeadingSeparators();
    if (!matched && !sepRemoved && before === text) break;
  }
  return text.replace(/^(?:\s*\n)+/, '');
}

/**
 * @module saveReportTool
 * @description A tool to save a market research report to a designated directory.
 */
const outputSchema = z.object({
  filePath: z.string().describe('The full, absolute path to the saved report file.'),
  pdfFileName: z.string().describe('The PDF file name saved alongside the markdown (e.g., "xxxx.pdf").'),
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
  description: 'Saves the report as markdown and also renders a PDF version in the same directory.',
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

      // Sanitize content before saving
      const sanitized = sanitizeReportContent(content);
      await fs.writeFile(filePath, sanitized, 'utf-8');

      // Render PDF into the same directory using md-to-pdf
      const pdfFileName = safeFileName.replace(/\.md$/i, '.pdf');
      const pdfPath = path.join(reportsDir, pdfFileName);
      try {
        const { mdToPdf } = await import('md-to-pdf');
        await mdToPdf({ path: filePath }, { dest: pdfPath });
        logger.info({ pdfPath }, 'Saved report to file.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error({ error: msg, filePath }, 'Failed to generate PDF from markdown');
        return {
          success: false,
          message: `PDF生成に失敗しました: ${msg}`,
          error: e as any,
        } as const;
      }

      logger.info({ filePath }, 'Saved report to file.');
      return {
        success: true,
        data: { filePath, pdfFileName }
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