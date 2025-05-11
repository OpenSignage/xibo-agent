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
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for region position data
 * Defines the position and size of a region within a layout
 */
const regionPositionSchema = z.object({
  regionId: z.number(),
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number()
});

/**
 * Tool to position all regions within a layout
 * Implements the region/position/all endpoint from Xibo API
 * Allows for batch positioning of multiple regions at once
 */
export const positionRegions = createTool({
  id: 'position-regions',
  description: 'Set the position of all regions in a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to position regions for'),
    regions: z.array(regionPositionSchema).describe('Array of region position information')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/region/position/all/${context.layoutId}`;

      const formData = new FormData();
      context.regions.forEach(region => {
        formData.append('regions[]', JSON.stringify(region));
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      return "Region positions set successfully";
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 