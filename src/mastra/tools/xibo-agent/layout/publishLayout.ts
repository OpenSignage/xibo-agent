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
 * Tool to publish a layout
 * Implements the layout/{id}/publish endpoint from Xibo API
 * Publishing a layout makes it available for display on devices
 */
export const publishLayout = createTool({
  id: 'publish-layout',
  description: 'Publish a layout to make it available for display',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to publish')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/publish`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      return "Layout published successfully";
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 