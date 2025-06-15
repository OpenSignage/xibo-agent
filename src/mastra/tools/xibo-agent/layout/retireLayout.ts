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
 * Xibo CMS Layout Retirement Tool
 * 
 * This module provides functionality to retire a layout in the Xibo CMS system.
 * It implements the layout/{id}/retire endpoint from Xibo API.
 * Retiring a layout makes it unavailable for scheduling but preserves it in the system.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to retire a layout
 * Implements the layout/{id}/retire endpoint from Xibo API
 * Retiring a layout makes it unavailable for scheduling but preserves it in the system
 */
export const retireLayout = createTool({
  id: 'retire-layout',
  description: 'Retire a layout to make it unavailable for scheduling',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to retire')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      // Log the start of layout retirement process
      logger.info(`Retiring layout with ID: ${context.layoutId}`);

      // Validate CMS URL configuration
      if (!config.cmsUrl) {
        logger.error("CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      // Prepare API request
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/retire/${context.layoutId}`;
      logger.debug(`Sending PUT request to ${url}`);

      // Send retirement request to CMS
      const response = await fetch(url, {
        method: 'PUT',
        headers,
      });

      // Handle error response
      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to retire layout: ${errorMessage}`, {
          status: response.status,
          layoutId: context.layoutId
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Log successful retirement
      logger.info(`Layout ID ${context.layoutId} retired successfully`);
      return "Layout retired successfully";
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in retireLayout: ${errorMessage}`, {
        error,
        layoutId: context.layoutId
      });
      return `Error: ${errorMessage}`;
    }
  },
}); 