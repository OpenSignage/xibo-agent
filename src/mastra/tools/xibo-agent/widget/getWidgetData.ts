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
 * @module get-widget-data
 * @description This module provides a tool to get data for a widget.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

const widgetDataSchema = z.object({
  id: z.number(),
  widgetId: z.number(),
  data: z.record(z.any()),
  displayOrder: z.number(),
  createdDt: z.string(),
  modifiedDt: z.string()
});

const successSchema = z.object({
  success: z.literal(true),
  data: z.array(widgetDataSchema),
});

const errorSchema = z.object({
    success: z.literal(false),
    message: z.string(),
    errorData: z.any().optional(),
});

export const getWidgetData = createTool({
  id: 'get-widget-data',
  description: 'Gets data for a widget.',
  inputSchema: z.object({
    widgetId: z.number().describe('The ID of the widget to get data for.')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    try {
      if (!config.cmsUrl) {
        logger.error("getWidgetData: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/${context.widgetId}`;
      logger.debug(`getWidgetData: Request URL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error({ status: response.status, error: errorData }, `getWidgetData: HTTP error occurred: ${response.status}`);
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      const data = await response.json();
      const validatedData = z.array(widgetDataSchema).parse(data);
      logger.info(`getWidgetData: Successfully retrieved data for widget ${context.widgetId}.`);
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error({ error: error.issues }, "getWidgetData: Validation error");
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error({ error: errorMessage }, "getWidgetData: An unexpected error occurred");
      return { success: false, message: errorMessage };
    }
  },
}); 