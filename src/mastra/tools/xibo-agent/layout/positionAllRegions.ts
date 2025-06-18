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

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Tool to position all regions in a layout
 * Implements the layout/position endpoint from Xibo API
 * Updates the position of all regions in the specified layout
 */
export const positionAllRegions = createTool({
  id: 'position-all-regions',
  description: 'Position all regions in a layout',
  inputSchema: z.object({
    id: z.number().describe('The Layout ID to position regions in')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("positionAllRegions: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Positioning all regions in layout ${context.id}`);

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/position/${context.id}`;

      logger.debug("positionAllRegions: Request details", {
        url,
        method: 'POST',
        headers
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        const responseText = await response.text();
        const decodedText = decodeURIComponent(responseText);
        const parsedError = JSON.parse(decodedText);
        logger.error("positionAllRegions: API error response", {
          status: response.status,
          error: parsedError.error,
          message: parsedError.message,
          property: parsedError.property,
          help: parsedError.help
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${parsedError.message}`,
          error: parsedError
        };
      }

      return {
        success: true,
        message: 'Regions positioned successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});
