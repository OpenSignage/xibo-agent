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
 * Schema for layout usage by other layouts response
 * Contains information about which other layouts reference this layout
 * and when it was last used
 */
const layoutUsageByLayoutsSchema = z.object({
  layoutId: z.number(),
  layout: z.string(),
  count: z.number(),
  lastUsed: z.string().nullable(),
  usedIn: z.array(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string()
  }))
});

/**
 * Tool to get information about which other layouts reference this layout
 * Implements the layout/usage/layouts endpoint from Xibo API
 * Useful for understanding layout dependencies and references
 */
export const getLayoutUsageByLayouts = createTool({
  id: 'get-layout-usage-by-layouts',
  description: 'Get information about which other layouts reference this layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to check usage by other layouts')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/usage/layouts/${context.layoutId}`;

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      const data = await response.json();
      const validatedData = layoutUsageByLayoutsSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 