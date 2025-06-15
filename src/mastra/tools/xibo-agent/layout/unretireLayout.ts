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
 * Xibo CMS Layout Unretirement Tool
 * 
 * This module provides functionality to unretire a previously retired layout
 * in the Xibo CMS system. It implements the layout/{id}/unretire endpoint
 * from Xibo API. Unretiring a layout makes it available for scheduling again.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to unretire a previously retired layout
 * Implements the layout/{id}/unretire endpoint from Xibo API
 * Makes the layout available for scheduling again
 */
export const unretireLayout = createTool({
  id: 'unretire-layout',
  description: 'Unretire a layout to make it available for scheduling again',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to unretire')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      // Log the start of layout unretirement process
      logger.info(`Unretiring layout with ID: ${context.layoutId}`);

      // Validate CMS URL configuration
      if (!config.cmsUrl) {
        logger.error("CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      // Prepare API request
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/unretire/${context.layoutId}`;
      logger.debug(`Sending PUT request to ${url}`);

      // Send unretirement request to CMS
      const response = await fetch(url, {
        method: 'PUT',
        headers,
      });

      // Handle error response
      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to unretire layout: ${errorMessage}`, {
          status: response.status,
          layoutId: context.layoutId
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Log successful unretirement
      logger.info(`Layout ID ${context.layoutId} unretired successfully`);
      return "Layout unretired successfully";
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in unretireLayout: ${errorMessage}`, {
        error,
        layoutId: context.layoutId
      });
      return `Error: ${errorMessage}`;
    }
  },
}); 