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
 * Xibo CMS Media Upload from URL Tool
 * 
 * This module provides functionality to upload media to the Xibo CMS library from an external URL.
 * It implements the media upload API endpoint and handles the necessary validation
 * and data transformation for media operations.
 * 
 * Usage example:
 * {
 *   url: "https://example.com/image.jpg",
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
 * Tool for uploading media to Xibo CMS library from URL
 * 
 * This tool provides functionality to:
 * - Upload media from external URL to CMS
 * - Set media properties (name, type, duration, etc.)
 * - Handle media data validation and transformation
 */
export const uploadMediaFromURL = createTool({
  id: "upload-media-from-url",
  description: "Upload media to Xibo CMS library from external URL",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to the media"),
    type: z.enum(['image', 'video', 'font', 'document']).describe("The type of the media"),
    extension: z.string().optional().describe("Optional extension of the media (jpg, png etc.)"),
    enableStat: z.enum(['On', 'Off', 'Inherit']).optional().describe("Enable Media Proof of Play statistics"),
    optionalName: z.string().optional().describe("Optional name for the media file"),
    expires: z.string().optional().describe("Expiration date in Y-m-d H:i:s format"),
    folderId: z.number().optional().describe("Folder ID to assign the media to"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not set");
      }

      // Upload to CMS
      const url = new URL(`${config.cmsUrl}/api/library/uploadUrl`);
      const params = new URLSearchParams();
      
      // Add required parameters
      params.append("url", context.url);
      params.append("type", context.type);
      
      // Add optional parameters
      if (context.extension) params.append("extension", context.extension);
      if (context.enableStat) params.append("enableStat", context.enableStat);
      if (context.optionalName) params.append("optionalName", context.optionalName);
      if (context.expires) params.append("expires", context.expires);
      if (context.folderId) params.append("folderId", context.folderId.toString());

      logger.debug(`Requesting media addition to: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      // Handle error response
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to add media:', {
          status: response.status,
          error: errorText,
          url: context.url,
          mediaName: context.optionalName || context.type
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
      logger.error(`uploadMediaFromURL: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
}); 