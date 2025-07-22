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
 * @description Provides a tool to retrieve module templates from the Xibo CMS,
 * filtered by data type. It implements the GET /module/templates/{dataType} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { moduleTemplateSchema } from './schemas';

/**
 * Schema for the successful response, containing an array of module templates.
 */
const getModuleTemplatesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(moduleTemplateSchema),
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([getModuleTemplatesResponseSchema, errorResponseSchema]);

/**
 * Tool to retrieve a list of module templates from the Xibo CMS,
 * filtered by the specified data type.
 */
export const getModuleTemplates = createTool({
  id: 'get-module-templates',
  description: 'Gets module templates by data type.',
  inputSchema: z.object({
    dataType: z.string().describe("DataType to return templates for (e.g., 'article', 'dataset')."),
    type: z.string().optional().describe("Further filter by template type."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { dataType, type } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/module/templates/${dataType}`);
      if (type) {
        url.searchParams.append("type", type);
      }

      logger.debug({ url: url.toString() }, `Attempting to get templates for dataType: ${dataType}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get module templates. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData, dataType }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = z.array(moduleTemplateSchema).safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Get module templates response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData, dataType }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info(`Successfully retrieved ${validationResult.data.length} templates for dataType '${dataType}'.`);
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while getting module templates.';
      const processedError = processError(error);
      logger.error({ error: processedError, dataType }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 