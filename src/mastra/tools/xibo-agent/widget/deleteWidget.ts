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
 * @module delete-widget
 * @description This module provides a tool to delete a widget.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

export const deleteWidget = createTool({
  id: 'delete-widget',
  description: 'Deletes a widget.',
  inputSchema: z.object({
    widgetId: z.number().describe('The ID of the widget to delete.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("deleteWidget: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/${context.widgetId}`;
      logger.debug(`deleteWidget: Request URL = ${url}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });
      
      // A 204 No Content response indicates a successful deletion.
      if (response.status === 204) {
          logger.info(`deleteWidget: Widget ${context.widgetId} deleted successfully.`);
          return { success: true, message: "Widget deleted successfully." };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error(`deleteWidget: HTTP error occurred: ${response.status}`, {
            status: response.status,
            error: errorData,
        });
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      logger.info(`deleteWidget: Widget ${context.widgetId} deleted successfully with status ${response.status}.`);
      return { success: true, message: "Widget deleted successfully." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("deleteWidget: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 