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
 * @description Provides a tool to retrieve the properties of a specific module template.
 * It implements the GET /module/template/{dataType}/properties/{id} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { propertySchema } from './schemas';

/**
 * Schema for the successful response, containing an object of module template properties.
 * The keys are the property IDs.
 */
const getModuleTemplatePropertiesResponseSchema = z.object({
  success: z.literal(true),
  data: z.record(z.string(), propertySchema),
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
const outputSchema = z.union([getModuleTemplatePropertiesResponseSchema, errorResponseSchema]);

/**
 * Tool to retrieve properties for a specific module template.
 */
export const getModuleTemplateProperties = createTool({
  id: 'get-module-template-properties',
  description: 'Gets the properties for a specific module template.',
  inputSchema: z.object({
    dataType: z.string().describe("The data type of the template (e.g., 'dataset')."),
    id: z.string().describe("The ID of the template."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { dataType, id } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/module/template/${dataType}/properties/${id}`);
      logger.debug({ url: url.toString() }, `Attempting to get template properties for dataType '${dataType}', id '${id}'`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get module template properties. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData, dataType, id }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = z.record(z.string(), propertySchema).safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Get module template properties response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData, dataType, id }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info(`Successfully retrieved properties for template '${id}'.`);
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while getting module template properties.';
      const processedError = processError(error);
      logger.error({ error: processedError, dataType, id }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 