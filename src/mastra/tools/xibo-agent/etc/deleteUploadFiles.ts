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
 * Delete Upload Files Tool
 * 
 * This module provides functionality to delete files from the upload directory.
 * It supports deleting files by pattern or specific paths.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { logger } from '../../../index';
import fs from 'fs';
import path from 'path';

/**
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    deleted: z.array(z.string()),
    failed: z.array(z.object({
      path: z.string(),
      error: z.string()
    }))
  }),
  error: z.object({
    status: z.number(),
    message: z.string()
  }).optional()
});

/**
 * Tool for deleting files from the upload directory
 */
export const deleteUploadFiles = createTool({
  id: "delete-upload-files",
  description: "Delete files from the upload directory",
  inputSchema: z.object({
    pattern: z.string().optional().describe("Pattern to match files (e.g., *.png, image-*.jpg)"),
    paths: z.array(z.string()).optional().describe("Array of specific file paths to delete"),
    force: z.boolean().optional().describe("Force deletion without checking if file exists")
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      const deleted: string[] = [];
      const failed: { path: string; error: string }[] = [];

      // Ensure upload directory exists
      if (!fs.existsSync(config.uploadDir)) {
        try {
          await fs.promises.mkdir(config.uploadDir, { recursive: true });
          logger.info(`Created upload directory: ${config.uploadDir}`);
        } catch (mkdirError) {
          logger.error(`Failed to create upload directory: ${config.uploadDir}`, { error: mkdirError });
          return {
            success: false,
            data: {
              deleted: [],
              failed: []
            },
            error: {
              status: 500,
              message: `Failed to create upload directory: ${config.uploadDir}`
            }
          };
        }
      }

      // Get files to delete
      const filesToDelete = context.paths || [];
      
      // If pattern is provided, add matching files
      if (context.pattern) {
        const items = await fs.promises.readdir(config.uploadDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isFile() && matchPattern(item.name, context.pattern)) {
            filesToDelete.push(item.name);
          }
        }
      }

      // Delete files
      for (const filePath of filesToDelete) {
        const fullPath = path.join(config.uploadDir, filePath);

        // Check if file exists unless force is true
        if (!context.force && !fs.existsSync(fullPath)) {
          failed.push({
            path: filePath,
            error: "File not found"
          });
          continue;
        }

        try {
          await fs.promises.unlink(fullPath);
          deleted.push(filePath);
        } catch (error) {
          failed.push({
            path: filePath,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      return {
        success: true,
        data: {
          deleted,
          failed
        }
      };
    } catch (error) {
      logger.error(`deleteUploadFiles: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        data: {
          deleted: [],
          failed: []
        },
        error: {
          status: 500,
          message: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  },
});

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