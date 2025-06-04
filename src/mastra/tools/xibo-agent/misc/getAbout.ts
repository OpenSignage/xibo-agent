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
 * Xibo CMS About Information Tool
 * 
 * This module provides functionality to retrieve version and source information
 * from the Xibo CMS API. It accesses the /api/about endpoint to get details
 * about the CMS version and source code repository URL.
 * 
 * The tool is useful for:
 * - Checking CMS version compatibility
 * - Verifying installation status
 * - Accessing source code repository information
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Schema for the about response from Xibo API
 * 
 * The API returns:
 * - version: Current CMS version (e.g., "3.0.0")
 * - sourceUrl: URL to the source code repository (can be null)
 */
const aboutResponseSchema = z.object({
  version: z.string(),
  sourceUrl: z.string().nullable(),
});

/**
 * Tool for retrieving Xibo CMS version information
 * 
 * This tool doesn't require any input parameters and returns
 * a JSON object containing:
 * - version: Current CMS version
 * - sourceUrl: Source code repository URL (if available)
 */
export const getAbout = createTool({
  id: 'get-about',
  description: 'Get Xibo CMS version and source information',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: aboutResponseSchema.optional(),
    message: z.string(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      // Check if CMS URL is configured
      if (!config.cmsUrl) {
        return {
          success: false,
          message: "Failed to get CMS information",
          error: "CMS URL is not configured"
        };
      }

      // Get authentication headers
      const headers = await getAuthHeaders();
      
      // Call CMS API
      const response = await fetch(`${config.cmsUrl}/api/about`, {
        headers,
      });

      // Handle API errors
      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          message: "Failed to get CMS information",
          error: decodeErrorMessage(text)
        };
      }

      // Parse and validate response
      const data = await response.json();
      const validatedData = aboutResponseSchema.parse(data);

      // Return formatted response
      return {
        success: true,
        data: validatedData,
        message: "Successfully retrieved CMS information"
      };
    } catch (error) {
      logger.error(`getAbout: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        message: "Failed to get CMS information",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});
