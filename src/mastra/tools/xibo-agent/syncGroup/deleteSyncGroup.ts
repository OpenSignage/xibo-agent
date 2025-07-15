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
 * @module deleteSyncGroup
 * @description Provides a tool to delete a Sync Group from the Xibo CMS.
 * It implements the DELETE /syncgroup/{id}/delete API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { errorResponseSchema } from './schemas';

/**
 * Schema for a successful deletion response.
 */
const deleteSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([deleteSuccessResponseSchema, errorResponseSchema]);

/**
 * Tool for deleting a Sync Group from the Xibo CMS.
 */
export const deleteSyncGroup = createTool({
  id: 'delete-sync-group',
  description: 'Deletes a Sync Group from the Xibo CMS by its ID.',
  inputSchema: z.object({
    syncGroupId: z.number().describe('The ID of the sync group to delete.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { syncGroupId } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/syncgroup/${syncGroupId}/delete`);

      logger.debug({ url: url.toString() }, `Attempting to delete sync group ID: ${syncGroupId}`);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers,
      });

      // A successful DELETE request returns a 204 No Content response.
      if (response.ok && response.status === 204) {
        const message = `Sync group with ID ${syncGroupId} deleted successfully.`;
        logger.info({ syncGroupId }, message);
        return { success: true as const, message };
      }

      const responseData = await response.json().catch(() => response.text());
      const message = `Failed to delete sync group. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: responseData, syncGroupId }, message);
      return { success: false as const, message, errorData: responseData };

    } catch (error) {
      const message = 'An unexpected error occurred during sync group deletion.';
      const processedError = processError(error);
      logger.error({ error: processedError, syncGroupId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 