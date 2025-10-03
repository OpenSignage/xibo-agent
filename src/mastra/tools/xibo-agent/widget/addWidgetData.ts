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
 * @module add-widget-data
 * @description This module provides a tool to add data to a widget.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

export const addWidgetData = createTool({
  id: 'add-widget-data',
  description: 'Adds data to a widget.',
  inputSchema: z.object({
    widgetId: z.number().describe('The ID of the widget to add data to.'),
    data: z.string().describe('JSON formatted data matching the widget\'s data type.'),
    displayOrder: z.number().optional().describe('The display order.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    location: z.string().optional(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("addWidgetData: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/${context.widgetId}`;
      logger.debug(`addWidgetData: Request URL = ${url}`);

      const formData = new FormData();
      // The API expects the 'data' as a JSON string with a specific key, often 'data[columnName]'
      // Since the exact format is complex and context-dependent, we'll pass it as 'data' for now.
      // This might need adjustment based on the specific widget data type.
      try {
        const jsonData = JSON.parse(context.data);
        for (const key in jsonData) {
            formData.append(`data[${key}]`, jsonData[key]);
        }
      } catch(e) {
          logger.error({ error: e }, "addWidgetData: Invalid JSON provided for data field.");
          return { success: false, message: "Invalid JSON provided for data field."};
      }
      
      if (context.displayOrder !== undefined) formData.append('displayOrder', context.displayOrder.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error({ status: response.status, error: errorData }, `addWidgetData: HTTP error occurred: ${response.status}`);
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      const location = response.headers.get('Location');
      logger.info(`addWidgetData: Widget data added successfully. Location: ${location}`);
      if (location) {
        return { success: true, location, message: `Widget data added successfully. Location: ${location}` };
      } else {
        return { success: true, message: `Widget data added successfully, but location header was missing.` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error({ error: errorMessage }, "addWidgetData: An unexpected error occurred");
      return { success: false, message: errorMessage };
    }
  },
}); 