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
 * @module getAgentLog
 *
 * This module provides a tool to read and format local agent log files.
 * It retrieves the last N log entries, searching across multiple rotated log files if necessary.
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../../../logger';

// Schema for the tool's input
const inputSchema = z.object({
  limit: z.number().optional().default(10).describe('The number of log entries to return. Defaults to 10.'),
});

// Schema for a single formatted log entry in the output
const prettyLogEntrySchema = z.object({
  level: z.string().describe('The log level (e.g., INFO, ERROR).'),
  time: z.string().describe('The timestamp in a readable format.'),
  msg: z.string().describe('The log message.'),
}).passthrough();


// Schema for the tool's output
const outputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.object({
    logEntries: z.array(prettyLogEntrySchema).optional().describe('The requested log entries, formatted for readability.'),
    filesRead: z.array(z.string()).optional().describe('The log files that were read to fulfill the request.'),
  }).optional(),
});

const levelMap: { [key: number]: string } = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

/**
 * A tool to get the latest log entries from local agent log files, searching across files if necessary.
 */
export const getAgentLog = createTool({
  id: 'get-agent-log',
  description: 'Retrieves the last N log entries, searching across multiple agent log files if needed.',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    try {
      const { limit } = context;
      const logsDir = config.logsDir;

      const allFiles = await fs.readdir(logsDir);
      const logFileNames = allFiles.filter(file => file.startsWith('agent.log'));

      if (logFileNames.length === 0) {
        logger.warn('No agent log files found in the logs directory.');
        return { success: false, message: 'No agent log files found.' };
      }

      const filesWithStats = await Promise.all(
        logFileNames.map(async file => {
          const stats = await fs.stat(path.join(logsDir, file));
          return { name: file, mtime: stats.mtime };
        })
      );

      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const sortedLogFiles = filesWithStats.map(f => f.name);

      let combinedEntries: any[] = [];
      const filesRead: string[] = [];

      for (const fileName of sortedLogFiles) {
        const filePath = path.join(logsDir, fileName);
        filesRead.push(fileName);
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim() !== '');
            const entriesInFile = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { level: levelMap[50], time: Date.now(), msg: `[PARSE_ERROR] ${line}` };
                }
            });
            combinedEntries = [...entriesInFile, ...combinedEntries];
            if (combinedEntries.length >= limit) {
                break;
            }
        } catch (readError) {
            logger.error({ error: readError, fileName }, 'Could not read or process log file.');
        }
      }

      const finalEntries = combinedEntries.slice(-limit);

      const prettifiedLogs = finalEntries.map(entry => {
        const { level, time, msg, ...rest } = entry;
        return {
          level: levelMap[level] || `UNKNOWN_LEVEL_${level}`,
          time: new Date(time).toLocaleString('ja-JP', { hour12: false }),
          msg: msg || '',
          ...rest,
        };
      });
      
      logger.info(`Successfully retrieved ${prettifiedLogs.length} log entries from ${filesRead.length} file(s).`);
      return {
        success: true,
        data: {
          logEntries: prettifiedLogs.reverse(),
          filesRead: filesRead,
        },
      };
    } catch (error: any) {
      logger.error({ error }, 'An unexpected error occurred while getting agent logs.');
      return { success: false, message: error.message || 'An unexpected error occurred.' };
    }
  },
}); 