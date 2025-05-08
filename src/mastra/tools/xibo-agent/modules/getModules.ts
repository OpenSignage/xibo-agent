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
 * Xibo CMS Module Information Tool
 * 
 * This module provides functionality to retrieve information about all available
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
const moduleResponseSchema = z.array(z.object({
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
}));

/**
 * Tool for retrieving all module information from Xibo CMS
 */
export const getModules = createTool({
  id: 'get-modules',
  description: 'Get information about all available Xibo CMS modules',
  inputSchema: z.object({
    _placeholder: z.string().optional().describe('This tool does not require input parameters')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const response = await fetch(`${config.cmsUrl}/api/module`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const validatedData = moduleResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      logger.error(`getModules: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});