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
 * It implements the POST /syncgroup/{id}/edit API endpoint.
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
    name: z.string().optional().describe('The new name for the sync group.'),
    syncPublisherPort: z.number().optional().describe('The publisher port number.'),
    syncSwitchDelay: z.number().optional().describe('The delay (in ms) when displaying the changes in content.'),
    syncVideoPauseDelay: z.number().optional().describe('The delay (in ms) before unpausing the video on start.'),
    leadDisplayId: z.number().describe('The ID of the Display that belongs to this Sync Group and should act as a Lead Display.'),
    folderId: z.number().optional().describe('The ID of the folder to assign this sync group to.'),
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
      const url = new URL(`${config.cmsUrl}/api/syncgroup/${syncGroupId}/edit`);
      
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }

      logger.debug({ url: url.toString(), params: params.toString() }, `Attempting to edit sync group ID: ${syncGroupId}`);

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