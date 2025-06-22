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
 * @module getModuleProperties
 * @description This module provides functionality to retrieve module properties from the Xibo CMS system.
 * It implements the module properties API endpoint and handles the necessary validation
 * and data transformation for retrieving module configuration details.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for module property validation
 * Defines the structure of module property data in the Xibo CMS system
 */
const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  options: z.array(z.any()).optional(),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(propertySchema),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for retrieving module properties from Xibo CMS
 * 
 * This tool accepts a module ID and retrieves its properties
 * including configuration options and settings.
 */
export const getModuleProperties = createTool({
  id: "get-module-properties",
  description: "Get module properties from Xibo CMS",
  inputSchema: z.object({
    moduleId: z.string().describe("ID of the module to retrieve properties for. This can be either a numeric ID or a string identifier."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/module/properties/${context.moduleId}`);
      
      logger.info('Requesting module properties:', {
        url: url.toString(),
        moduleId: context.moduleId
      });

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });
      console.log(response);
      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get module properties. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = z.array(propertySchema).safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }
      
      const message = "Module properties retrieved successfully";
      logger.info(message, { moduleId: context.moduleId, count: validationResult.data.length });
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while getting module properties.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default getModuleProperties; 