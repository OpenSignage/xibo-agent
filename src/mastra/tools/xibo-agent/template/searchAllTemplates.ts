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
 * Xibo CMS Template Search Tool (All Sources)
 * 
 * This module provides functionality to search for templates
 * from all sources (local and connectors) in the Xibo CMS system.
 * It implements the template/search endpoint from Xibo API.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to search for templates from all sources
 * Implements the template/search endpoint from Xibo API
 */
export const searchAllTemplates = createTool({
  id: 'search-all-templates',
  description: 'Search for templates from all sources (local and connectors)',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.array(z.string()),
  execute: async () => {
    try {
      if (!config.cmsUrl) {
        logger.error("searchAllTemplates: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info("Searching for templates from all sources");
      
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/template/search`;

      logger.debug(`Sending GET request to ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Parse response data
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(JSON.stringify(data));
        logger.error(`Failed to search templates: ${errorMessage}`, {
          status: response.status
        });
        return data;
      }

      logger.info("Successfully retrieved templates from all sources");
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`searchAllTemplates: An error occurred: ${errorMessage}`, { error });
      return [];
    }
  },
}); 