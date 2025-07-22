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
 * @module addSyncGroup
 * @description Provides a tool to create a new Sync Group in the Xibo CMS.
 * It implements the POST /syncgroup/add API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { syncGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after creating a sync group.
 */
const addSyncGroupResponseSchema = z.object({
  success: z.literal(true),
  data: syncGroupSchema,
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([addSyncGroupResponseSchema, errorResponseSchema]);

/**
 * Tool for creating a new Sync Group in the Xibo CMS.
 */
export const addSyncGroup = createTool({
  id: 'add-sync-group',
  description: 'Creates a new Sync Group in the Xibo CMS.',
  inputSchema: z.object({
    name: z.string().describe('The name for the new sync group.'),
    syncPublisherPort: z.number().optional().describe('The publisher port number on which sync group members will communicate - default 9590.'),
    folderId: z.number().optional().describe('The ID of the folder to assign this sync group to.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { name, ...rest } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/syncgroup/add`);
      
      const params = new URLSearchParams({ name });
      if (rest.syncPublisherPort !== undefined) {
        params.append('syncPublisherPort', String(rest.syncPublisherPort));
      }
      if (rest.folderId !== undefined) {
        params.append('folderId', String(rest.folderId));
      }

      logger.debug({ url: url.toString(), params: params.toString() }, 'Attempting to add a new sync group');

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to add sync group. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = syncGroupSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Add sync group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info({ syncGroupId: validationResult.data.syncGroupId }, 'Sync group added successfully.');
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred during sync group creation.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});