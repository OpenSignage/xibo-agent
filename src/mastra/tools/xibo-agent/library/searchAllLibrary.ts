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
 * Xibo CMS Library Search Tool
 * 
 * This module provides functionality to search all media in the Xibo CMS library.
 * It implements the library search API endpoint and handles the necessary validation
 * and data transformation for library search operations.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Tool for searching all media in Xibo CMS library
 * 
 * This tool provides functionality to:
 * - Search all media in the library
 * - Retrieve comprehensive media information
 * - Handle media data validation and transformation
 * 
 * Note: This tool does not require any input parameters as it searches all media
 * in the library. The _placeholder parameter is used to satisfy the tool creation
 * requirements while maintaining a clean interface.
 */
export const searchAllLibrary = createTool({
  id: "search-all-library",
  description: "Search all media in Xibo CMS library",
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.any(),
  execute: async () => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/library/search`);
    logger.debug(`Requesting library search from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    // Handle error response
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to search library:', {
        status: response.status,
        error: errorText
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

    // Return successful response data
    const data = await response.json();
    return data;
  },
}); 