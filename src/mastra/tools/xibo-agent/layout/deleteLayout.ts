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
 * Layout Deletion Tool
 * This module provides functionality to delete existing layouts in Xibo CMS
 * with appropriate error handling and validation
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool for deleting layouts in Xibo CMS
 * Makes a DELETE request to the CMS API to remove an existing layout
 */
export const deleteLayout = createTool({
  id: 'delete-layout',
  description: 'Deletes a layout from Xibo CMS',
  inputSchema: z.object({
    layoutId: z.number().describe('Layout ID to delete')
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string()
  }),
  execute: async ({ context }) => {
    try {
      logger.info(`Deleting layout with ID: ${context.layoutId}`);

      if (!config.cmsUrl) {
        logger.error("CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      // Get authentication headers for the API request
      const headers = await getAuthHeaders();

      // Construct the API endpoint URL for the layout deletion
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;
      logger.debug(`Sending DELETE request to ${url}`);

      // Make a DELETE request to the Xibo CMS API
      const response = await fetch(url, {
        method: 'DELETE',
        headers: headers
      });

      // Handle error responses from the API
      if (!response.ok) {
        const errorText = await response.text();
        const decodedError = decodeErrorMessage(errorText);
        logger.error(`Failed to delete layout: ${decodedError}`, {
          status: response.status,
          layoutId: context.layoutId
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${decodedError}`);
      }

      logger.info(`Layout ID ${context.layoutId} deleted successfully`);
      return { success: true, message: "Layout deleted successfully" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in deleteLayout: ${errorMessage}`, {
        error,
        layoutId: context.layoutId
      });
      return { 
        success: false, 
        message: `Error occurred: ${errorMessage}`
      };
    }
  },
}); 