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
 * @module assignSyncGroupMembers
 * @description Provides a tool to assign member displays to a Sync Group in the Xibo CMS.
 * It implements the POST /sync/group/{id}/members API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { errorResponseSchema } from './schemas';

/**
 * Schema for a successful assignment response.
 */
const assignSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([assignSuccessResponseSchema, errorResponseSchema]);

/**
 * Tool for assigning member displays to a Sync Group.
 */
export const assignSyncGroupMembers = createTool({
  id: 'assign-sync-group-members',
  description: 'Assigns member displays (master and slaves) to a Sync Group.',
  inputSchema: z.object({
    syncGroupId: z.number().describe('The ID of the sync group to assign members to.'),
    masterId: z.number().describe('The Display ID of the master display.'),
    slaveIds: z.array(z.number()).describe('An array of Display IDs for the slave displays.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { syncGroupId, masterId, slaveIds } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/sync/group/${syncGroupId}/members`);
      
      const params = new URLSearchParams({
        masterId: String(masterId),
        slaveIds: slaveIds.join(','),
      });

      logger.debug({ url: url.toString(), params: params.toString() }, `Attempting to assign members to sync group ID: ${syncGroupId}`);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });
      
      // A successful POST request returns a 204 No Content response.
      if (response.ok && response.status === 204) {
        const message = `Successfully assigned members to sync group ID ${syncGroupId}.`;
        logger.info({ syncGroupId, masterId, slaveIds }, message);
        return { success: true, message };
      }

      const responseData = await response.json().catch(() => response.text());
      const message = `Failed to assign members to sync group. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: responseData, syncGroupId }, message);
      return { success: false, message, errorData: responseData };

    } catch (error) {
      const message = 'An unexpected error occurred while assigning sync group members.';
      const processedError = processError(error);
      logger.error({ error: processedError, syncGroupId }, message);
      return { success: false, message, error: processedError };
    }
  },
}); 