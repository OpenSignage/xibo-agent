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
 * @module edit-widget-transition
 * @description This module provides a tool to edit a widget's transition.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

export const editWidgetTransition = createTool({
  id: 'edit-widget-transition',
  description: "Edits a widget's transition.",
  inputSchema: z.object({
    type: z.enum(['in', 'out']).describe('The transition type (in or out).'),
    widgetId: z.number().describe('The ID of the widget to add the transition to.'),
    transitionType: z.string().describe('The type of transition (e.g., fly, fadeIn, fadeOut).'),
    transitionDuration: z.number().optional().describe('The duration of the transition in milliseconds.'),
    transitionDirection: z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']).optional().describe('The direction of the transition.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("editWidgetTransition: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/transition/${context.type}/${context.widgetId}`;
      logger.debug(`editWidgetTransition: Request URL = ${url}`);

      const formData = new FormData();
      formData.append('transitionType', context.transitionType);
      if (context.transitionDuration !== undefined) formData.append('transitionDuration', context.transitionDuration.toString());
      if (context.transitionDirection) formData.append('transitionDirection', context.transitionDirection);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error({ status: response.status, error: errorData }, `editWidgetTransition: HTTP error occurred: ${response.status}`);
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      logger.info(`editWidgetTransition: Widget ${context.widgetId} transition edited successfully.`);
      return { success: true, message: "Widget transition edited successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error({ error: errorMessage }, "editWidgetTransition: An unexpected error occurred");
      return { success: false, message: errorMessage };
    }
  },
}); 