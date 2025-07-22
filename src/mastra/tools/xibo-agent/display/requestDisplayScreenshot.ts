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
 * @module requestDisplayScreenshot
 * @description Provides a tool to request a screenshot from a specific display.
 * It implements the PUT /display/requestscreenshot/{displayId} endpoint and returns the updated display object.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { displaySchema } from './schemas';

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
 * Schema for a successful response, which is the updated display object.
 * The API may return an empty array on success, so data can be the object or an empty array.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.union([displaySchema, z.array(z.any()).max(0)]),
  message: z.string().optional(),
});

/**
 * Union schema for the tool's output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool to request a screenshot from a specific display.
 */
export const requestDisplayScreenshot = createTool({
  id: 'request-display-screenshot',
  description: 'Requests a screenshot from a specific display.',
  inputSchema: z.object({
    displayId: z
      .number()
      .describe('The ID of the display to request a screenshot from.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing requestDisplayScreenshot tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(
        `${config.cmsUrl}/api/display/requestscreenshot/${context.displayId}`
      );
      const authHeaders = await getAuthHeaders();

      logger.debug(
        { url: url.toString() },
        `Requesting screenshot from display ${context.displayId}`
      );

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: authHeaders,
      });

      if (!response.ok) {
        const message = `Failed to request screenshot for display ${context.displayId}. Status: ${response.status}`;
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
      // The API returns an array containing the updated display object.
      const validationResult = z.array(displaySchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Request screenshot response validation failed.';
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
        const message = `Successfully requested screenshot for display ${context.displayId}. The API returned no data, which is expected.`;
        logger.info({ displayId: context.displayId }, message);
        return {
          success: true as const,
          data: [],
          message,
        };
      }

      logger.info(
        { displayId: context.displayId },
        `Successfully requested screenshot for display ${context.displayId}.`
      );
      // Return the first element of the array as the updated display object.
      return { success: true as const, data: validationResult.data[0] };
    } catch (error) {
      const processedError = processError(error);
      const message =
        'An unexpected error occurred while requesting a display screenshot.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 