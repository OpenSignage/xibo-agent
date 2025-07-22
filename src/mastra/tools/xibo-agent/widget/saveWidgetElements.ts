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
 * @module save-widget-elements
 * @description This module provides a tool to save elements for a widget.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

export const saveWidgetElements = createTool({
  id: 'save-widget-elements',
  description: "Saves elements for a widget.",
  inputSchema: z.object({
    widgetId: z.number().describe("The ID of the widget to save elements for."),
    elements: z.string().describe('A JSON string of elements to assign to the widget.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("saveWidgetElements: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}/elements`;
      logger.debug(`saveWidgetElements: Request URL = ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        },
        body: context.elements
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error(`saveWidgetElements: HTTP error occurred: ${response.status}`, {
            status: response.status,
            error: errorData,
        });
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      logger.info(`saveWidgetElements: Elements for widget ${context.widgetId} saved successfully.`);
      return { success: true, message: "Widget elements saved successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("saveWidgetElements: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 