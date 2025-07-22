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
 * @module delete-region
 * @description This module provides a tool to delete a region from a layout,
 * implementing the DELETE /api/region/{id} endpoint of the Xibo CMS API.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../logger';

/**
 * Tool to delete a specific region from a layout in the Xibo CMS.
 */
export const deleteRegion = createTool({
  id: 'delete-region',
  description: 'Delete a region from a layout',
  inputSchema: z.object({
    id: z.number().describe('The ID of the region to be deleted.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.object({}).optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        const errorMessage = "deleteRegion: CMS URL is not configured";
        logger.error(errorMessage);
        return { success: false, message: "CMS URL is not configured" };
      }

      logger.info(`Attempting to delete region with ID: ${context.id}`);

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/region/${context.id}`;

      logger.debug("deleteRegion: Sending request to Xibo CMS", {
        url,
        method: 'DELETE'
      });

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (response.status === 204) {
        logger.info(`Region ${context.id} deleted successfully.`);
        return {
          success: true,
          data: {}
        };
      }

      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }

        logger.error("deleteRegion: Failed to delete region", {
          status: response.status,
          error: parsedError
        });

        return {
          success: false,
          message: `Failed to delete region. Status: ${response.status}`,
          errorData: parsedError
        };
      }
      // This part should ideally not be reached if status is 204 or not ok.
      // Handling for other successful statuses like 200 with content.
      return {
        success: true,
        data: {}
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("deleteRegion: An unexpected error occurred", {
        error: errorMessage
      });
      return {
        success: false,
        message: errorMessage
      };
    }
  },
});
