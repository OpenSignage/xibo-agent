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
 * @module get-widget-data-types
 * @description This module provides a tool to get the list of widget data types.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

const dataTypeSchema = z.record(z.object({
  name: z.string(),
  description: z.string(),
  class: z.string()
}));

const successSchema = z.object({
  success: z.literal(true),
  data: dataTypeSchema,
});

const errorSchema = z.object({
    success: z.literal(false),
    message: z.string(),
    errorData: z.any().optional(),
});

export const getWidgetDataTypes = createTool({
  id: 'get-widget-data-types',
  description: 'Gets the list of widget data types.',
  inputSchema: z.object({}),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async (): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    try {
      if (!config.cmsUrl) {
        logger.error("getWidgetDataTypes: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/widget/data/types`;
      logger.debug(`getWidgetDataTypes: Request URL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => response.text());
        logger.error(`getWidgetDataTypes: HTTP error occurred: ${response.status}`, {
            status: response.status,
            error: errorData,
        });
        return {
            success: false,
            message: `HTTP error! status: ${response.status}`,
            errorData,
        };
      }

      const data = await response.json();
      const validatedData = dataTypeSchema.parse(data);
      
      logger.info("getWidgetDataTypes: Successfully retrieved data types.");
      return { success: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("getWidgetDataTypes: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("getWidgetDataTypes: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 