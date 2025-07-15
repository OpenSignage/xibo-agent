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
 * It implements the POST /sync/group API endpoint and handles the necessary
 * validation and data transformation for creating a sync group.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { syncGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after creating a sync group.
 * It contains the newly created sync group's data.
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
 * This tool allows specifying the group name, sync settings, master display, and slave displays.
 */
export const addSyncGroup = createTool({
  id: 'add-sync-group',
  description: 'Creates a new Sync Group in the Xibo CMS.',
  inputSchema: z.object({
    syncGroupName: z.string().describe('The name for the new sync group.'),
    isSyncEnabled: z.number().optional().describe('Flag to enable sync (0 or 1). Defaults to 1.'),
    isSyncTimeEnabled: z.number().optional().describe('Flag to enable sync time (0 or 1). Defaults to 1.'),
    isSyncOffsetEnabled: z.number().optional().describe('Flag to enable sync offset (0 or 1). Defaults to 0.'),
    syncOffset: z.number().optional().describe('The sync offset in seconds. Defaults to 0.'),
    syncMaster: z.number().describe('The Display ID of the master display for this sync group.'),
    syncSlaves: z.array(z.number()).describe('An array of Display IDs for the slave displays.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { syncGroupName, syncMaster, syncSlaves, ...optionalParams } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/sync/group`);
      
      const params = new URLSearchParams({
        syncGroupName,
        syncMaster: String(syncMaster),
        syncSlaves: syncSlaves.join(','),
        isSyncEnabled: String(optionalParams.isSyncEnabled ?? 1),
        isSyncTimeEnabled: String(optionalParams.isSyncTimeEnabled ?? 1),
        isSyncOffsetEnabled: String(optionalParams.isSyncOffsetEnabled ?? 0),
        syncOffset: String(optionalParams.syncOffset ?? 0),
      });

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
        const message = 'Sync group response validation failed.';
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