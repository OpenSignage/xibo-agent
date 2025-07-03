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
 * @module getModuleTemplates
 * @description This module provides functionality to retrieve module templates
 * from the Xibo CMS, filtered by data type.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

/**
 * Schema for the 'stencil' object within a module template.
 */
const stencilSchema = z.object({
  elementGroups: z.array(z.string()).optional(),
}).nullable();

/**
 * Schema for the 'extends' object, defining template inheritance.
 */
const extendsSchema = z.object({
  templateId: z.string().optional(),
  type: z.string().optional(),
}).nullable();

/**
 * Schema for individual properties within a module template.
 */
const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  default: z.union([z.string(), z.number(), z.boolean()]).nullable(),
});

/**
 * Schema for the main module template structure.
 */
const moduleTemplateSchema = z.object({
  templateId: z.string(),
  type: z.string(),
  extends: extendsSchema,
  dataType: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  thumbnail: z.string().nullable(),
  showIn: z.string().nullable(),
  properties: z.array(propertySchema),
  isVisible: z.boolean(),
  isEnabled: z.boolean(),
  propertyGroups: z.array(z.string()),
  stencil: stencilSchema,
  assets: z.array(z.any()),
  groupsWithPermissions: z.string().nullable(),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(moduleTemplateSchema),
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
 * Tool to retrieve a list of module templates from the Xibo CMS.
 * Filters templates based on the specified data type.
 */
export const getModuleTemplates = createTool({
  id: "get-module-templates",
  description: "Get module templates by data type",
  inputSchema: z.object({
    dataType: z.string().describe("DataType to return templates for"),
    type: z.string().optional().describe("Type to return templates for"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/module/templates/${context.dataType}`);
      if (context.type) {
        url.searchParams.append("type", context.type);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get module templates. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = z.array(moduleTemplateSchema).safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = "Module templates retrieved successfully";
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while getting module templates.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 