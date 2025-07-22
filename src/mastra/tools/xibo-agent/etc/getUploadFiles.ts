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
 * Upload Files List Tool
 * 
 * This module provides functionality to list files in the upload directory.
 * It supports filtering by file pattern and provides detailed file information.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { logger } from '../../../logger';  
import fs from 'fs';
import path from 'path';

/**
 * Schema for file information
 */
const fileInfoSchema = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  type: z.string(),
  modifiedAt: z.string(),
  createdAt: z.string()
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.array(fileInfoSchema).describe("An array of objects containing file information."),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
    error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

/**
 * Tool for listing files in the upload directory
 */
export const getUploadFiles = createTool({
  id: "get-upload-files",
  description: "List files in the upload directory",
  inputSchema: z.object({
    pattern: z.string().optional().describe("Filter files by pattern (e.g., *.png, image-*.jpg)"),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    const uploadDir = config.uploadDir;

    // If the upload directory doesn't exist, return an empty list as there are no files.
    if (!fs.existsSync(uploadDir)) {
      logger.warn(`Upload directory '${uploadDir}' does not exist. Returning empty list.`);
      return { success: true, data: [] };
    }

    try {
      const allFiles = await fs.promises.readdir(uploadDir, { withFileTypes: true });
      const filesInfo: z.infer<typeof fileInfoSchema>[] = [];

      for (const item of allFiles) {
        if (item.isFile()) {
          // If a pattern is provided, skip files that don't match.
          if (input.pattern && !matchPattern(item.name, input.pattern)) {
            continue;
          }

          const fullPath = path.join(uploadDir, item.name);
          const stats = await fs.promises.stat(fullPath);
          
          filesInfo.push({
            name: item.name,
            path: item.name, // Path is relative to the upload directory
            size: stats.size,
            type: path.extname(item.name).slice(1) || 'unknown',
            modifiedAt: stats.mtime.toISOString(),
            createdAt: stats.birthtime.toISOString(),
          });
        }
      }
      
      logger.info(`Found ${filesInfo.length} file(s) in '${uploadDir}'${input.pattern ? ` matching pattern '${input.pattern}'` : ''}.`);
      return {
        success: true,
        data: filesInfo,
      };
    } catch (error: any) {
      const message = `Failed to read or stat files in upload directory: ${error.message}`;
      logger.error(message, { error });
      return {
        success: false,
        message,
        error,
      };
    }
  },
});

/**
 * Helper function to match filename against a simple glob-like pattern.
 */
function matchPattern(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // Escape dots
    .replace(/\*/g, '.*')   // Convert * to .*
    .replace(/\?/g, '.');   // Convert ? to .
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filename);
} 