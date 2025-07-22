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
 * @module getSyncGroupDisplays
 * @description Provides a tool to retrieve displays assigned to a specific Sync Group in the Xibo CMS.
 * It implements the GET /syncgroup/{id}/displays API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { syncGroupDisplaySchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response, containing an array of displays in the sync group.
 */
const getDisplaysResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(syncGroupDisplaySchema),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([getDisplaysResponseSchema, errorResponseSchema]);

/**
 * Tool for retrieving a list of displays assigned to a specific Sync Group.
 */
export const getSyncGroupDisplays = createTool({
  id: 'get-sync-group-displays',
  description: 'Retrieves a list of displays assigned to a specific Sync Group.',
  inputSchema: z.object({
    syncGroupId: z.number().describe('The ID of the sync group to retrieve displays for.'),
    displayId: z.number().optional().describe('Filter by an individual Display ID.'),
    displayGroupId: z.number().optional().describe('Filter by an individual Display Group ID.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { syncGroupId, ...filters } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/syncgroup/${syncGroupId}/displays`);

      if (filters.displayId) {
        url.searchParams.append('displayId', String(filters.displayId));
      }
      if (filters.displayGroupId) {
        url.searchParams.append('displayGroupId', String(filters.displayGroupId));
      }

      logger.debug({ url: url.toString() }, `Attempting to get displays for sync group ID: ${syncGroupId}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get sync group displays. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData, syncGroupId }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const responseValidationSchema = z.object({
        displays: z.array(syncGroupDisplaySchema),
      });

      const validationResult = responseValidationSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Get sync group displays response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData, syncGroupId }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(`Successfully retrieved ${validationResult.data.displays.length} displays for sync group ID ${syncGroupId}.`);
      return { success: true as const, data: validationResult.data.displays };

    } catch (error) {
      const message = 'An unexpected error occurred while getting sync group displays.';
      const processedError = processError(error);
      logger.error({ error: processedError, syncGroupId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});
 