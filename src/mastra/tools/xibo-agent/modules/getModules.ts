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
 * @module getModules
 * @description This module provides functionality to retrieve information about all available
 * modules in the Xibo CMS. It accesses the /api/module endpoint to get details
 * about module properties, configuration options, and compatibility.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for module property definition
 * 
 * Represents configurable properties of Xibo modules
 */
const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  default: z.union([z.string(), z.number(), z.null()]),
});

/**
 * Schema for module response data from Xibo API
 * 
 * Comprehensive definition of module information returned by the API,
 * including module metadata, compatibility settings, and configuration options.
 */
const moduleSchema = z.object({
  moduleId: z.union([z.number(), z.string().transform(Number)]),
  name: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.string().nullable(),
  legacyTypes: z.union([z.array(z.string()), z.array(z.object({}))]),
  dataType: z.string().nullable(),
  group: z.union([z.array(z.string()), z.object({})]),
  dataCacheKey: z.string().nullable(),
  fallbackData: z.union([z.number(), z.string().transform(Number)]),
  regionSpecific: z.union([z.number(), z.string().transform(Number)]),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  compatibilityClass: z.string().nullable(),
  showIn: z.string().nullable(),
  assignable: z.union([z.number(), z.string().transform(Number)]),
  hasThumbnail: z.union([z.number(), z.string().transform(Number)]),
  thumbnail: z.string().nullable(),
  startWidth: z.union([z.number(), z.string().transform(Number)]).nullable(),
  startHeight: z.union([z.number(), z.string().transform(Number)]).nullable(),
  renderAs: z.string().nullable(),
  class: z.string().nullable(),
  validatorClass: z.array(z.string()),
  preview: z.any().nullable(),
  stencil: z.any().nullable(),
  properties: z.array(propertySchema),
  assets: z.any().nullable(),
  onInitialize: z.string().nullable(),
  onParseData: z.string().nullable(),
  onDataLoad: z.string().nullable(),
  onRender: z.string().nullable(),
  onVisible: z.string().nullable(),
  sampleData: z.union([z.string(), z.array(z.any()), z.null()]),
  enabled: z.union([z.number(), z.string().transform(Number)]),
  previewEnabled: z.union([z.number(), z.string().transform(Number)]),
  defaultDuration: z.union([z.number(), z.string().transform(Number)]),
  settings: z.array(propertySchema),
  propertyGroups: z.array(z.string()),
  requiredElements: z.array(z.string()),
  isInstalled: z.boolean(),
  isError: z.boolean(),
  errors: z.array(z.string()),
  allowPreview: z.union([z.number(), z.string().transform(Number)]).nullable(),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(moduleSchema),
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
 * Tool for retrieving all module information from Xibo CMS
 */
export const getModules = createTool({
  id: 'get-modules',
  description: 'Get information about all available Xibo CMS modules',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters.')
  }),
  outputSchema,
  execute: async () => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${config.cmsUrl}/api/module`, {
        headers,
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get modules. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = z.array(moduleSchema).safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = "Modules retrieved successfully";
      logger.info(message, { count: validationResult.data.length });
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while getting modules.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default getModules;