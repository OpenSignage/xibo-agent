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
 * It supports filtering by file type and provides detailed file information.
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
    type: z.string().optional().describe("Filter files by type (images, videos, documents, fonts, sketchs, temporaries)"),
    recursive: z.boolean().optional().describe("Include files in subdirectories")
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      const uploadDir = config.uploadDir;
      const targetDir = context.type 
        ? path.join(uploadDir, config.uploadPaths[context.type as keyof typeof config.uploadPaths] || '')
        : uploadDir;

      // Create directory if it doesn't exist
      if (!fs.existsSync(targetDir)) {
        try {
          await fs.promises.mkdir(targetDir, { recursive: true });
          logger.info(`Created directory: ${targetDir}`);
        } catch (mkdirError) {
          logger.error(`Failed to create directory: ${targetDir}`, { error: mkdirError });
          return {
            success: false,
            data: [],
            error: {
              status: 500,
              message: `Failed to create directory: ${targetDir}`
            }
          };
        }
      }

      const files = await getFiles(targetDir, context.recursive || false);
      
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
async function getFiles(dir: string, recursive: boolean): Promise<z.infer<typeof fileInfoSchema>[]> {
  const files: z.infer<typeof fileInfoSchema>[] = [];
  
  const items = await fs.promises.readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory() && recursive) {
      const subFiles = await getFiles(fullPath, recursive);
      files.push(...subFiles);
    } else if (item.isFile()) {
      const stats = await fs.promises.stat(fullPath);
      const relativePath = path.relative(config.uploadDir, fullPath);
      const type = path.dirname(relativePath);
      
      files.push({
        name: item.name,
        path: relativePath,
        size: stats.size,
        type: type || 'root',
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      });
    }
  }
  
  return files;
} 