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
import { logger } from '../../../index';

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
    error: z.string().optional(),
    data: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("setLayoutEnableStat: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Updating layout statistics setting for layout ${context.layoutId}`, {
        enableStat: context.enableStat
      });

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/setenablestat/${context.layoutId}`;

      // Prepare form data for statistics setting update
      const formData = new URLSearchParams();
      formData.append('enableStat', context.enableStat.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      // Handle 204 No Content response first
      if (response.status === 204) {
        return {
          success: true,
          message: "Layout statistics setting updated successfully",
          data: null
        };
      }

      if (!response.ok) {
        const responseText = await response.text();
        logger.error("setLayoutEnableStat: API error response", {
          status: response.status,
          responseText
        });
        const errorMessage = decodeErrorMessage(responseText);
        return {
          success: false,
          message: "Failed to update layout statistics setting",
          error: `HTTP error! status: ${response.status}, message: ${errorMessage}`,
          data: null
        };
      }

      // For other successful responses, try to parse JSON
      const data = await response.json();
      return {
        success: true,
        message: "Layout statistics setting updated successfully",
        data
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to update layout statistics setting",
        error: error instanceof Error ? error.message : "Unknown error",
        data: null
      };
    }
  },
}); 