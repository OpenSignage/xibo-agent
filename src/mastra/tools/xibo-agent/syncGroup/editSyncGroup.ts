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
 * @module editSyncGroup
 * @description Provides a tool to edit an existing Sync Group in the Xibo CMS.
 * It implements the PUT /sync/group/{id} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { syncGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after editing a sync group.
 */
const editSyncGroupResponseSchema = z.object({
  success: z.literal(true),
  data: syncGroupSchema,
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([editSyncGroupResponseSchema, errorResponseSchema]);

/**
 * Tool for editing an existing Sync Group in the Xibo CMS.
 */
export const editSyncGroup = createTool({
  id: 'edit-sync-group',
  description: 'Edits an existing Sync Group in the Xibo CMS.',
  inputSchema: z.object({
    syncGroupId: z.number().describe('The ID of the sync group to edit.'),
    syncGroupName: z.string().describe('The new name for the sync group.'),
    isSyncEnabled: z.number().optional().describe('Flag to enable sync (0 or 1).'),
    isSyncTimeEnabled: z.number().optional().describe('Flag to enable sync time (0 or 1).'),
    isSyncOffsetEnabled: z.number().optional().describe('Flag to enable sync offset (0 or 1).'),
    syncOffset: z.number().optional().describe('The sync offset in seconds.'),
    syncMaster: z.number().describe('The Display ID of the master display.'),
    syncSlaves: z.array(z.number()).describe('An array of Display IDs for the slave displays.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { syncGroupId, ...body } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/sync/group/${syncGroupId}`);
      
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          params.append(key, Array.isArray(value) ? value.join(',') : String(value));
        }
      }

      logger.debug({ url: url.toString(), params: params.toString() }, `Attempting to edit sync group ID: ${syncGroupId}`);

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to edit sync group. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = syncGroupSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Edit sync group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info({ syncGroupId }, 'Sync group edited successfully.');
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred during sync group edit.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});