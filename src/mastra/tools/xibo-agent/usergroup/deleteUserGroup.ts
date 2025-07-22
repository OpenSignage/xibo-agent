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
 * @module deleteUserGroup
 * @description Provides a tool to delete a user group from the Xibo CMS.
 * It implements the DELETE /group/{userGroupId} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after deleting a user group.
 */
const deleteUserGroupResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([deleteUserGroupResponseSchema, errorResponseSchema]);

/**
 * Tool to delete a user group from the Xibo CMS.
 */
export const deleteUserGroup = createTool({
  id: 'delete-user-group',
  description: 'Deletes a User Group from the Xibo CMS.',
  inputSchema: z.object({
    userGroupId: z.number().describe('The ID of the user group to delete.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { userGroupId } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/group/${userGroupId}`);

      logger.debug({ url: url.toString() }, `Attempting to delete user group ID: ${userGroupId}`);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        const message = `User group ID ${userGroupId} deleted successfully.`;
        logger.info({ userGroupId }, message);
        return { success: true as const, message };
      }

      const responseData = await response.json().catch(() => null);
      const message = `Failed to delete user group. API responded with status ${response.status}.`;
      logger.error({ status: response.status, response: responseData, userGroupId }, message);
      return { success: false as const, message, errorData: responseData };

    } catch (error) {
      const message = 'An unexpected error occurred while deleting the user group.';
      const processedError = processError(error);
      logger.error({ error: processedError, userGroupId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 