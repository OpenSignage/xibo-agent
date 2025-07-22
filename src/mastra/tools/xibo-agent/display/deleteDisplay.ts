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
 * @module deleteDisplay
 * @description Provides a tool to delete a specific display from the Xibo CMS.
 * It implements the DELETE /display/{displayId} endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';

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
 * Schema for a successful response.
 * This endpoint returns a 204 No Content, so we provide a success message.
 */
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * Union schema for the tool's output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool to delete a specific display.
 */
export const deleteDisplay = createTool({
  id: 'delete-display',
  description: 'Deletes a specific display.',
  inputSchema: z.object({
    displayId: z.number().describe('The ID of the display to delete.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    logger.debug({ context }, 'Executing deleteDisplay tool.');

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/display/${context.displayId}`);
      const authHeaders = await getAuthHeaders();

      logger.debug(
        { url: url.toString() },
        `Attempting to delete display ${context.displayId}`
      );

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: authHeaders,
      });

      // A successful deletion returns a 204 No Content status.
      if (!response.ok) {
        const message = `Failed to delete display ${context.displayId}. Status: ${response.status}`;
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

      const message = `Successfully deleted display ${context.displayId}.`;
      logger.info({ displayId: context.displayId }, message);
      return { success: true as const, message };
    } catch (error) {
      const processedError = processError(error);
      const message =
        'An unexpected error occurred while deleting a display.';
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 