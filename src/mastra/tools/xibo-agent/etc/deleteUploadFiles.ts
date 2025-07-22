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
 * @module deleteUploadFiles
 * @description Provides a tool to delete files from the 'persistent_data/upload' directory
 * either by a specific list of paths or by a glob-like pattern.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { logger } from '../../../logger';
import fs from 'fs';
import path from 'path';

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  deleted: z.array(z.string()).describe("A list of successfully deleted file paths."),
  failed: z.array(z.object({
    path: z.string().describe("The path of the file that failed to be deleted."),
    error: z.string().describe("The reason for the deletion failure."),
  })).describe("A list of files that failed to be deleted, with reasons."),
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
 * Tool for deleting files from the upload directory.
 */
export const deleteUploadFiles = createTool({
  id: "delete-upload-files",
  description: "Deletes files from the 'persistent_data/upload' directory.",
  inputSchema: z.object({
    pattern: z.string().optional().describe("Pattern to match files (e.g., '*.png', 'image-*.jpg')."),
    paths: z.array(z.string()).optional().describe("Array of specific file paths to delete relative to the upload directory."),
  }).refine(data => data.pattern || data.paths, {
    message: "Either 'pattern' or 'paths' must be provided.",
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    const deleted: string[] = [];
    const failed: { path: string; error: string }[] = [];
    const uploadDir = config.uploadDir;

    // Ensure upload directory exists.
    if (!fs.existsSync(uploadDir)) {
      logger.warn(`Upload directory '${uploadDir}' does not exist. Nothing to delete.`);
      return { success: true, deleted, failed };
    }

    // Gather all files to be deleted.
    const filesToDelete = new Set<string>();
    if (input.paths) {
      input.paths.forEach(p => filesToDelete.add(p));
    }

    if (input.pattern) {
      try {
        const items = await fs.promises.readdir(uploadDir, { withFileTypes: true });
        for (const item of items) {
          if (item.isFile() && matchPattern(item.name, input.pattern)) {
            filesToDelete.add(item.name);
          }
        }
      } catch (error: any) {
        const message = `Failed to read upload directory: ${error.message}`;
        logger.error(message, { error });
        return { success: false, message, error };
      }
    }

    if (filesToDelete.size === 0) {
      logger.info("No files matched the criteria for deletion.");
      return { success: true, deleted, failed };
    }

    // Delete the files.
    for (const file of filesToDelete) {
      const fullPath = path.join(uploadDir, file);
      try {
        if (fs.existsSync(fullPath)) {
            await fs.promises.unlink(fullPath);
            deleted.push(file);
            logger.info(`Successfully deleted file: ${fullPath}`);
        } else {
            const errorMsg = "File not found.";
            failed.push({ path: file, error: errorMsg });
            logger.warn(`${errorMsg}: ${fullPath}`);
        }
      } catch (error: any) {
        failed.push({ path: file, error: error.message });
        logger.error(`Failed to delete file '${fullPath}': ${error.message}`, { error });
      }
    }

    return {
      success: true,
      deleted,
      failed,
    };
  },
});

/**
 * Helper function to match filename against a simple glob-like pattern.
 */
function matchPattern(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex.
  const regexPattern = pattern
    .replace(/\./g, '\\.')  // Escape dots.
    .replace(/\*/g, '.*')   // Convert * to .*.
    .replace(/\?/g, '.');   // Convert ? to ..
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filename);
} 