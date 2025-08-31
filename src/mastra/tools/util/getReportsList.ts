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

/**
 * getReportsList tool
 *
 * This tool lists all saved report files (Markdown and PDF) under
 * persistent_data/generated/reports, returning file name, size, and
 * a human-friendly created time string (e.g., "2025/8/31 23:45") for each entry.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { config } from '../xibo-agent/config';
import fs from 'fs/promises';
import path from 'path';

export const getReportsList = createTool({
  id: 'get-reports-list',
  description: 'List all saved reports (md/pdf) in persistent_data/generated/reports.',
  inputSchema: z.object({}),
  outputSchema: z.union([ z.object({ success: z.literal(true), data: z.object({ reports: z.array(z.object({ fileName: z.string(), size: z.number(), createdAt: z.string() })) }) }), z.object({ success: z.literal(false), message: z.string() }) ]),
  execute: async () => {
    try {
      const dir = config.reportsDir;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const files = entries.filter(e => e.isFile()).map(e => e.name).filter(n => /\.(md|pdf)$/i.test(n));
      const statsWithTime = await Promise.all(files.map(async (name) => {
        const full = path.join(dir, name);
        const st = await fs.stat(full);
        return { fileName: name, size: st.size, mtimeMs: st.mtimeMs };
      }));
      // Sort by newest first using mtimeMs, but do not expose mtimeMs in output
      statsWithTime.sort((a, b) => b.mtimeMs - a.mtimeMs);
      const reports = statsWithTime.map(({ fileName, size, mtimeMs }) => {
        const d = new Date(mtimeMs);
        const createdAt = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        return { fileName, size, createdAt };
      });
      return { success: true as const, data: { reports } };
    } catch (err) {
      return { success: false as const, message: String(err) };
    }
  }
});

