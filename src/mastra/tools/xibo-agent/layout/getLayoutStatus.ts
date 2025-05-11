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
 * Schema for layout status response
 * Contains information about the layout's current status,
 * publication state, and locking information
 */
const layoutStatusSchema = z.object({
  status: z.number(),
  message: z.string().nullable(),
  publishedStatusId: z.number(),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  isLocked: z.boolean(),
  lockedBy: z.string().nullable(),
  lockedAt: z.string().nullable()
});

/**
 * Tool to get the current status of a layout
 * Implements the layout/status endpoint from Xibo API
 * Provides information about publication state, locking status, and more
 */
export const getLayoutStatus = createTool({
  id: 'get-layout-status',
  description: 'Get the current status of a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to check status for')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/status/${context.layoutId}`;

      const response = await fetch(url, {
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      const data = await response.json();
      const validatedData = layoutStatusSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 