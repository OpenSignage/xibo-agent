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
 * Xibo CMS Module Properties Tool
 * 
 * This module provides functionality to retrieve module properties from the Xibo CMS system.
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

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(propertySchema),
});

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
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/module/properties/${context.moduleId}`);
    
    logger.info('Requesting module properties:', {
      url: url.toString(),
      moduleId: context.moduleId
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const decodedError = decodeErrorMessage(errorText);
      logger.error('Failed to get module properties:', {
        status: response.status,
        statusText: response.statusText,
        error: decodedError
      });
      return {
        success: false,
        data: [],
        error: {
          status: response.status,
          message: decodedError
        }
      };
    }

    const rawData = await response.json();

    const validatedData = apiResponseSchema.parse(rawData);
    return validatedData;
  },
});

export default getModuleProperties; 