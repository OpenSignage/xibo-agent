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
 * Xibo CMS Media Addition Tool
 * 
 * This module provides functionality to add new media to the Xibo CMS library.
 * It implements the media addition API endpoint and handles the necessary validation
 * and data transformation for media operations.
 * 
 * The tool expects the file to be already present in the standard upload directory:
 * {uploadDir}/
 *   ├── images/
 *   ├── videos/
 *   ├── documents/
 *   ├── fonts/
 *   └── sketchs/
 * 
 * Where {uploadDir} is configured in config.ts (default: ./upload)
 * 
 * Usage example:
 * {
 *   filePath: "./upload/images/example.jpg",
 *   name: "My Media",
 *   type: "image",
 *   duration: 0
 * }
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import path from 'path';
import fs from 'fs';

/**
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    duration: z.number(),
    fileName: z.string(),
    size: z.number(),
    md5: z.string(),
    createdAt: z.string(),
    modifiedAt: z.string(),
    modifiedBy: z.string(),
  }),
});

/**
 * Tool for adding media to Xibo CMS library
 * 
 * This tool provides functionality to:
 * - Add new media to the library
 * - Upload media files to the CMS
 * - Set media properties (name, type, duration, etc.)
 * - Handle media data validation and transformation
 */
export const addMedia = createTool({
  id: "add-media",
  description: "Add new media to Xibo CMS library",
  inputSchema: z.object({
    filePath: z.string().describe("Path to media file in the standard upload directory"),
    name: z.string().describe("Name of the media"),
    type: z.string().describe("Type of the media"),
    duration: z.number().describe("Duration of the media in seconds"),
    tags: z.string().optional().describe("Tags for the media"),
    folderId: z.number().optional().describe("ID of the folder to store the media"),
    enableStat: z.string().optional().describe("Enable statistics for the media"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      const url = new URL(`${config.cmsUrl}/api/library`);
      const formData = new FormData();
      
      // Validate file exists
      if (!fs.existsSync(context.filePath)) {
        throw new Error(`File not found: ${context.filePath}`);
      }
      
      // Create file object from local file
      const fileStream = fs.createReadStream(context.filePath);
      const fileBlob = new Blob([await streamToBuffer(fileStream)]);
      const fileName = path.basename(context.filePath);
      
      // Add to form data
      formData.append("files", new File([fileBlob], fileName));
      
      // Add other parameters
      formData.append("name", context.name);
      formData.append("type", context.type);
      formData.append("duration", context.duration.toString());
      if (context.tags) formData.append("tags", context.tags);
      if (context.folderId) formData.append("folderId", context.folderId.toString());
      if (context.enableStat) formData.append("enableStat", context.enableStat);

      logger.debug(`Requesting media addition to: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          // Don't set Content-Type header, let the browser set it with the boundary
        },
        body: formData,
      });

      // Handle error response
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to add media:', {
          status: response.status,
          error: errorText,
          fileName: context.filePath,
          mediaName: context.name
        });
        try {
          // Try to parse error response as JSON
          return JSON.parse(errorText);
        } catch {
          // If parsing fails, return error in standard format
          return {
            success: false,
            error: errorText
          };
        }
      }

      // Parse and validate the response
      const rawData = await response.json();
      logger.debug(`Raw upload response: ${JSON.stringify(rawData)}`);
      
      try {
        const validatedData = apiResponseSchema.parse(rawData);
        logger.info(`Media uploaded successfully: ${validatedData.data.name} (ID: ${validatedData.data.id})`);
        return validatedData;
      } catch (validationError) {
        logger.error(`Response validation error: ${validationError instanceof Error ? validationError.message : "Unknown validation error"}`, {
          rawData,
          error: validationError
        });
        
        // Fallback: Return raw data with success flag if validation fails
        logger.warn("Returning unvalidated response due to schema mismatch");
        return { 
          success: true, 
          data: rawData.data || rawData 
        };
      }
    } catch (error) {
      logger.error(`addMedia: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

/**
 * Helper function to convert a readable stream to a buffer
 */
async function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
} 