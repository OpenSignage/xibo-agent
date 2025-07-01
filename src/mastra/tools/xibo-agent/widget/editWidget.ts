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
 * @module edit-widget
 * @description This module provides a tool to edit a widget.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

export const editWidget = createTool({
  id: 'edit-widget',
  description: 'Edits a widget.',
  inputSchema: z.object({
    widgetId: z.number().describe('The ID of the widget to edit.'),
    useDuration: z.number().optional().describe('Whether to use the specified duration (0: no, 1: yes).'),
    duration: z.number().optional().describe('The duration in seconds.'),
    name: z.string().optional().describe('The name of the widget.'),
    enableStat: z.string().optional().describe('Statistics collection setting (On|Off|Inherit).')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("editWidget: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}`;
      logger.debug(`editWidget: Request URL = ${url}`);

      const formData = new FormData();
      if (context.useDuration !== undefined) formData.append('useDuration', context.useDuration.toString());
      if (context.duration !== undefined) formData.append('duration', context.duration.toString());
      if (context.name) formData.append('name', context.name);
      if (context.enableStat) formData.append('enableStat', context.enableStat);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error(`editWidget: HTTP error occurred: ${response.status}`, {
            status: response.status,
            error: errorData,
        });
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      logger.info(`editWidget: Widget ${context.widgetId} edited successfully.`);
      return { success: true, message: "Widget edited successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("editWidget: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 