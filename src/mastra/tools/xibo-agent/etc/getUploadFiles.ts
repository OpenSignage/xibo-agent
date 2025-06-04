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
import { logger } from '../../../index';
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
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(fileInfoSchema),
  error: z.object({
    status: z.number(),
    message: z.string()
  }).optional()
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
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      const uploadDir = config.uploadDir;

      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        try {
          await fs.promises.mkdir(uploadDir, { recursive: true });
          logger.info(`Created directory: ${uploadDir}`);
        } catch (mkdirError) {
          logger.error(`Failed to create directory: ${uploadDir}`, { error: mkdirError });
          return {
            success: false,
            data: [],
            error: {
              status: 500,
              message: `Failed to create directory: ${uploadDir}`
            }
          };
        }
      }

      const files = await getFiles(uploadDir, context.pattern);
      
      return {
        success: true,
        data: files
      };
    } catch (error) {
      logger.error(`getUploadFiles: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        data: [],
        error: {
          status: 500,
          message: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  },
});

/**
 * Helper function to get files from directory
 */
async function getFiles(dir: string, pattern?: string): Promise<z.infer<typeof fileInfoSchema>[]> {
  const files: z.infer<typeof fileInfoSchema>[] = [];
  
  const items = await fs.promises.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    if (item.isFile()) {
      // Skip if pattern is provided and file doesn't match
      if (pattern && !matchPattern(item.name, pattern)) {
        continue;
      }

      const fullPath = path.join(dir, item.name);
      const stats = await fs.promises.stat(fullPath);
      
      files.push({
        name: item.name,
        path: item.name,
        size: stats.size,
        type: path.extname(item.name).slice(1) || 'unknown',
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      });
    }
  }
  
  return files;
}

/**
 * Helper function to match file pattern
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