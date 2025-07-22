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
 * @module deleteDayPart
 * @description Provides a tool to delete a DayPart record from the Xibo CMS.
 * It implements the DELETE /daypart/{id} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';

/**
 * Schema for the successful response, which is a simple confirmation message.
 * The API returns a 204 No Content on success, so we don't expect a data body.
 */
const deleteDayPartSuccessSchema = z.object({
  success: z.literal(true),
  message: z.string(),
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
const outputSchema = z.union([
  deleteDayPartSuccessSchema,
  errorResponseSchema,
]);

/**
 * Tool to delete a DayPart record from the Xibo CMS.
 */
export const deleteDayPart = createTool({
  id: 'delete-daypart',
  description: 'Deletes a DayPart record from the Xibo CMS by its ID.',
  inputSchema: z.object({
    dayPartId: z.number().describe('The ID of the DayPart record to delete.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { dayPartId } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/daypart/${dayPartId}`);
      logger.debug(
        { url: url.toString() },
        `Attempting to delete DayPart ${dayPartId}`
      );

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `DayPart ${dayPartId} deleted successfully.`;
        logger.info({ dayPartId }, message);
        return { success: true as const, message };
      }

      const responseData = await response.json().catch(() => null);

      const message = `Failed to delete DayPart. API responded with status ${response.status}.`;
      logger.error(
        { status: response.status, response: responseData },
        message
      );
      return { success: false as const, message, errorData: responseData };
    } catch (error) {
      const message = `An unexpected error occurred while deleting DayPart ${dayPartId}.`;
      const processedError = processError(error);
      logger.error({ error: processedError, dayPartId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});