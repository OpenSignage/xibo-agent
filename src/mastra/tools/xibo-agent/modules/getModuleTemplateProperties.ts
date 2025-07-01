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
 * @module getModuleTemplateProperties
 * @description This module provides functionality to retrieve the properties
 * of a specific module template from the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  options: z.array(z.any()).nullable(),
});

const dataSchema = z.union([
  z.array(propertySchema),
  z.record(z.string(), propertySchema)
]);

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

export const getModuleTemplateProperties = createTool({
  id: "get-module-template-properties",
  description: "Get properties for a specific module template",
  inputSchema: z.object({
    dataType: z.string().describe("The data type of the module (e.g., 'rss')."),
    templateId: z.string().describe("The ID of the template."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/module/template/${context.dataType}/properties/${context.templateId}`);

      logger.info(`Requesting module template properties from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get module template properties. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = dataSchema.safeParse(rawData);

      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = "Module template properties retrieved successfully";
      logger.info(message, { dataType: context.dataType, templateId: context.templateId });
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while getting module template properties.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default getModuleTemplateProperties; 