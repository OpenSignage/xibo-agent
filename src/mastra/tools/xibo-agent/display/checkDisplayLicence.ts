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
 * @module checkDisplayLicence
 * @description Provides a tool to check the license status of a specific display.
 * It implements the GET /display/licenceCheck/{displayId} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { displayLicenceSchema } from './schemas';

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

const checkDisplayLicenceSuccessSchema = z.object({
  success: z.literal(true),
  data: displayLicenceSchema,
});

const outputSchema = z.union([
  checkDisplayLicenceSuccessSchema,
  errorResponseSchema,
]);

export const checkDisplayLicence = createTool({
  id: 'check-display-licence',
  description: 'Checks the license status of a specific display.',
  inputSchema: z.object({
    displayId: z.number().describe('The ID of the display to check.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(
        `${config.cmsUrl}/api/display/licenceCheck/${context.displayId}`
      );
      const authHeaders = await getAuthHeaders();

      logger.debug(
        { url: url.toString() },
        `Checking licence for display ${context.displayId}`
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: authHeaders,
      });

      if (!response.ok) {
        const message = `Failed to check licence for display ${context.displayId}. Status: ${response.status}`;
        let errorData: any = await response.text();
        try {
          errorData = JSON.parse(errorData);
        } catch (e) {
          // Not a JSON response
        }
        logger.error({ status: response.status, data: errorData }, message);
        return {
          success: false as const,
          message,
          errorData,
        };
      }

      const responseData = await response.json();
      const validationResult = z
        .array(displayLicenceSchema)
        .safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Check display licence response validation failed.';
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

      if (validationResult.data.length === 0) {
        const message = `No licence information found for display ${context.displayId}.`;
        logger.warn({ displayId: context.displayId }, message);
        return {
          success: false as const,
          message,
          errorData: responseData,
        };
      }

      return { success: true as const, data: validationResult.data[0] };
    } catch (error) {
      const processedError = processError(error);
      const message =
        'An unexpected error occurred while checking display licence.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 