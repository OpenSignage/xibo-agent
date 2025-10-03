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
 * @module add-widget
 * @description This module provides a tool to add a widget to a playlist.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

export const addWidget = createTool({
  id: 'add-widget',
  description: 'Adds a widget to a playlist.',
  inputSchema: z.object({
    type: z.string().describe('The type of the widget (e.g., "text").'),
    playlistId: z.number().describe('The ID of the playlist.'),
    displayOrder: z.number().optional().describe('The display order.'),
    templateId: z.string().optional().describe('The template ID, if the module type has a dataType.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    widgetId: z.number().optional(),
    location: z.string().optional(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("addWidget: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.type}/${context.playlistId}`;
      logger.debug(`addWidget: Request URL = ${url}`);

      const formData = new FormData();
      if (context.displayOrder !== undefined) formData.append('displayOrder', context.displayOrder.toString());
      if (context.templateId) formData.append('templateId', context.templateId);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error({ status: response.status, error: errorData }, `addWidget: HTTP error occurred: ${response.status}`);
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      const location = response.headers.get('Location');
      if (!location) {
        logger.warn("addWidget: Successfully created widget but location header was missing.");
        return {
            success: true,
            message: "Widget added successfully, but location (ID) could not be determined."
        };
      }
      
      const widgetId = parseInt(location.split('/').pop() || '0', 10);

      logger.info(`addWidget: Widget added successfully. Location: ${location}`);
      return { success: true, location, widgetId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        logger.error({ error: errorMessage }, "addWidget: An unexpected error occurred");
        return { success: false, message: errorMessage };
    }
  },
}); 