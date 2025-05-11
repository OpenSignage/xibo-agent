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
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/unretire/${context.layoutId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      return "Layout unretired successfully";
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 