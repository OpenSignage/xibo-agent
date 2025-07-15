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
 * @module getSyncGroups
 * @description Provides a tool to retrieve a list of Sync Groups from the Xibo CMS.
 * It implements the GET /sync/group API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { syncGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response of retrieving sync groups, which is an array of sync group objects.
 */
const getSyncGroupsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(syncGroupSchema),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([getSyncGroupsResponseSchema, errorResponseSchema]);

/**
 * Tool for retrieving a list of all Sync Groups from the Xibo CMS.
 */
export const getSyncGroups = createTool({
  id: 'get-sync-groups',
  description: 'Retrieves a list of all Sync Groups from the Xibo CMS.',
  inputSchema: z.object({
    syncGroupName: z.string().optional().describe('Filter by sync group name.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/sync/group`);
      
      if (context.syncGroupName) {
        url.searchParams.append('syncGroupName', context.syncGroupName);
      }

      logger.debug({ url: url.toString() }, 'Attempting to get sync groups');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get sync groups. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = z.array(syncGroupSchema).safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Get sync groups response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(`Successfully retrieved ${validationResult.data.length} sync groups.`);
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while getting sync groups.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 