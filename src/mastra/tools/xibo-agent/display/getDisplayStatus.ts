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
 * @module getDisplayStatus
 * @description Provides a tool to get the current status of a specific display.
 * It implements the GET /display/{displayId}/status endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { displayStatusSchema } from './schemas';

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

const getDisplayStatusSuccessSchema = z.object({
  success: z.literal(true),
  data: displayStatusSchema,
});

const outputSchema = z.union([
  getDisplayStatusSuccessSchema,
  errorResponseSchema,
]);

export const getDisplayStatus = createTool({
  id: 'get-display-status',
  description: 'Gets the current status of a specific display.',
  inputSchema: z.object({
    displayId: z.number().describe('The ID of the display to get the status for.'),
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
        `${config.cmsUrl}/api/display/status/${context.displayId}`
      );
      const authHeaders = await getAuthHeaders();

      logger.debug(
        { url: url.toString() },
        `Getting status for display ${context.displayId}`
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        const message = `Failed to get status for display ${context.displayId}. Status: ${response.status}`;
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
      const validationResult = displayStatusSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Get display status response validation failed.';
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
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const processedError = processError(error);
      const message =
        'An unexpected error occurred while getting display status.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 