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
 * @module set-widget-region
 * @description This module provides a tool to set a widget's region.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

export const setWidgetRegion = createTool({
  id: 'set-widget-region',
  description: "Sets a widget's region.",
  inputSchema: z.object({
    widgetId: z.number().describe("The ID of the widget to set the region for."),
    targetRegionId: z.number().describe('The ID of the target region.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("setWidgetRegion: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}/region`;
      logger.debug(`setWidgetRegion: Request URL = ${url}`);

      const formData = new FormData();
      formData.append('targetRegionId', context.targetRegionId.toString());

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });
      
      // A 204 No Content response indicates a successful operation.
      if (response.status === 204) {
          logger.info(`setWidgetRegion: Widget ${context.widgetId} region set successfully.`);
          return { success: true, message: "Widget region set successfully." };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error(`setWidgetRegion: HTTP error occurred: ${response.status}`, {
            status: response.status,
            error: errorData,
        });
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      logger.info(`setWidgetRegion: Widget ${context.widgetId} region set successfully with status ${response.status}.`);
      return { success: true, message: "Widget region set successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("setWidgetRegion: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 