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
 * Tool to enable or disable statistics collection for a layout
 * Implements the layout/setenablestat endpoint from Xibo API
 * Statistics tracking helps monitor how often and when layouts are displayed
 */
export const setLayoutEnableStat = createTool({
  id: 'set-layout-enable-stat',
  description: 'Enable or disable statistics collection for a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to change statistics setting for'),
    enableStat: z.number().min(0).max(1).describe('Enable statistics collection (0: disabled, 1: enabled)')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        return {
          success: false,
          message: "Failed to update layout statistics setting",
          error: "CMS URL is not configured"
        };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/setenablestat/${context.layoutId}`;

      const formData = new FormData();
      formData.append('enableStat', context.enableStat.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        return {
          success: false,
          message: "Failed to update layout statistics setting",
          error: `HTTP error! status: ${response.status}, message: ${errorMessage}`
        };
      }

      return {
        success: true,
        message: "Layout statistics setting updated successfully"
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to update layout statistics setting",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
}); 