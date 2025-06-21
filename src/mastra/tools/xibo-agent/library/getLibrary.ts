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
 * Xibo CMS Library Management Tool
 * 
 * This module provides functionality to search and retrieve media from the Xibo CMS library.
 * It implements the library API endpoint and handles the necessary validation
 * and data transformation for library operations.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

// Schema for a single media item in the library, based on actual API response
const mediaSchema = z.object({
  mediaId: z.number(),
  ownerId: z.number(),
  parentId: z.number().nullable(),
  name: z.string(),
  mediaType: z.string(),
  storedAs: z.string(),
  fileName: z.string(),
  tags: z.array(
    z.object({
      tag: z.string(),
      tagId: z.number(),
      value: z.string().nullable(),
    })
  ).optional(),
  fileSize: z.number(),
  duration: z.number(),
  valid: z.number(),
  moduleSystemFile: z.number(),
  expires: z.number(),
  retired: z.number(),
  isEdited: z.number(),
  md5: z.string().nullable(),
  owner: z.string(),
  groupsWithPermissions: z.string().nullable(),
  released: z.number(),
  apiRef: z.string().nullable(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  enableStat: z.string().nullable(),
  orientation: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  folderId: z.number(),
  permissionsFolderId: z.number(),
  
  // Add new fields from the actual response data
  thumbnail: z.string().nullable().optional(),
  fileSizeFormatted: z.string().nullable().optional(),
  isSaveRequired: z.any().nullable().optional(),
  isRemote: z.any().nullable().optional(),
  cloned: z.boolean().nullable().optional(),
  newExpiry: z.any().nullable().optional(),
  alwaysCopy: z.boolean().nullable().optional(),
  revised: z.number().nullable().optional(),
}).passthrough(); // Allow other fields not explicitly defined

/**
 * Tool for searching and retrieving media from Xibo CMS library
 * 
 * This tool provides functionality to:
 * - Search media by various criteria (ID, name, type, owner, etc.)
 * - Filter media based on tags and folder structure
 * - Handle media data validation and transformation
 */
export const getLibrary = createTool({
  id: "get-library",
  description: "Search and retrieve media from Xibo CMS library",
  inputSchema: z.object({
    mediaId: z.number().optional().describe("Filter by media ID"),
    media: z.string().optional().describe("Filter by media name (partial match)"),
    type: z.string().optional().describe("Filter by media type"),
    ownerId: z.number().optional().describe("Filter by owner ID"),
    retired: z.number().optional().describe("Filter by retired status (0-1)"),
    tags: z.string().optional().describe("Filter by tags"),
    folderId: z.number().optional().describe("Filter by folder ID"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.array(mediaSchema).optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    const logContext = { ...context };
    logger.info("Attempting to retrieve library media", logContext);

    if (!config.cmsUrl) {
      logger.error("CMS URL is not configured.", logContext);
      return { success: false, error: "CMS URL is not configured." };
    }

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      
      const url = new URL(`${config.cmsUrl}/api/library`);
      url.search = params.toString();

      logger.debug(`Requesting library data from: ${url.toString()}`, logContext);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = decodeErrorMessage(errorText);
        logger.error('Failed to retrieve library data from CMS API.', {
          ...logContext,
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        return { 
          success: false, 
          message: `API request failed with status ${response.status}.`,
          error: "Failed to fetch library media.", 
          errorData 
        };
      }

      const data = await response.json();
      
      // Handle cases where the API returns an empty array for "not found"
      if (Array.isArray(data) && data.length === 0) {
        logger.info("No media found matching the criteria.", logContext);
        return { success: true, data: [] };
      }

      // Validate the received data against our schema
      const validationResult = z.array(mediaSchema).safeParse(data);

      if (!validationResult.success) {
        logger.warn("API response validation failed for getLibrary.", {
          ...logContext,
          error: validationResult.error.flatten(),
          rawData: data,
        });
        return { 
          success: false, 
          error: "Response validation failed.", 
          errorData: validationResult.error.issues 
        };
      }
      
      logger.info("Successfully retrieved and validated library media.", logContext);
      return { success: true, data: validationResult.data };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error("An unexpected error occurred in getLibrary.", {
        ...logContext,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { success: false, error: "An unexpected error occurred.", message: errorMessage };
    }
  },
}); 