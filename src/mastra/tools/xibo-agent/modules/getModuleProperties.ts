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
 * @description Provides a tool to retrieve properties for a specific module by its string ID.
 * It directly calls the GET /module/properties/{id} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { propertySchema } from './schemas';

/**
 * Schema for the successful response, containing an array of module properties.
 */
const getModulePropertiesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(propertySchema),
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z
    .any()
    .optional()
    .describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([
  getModulePropertiesResponseSchema,
  errorResponseSchema,
]);

/**
 * Tool to retrieve properties for a specific module by its string ID.
 */
export const getModuleProperties = createTool({
  id: 'get-module-properties',
  description:
    "Gets the properties for a specific module by its string ID.",
  inputSchema: z.object({
    moduleId: z.string().describe("The string ID of the module (e.g., 'core-audio')."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { moduleId } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/module/properties/${moduleId}`);
      logger.debug(
        { url: url.toString() },
        `Fetching properties for module ID ${moduleId}`
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get module properties. API responded with status ${response.status}.`;
        logger.error(
          { status: response.status, response: responseData },
          message
        );
        return { success: false as const, message, errorData: responseData };
      }

      // The API returns an object of properties, not an array.
      // We need to validate it as a record and then transform it into an array.
      const apiResponseSchema = z.record(propertySchema.omit({ id: true }));
      const validationResult = apiResponseSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Module properties response validation failed.';
        logger.error(
          { error: validationResult.error.flatten(), data: responseData },
          message
        );
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      // Transform the object into an array of properties, adding the 'id' from the object key.
      const propertiesArray = Object.entries(validationResult.data).map(
        ([id, value]) => ({
          id,
          ...value,
        })
      );

      logger.info(
        `Successfully retrieved properties for module ID ${moduleId}.`
      );
      return { success: true as const, data: propertiesArray };
    } catch (error) {
      const message = `An unexpected error occurred while getting properties for module ID: ${moduleId}.`;
      const processedError = processError(error);
      logger.error({ error: processedError, moduleId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 