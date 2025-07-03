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
 * @description This module provides functionality to retrieve properties for a specific module
 * by fetching all modules and filtering them by a given identifier.
 *
 * NOTE: This implementation is a temporary workaround for a bug in the `/api/module/properties`
 * endpoint. Once the bug is fixed, this tool should be reverted to use the original
 * implementation from the `.BAK` file, which directly fetches properties for a given module ID.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

/**
 * Schema for module property definition.
 * This is also the final output structure for the tool.
 */
const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

/**
 * Schema for the full module structure, based on the /api/module endpoint.
 * Used for internal validation of the API response.
 */
const moduleSchema = z.object({
  moduleId: z.union([z.number(), z.string().transform(v => parseInt(v, 10))]),
  name: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.string().nullable(),
  legacyTypes: z.array(z.union([z.string(), z.object({})])),
  dataType: z.string().nullable(),
  group: z.union([z.array(z.string()), z.object({})]),
  dataCacheKey: z.string().nullable(),
  fallbackData: z.number(),
  regionSpecific: z.number(),
  schemaVersion: z.number(),
  compatibilityClass: z.string().nullable(),
  showIn: z.string().nullable(),
  assignable: z.number(),
  hasThumbnail: z.number(),
  thumbnail: z.string().nullable(),
  renderAs: z.string().nullable(),
  class: z.string().nullable(),
  validatorClass: z.array(z.string()),
  properties: z.array(propertySchema),
  onInitialize: z.string().nullable(),
  onParseData: z.string().nullable(),
  onDataLoad: z.string().nullable(),
  onRender: z.string().nullable(),
  onVisible: z.string().nullable(),
  sampleData: z.union([z.string(), z.array(z.any()), z.null()]),
  enabled: z.number(),
  previewEnabled: z.number(),
  defaultDuration: z.number(),
  settings: z.array(propertySchema),
  propertyGroups: z.array(z.string()),
  requiredElements: z.array(z.string()),
  isInstalled: z.boolean(),
  isError: z.boolean(),
  errors: z.array(z.string()),
});

/**
 * Tool for retrieving properties of a specific module.
 * This tool fetches all modules and filters them to find the properties
 * for the module matching the given identifier (name or type).
 */
export const getModuleProperties = createTool({
  id: "get-module-properties",
  description: "Get properties for a specific module by its type or name.",
  inputSchema: z.object({
    moduleIdentifier: z.string().describe("The type or name of the module to retrieve properties for (e.g., 'rss', 'text', 'Image')."),
  }),
  outputSchema: z.union([
    z.object({
      success: z.literal(true),
      data: z.array(propertySchema),
      message: z.string(),
    }),
    z.object({
      success: z.literal(false),
      message: z.string(),
      error: z.any().optional(),
    }),
  ]),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const url = `${config.cmsUrl}/api/module`;
      const response = await fetch(url, {
        method: "GET",
        headers: await getAuthHeaders(),
      });
      
      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get modules. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, error: rawData };
      }
      
      const allModulesSchema = z.array(moduleSchema.passthrough());
      const validationResult = allModulesSchema.safeParse(rawData);

      if (!validationResult.success) {
        const message = "API response validation failed for the module list.";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error };
      }
      
      const foundModule = validationResult.data.find(
        m => m.type === context.moduleIdentifier || m.name === context.moduleIdentifier
      );

      if (!foundModule) {
        const message = `Module with identifier '${context.moduleIdentifier}' not found.`;
        logger.warn(message);
        return { success: false as const, message };
      }
      
      const message = `Successfully retrieved properties for module '${context.moduleIdentifier}'.`;
      return { success: true as const, data: foundModule.properties, message };
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