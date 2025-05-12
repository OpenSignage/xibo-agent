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
 * Xibo CMS Layout Clear Tool
 * 
 * This module provides functionality to clear all regions and widgets from a layout
 * in the Xibo CMS system, resulting in an empty canvas while preserving layout settings.
 * It implements the layout/{id} POST endpoint from Xibo API.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to clear all regions and widgets from a layout
 * Implements the layout endpoint with POST method from Xibo API
 * This resets the layout to an empty canvas while preserving layout settings
 */
export const clearLayout = createTool({
  id: 'clear-layout',
  description: 'Clear all content from a layout canvas',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to clear')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("clearLayout: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Clearing layout with ID: ${context.layoutId}`);
      
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;

      logger.debug(`Sending POST request to ${url} to clear layout`);
      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to clear layout ${context.layoutId}: ${errorMessage}`, {
          statusCode: response.status,
          response: responseText
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Process successful response
      logger.info(`Successfully cleared layout ${context.layoutId}`);
      return "Layout cleared successfully";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`clearLayout: An error occurred: ${errorMessage}`, { error });
      return `Error: ${errorMessage}`;
    }
  },
}); 