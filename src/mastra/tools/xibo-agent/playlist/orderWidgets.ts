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
 * @module order-widgets
 * @description This module provides a tool to set the order of widgets within a playlist.
 * It implements the POST /api/playlist/order/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the widget position data in the input
const widgetOrderSchema = z.object({
  widgetId: z.number().describe("The ID of the widget."),
  position: z.number().describe("The new display order position for the widget.")
});

// Schema for the successful response after reordering
const reorderResponseSchema = z.object({
    // The API returns the updated playlist object, so we define its basic structure.
    playlistId: z.number(),
    name: z.string(),
    duration: z.number(),
    widgets: z.array(z.object({
        widgetId: z.number(),
        displayOrder: z.number()
    })),
});

/**
 * Tool to set the display order of widgets within a specific playlist.
 */
export const orderWidgets = createTool({
  id: 'order-widgets',
  description: 'Sets the order of widgets in a playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to reorder.'),
    widgets: z.array(widgetOrderSchema).describe('An array of widget IDs and their new positions.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: reorderResponseSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("orderWidgets: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/order/${context.playlistId}`;
      logger.debug(`orderWidgets: Request URL = ${url}`);

      const formData = new URLSearchParams();
      context.widgets.forEach(widget => {
        // The API expects the position for each widgetId in the format: widgets[widgetId]=position
        formData.append(`widgets[${widget.widgetId}]`, widget.position.toString());
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("orderWidgets: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      const data = await response.json();
      const validatedData = reorderResponseSchema.parse(data);
      
      return { success: true, data: validatedData };

    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("orderWidgets: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("orderWidgets: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 