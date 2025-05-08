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
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { createLogger } from '@mastra/core/logger';

const logger = createLogger({ name: 'xibo-agent:misc:getAbout' });

/**
 * Schema for the about response from Xibo API
 */
const aboutResponseSchema = z.object({
  version: z.string(),
  sourceUrl: z.string().nullable(),
});

/**
 * Tool for retrieving Xibo CMS version information
 */
export const getAbout = createTool({
  id: 'get-about',
  description: 'Get Xibo CMS version and source information',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      
      const response = await fetch(`${config.cmsUrl}/api/about`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = aboutResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      logger.error(`getAbout: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
