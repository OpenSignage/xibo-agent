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
 * Xibo CMS Time Retrieval Tool
 * 
 * This module provides functionality to retrieve the current time from the Xibo CMS API.
 * It connects to the /api/clock endpoint to get the server's current time, which is useful
 * for synchronization and scheduling operations in the Xibo ecosystem.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { createLogger } from '@mastra/core/logger';

const logger = createLogger({ name: 'xibo-agent:misc:getCmsTime' });

/**
 * Tool for retrieving the current time from Xibo CMS
 * 
 * This tool doesn't require any input parameters and returns
 * a JSON string containing the server's current time information.
 */
export const getCmsTime = createTool({
  id: 'get-cms-time',
  description: 'Get the current time from Xibo CMS',
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

      const response = await fetch(`${config.cmsUrl}/api/clock`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return JSON.stringify(data);
    } catch (error: unknown) {
      logger.error(`getCmsTime: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
