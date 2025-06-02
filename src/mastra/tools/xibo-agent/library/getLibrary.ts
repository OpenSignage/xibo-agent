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
  outputSchema: z.any(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/library`);
    if (context.mediaId) url.searchParams.append("mediaId", context.mediaId.toString());
    if (context.media) url.searchParams.append("media", context.media);
    if (context.type) url.searchParams.append("type", context.type);
    if (context.ownerId) url.searchParams.append("ownerId", context.ownerId.toString());
    if (context.retired) url.searchParams.append("retired", context.retired.toString());
    if (context.tags) url.searchParams.append("tags", context.tags);
    if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());

    logger.debug(`Requesting library data from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to retrieve library data:', {
        status: response.status,
        error: errorText
      });
      try {
        return JSON.parse(errorText);
      } catch {
        return {
          success: false,
          error: errorText
        };
      }
    }

    const data = await response.json();
    return data;
  },
}); 