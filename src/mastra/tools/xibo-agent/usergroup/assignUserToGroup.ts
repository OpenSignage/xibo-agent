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
 * @module assignUserToGroup
 * @description Provides a tool to assign one or more users to a user group in the Xibo CMS.
 * It implements the POST /group/members/assign/{userGroupId} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { userGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after assigning users.
 */
const assignUserToGroupResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(userGroupSchema),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([assignUserToGroupResponseSchema, errorResponseSchema]);

/**
 * Tool to assign users to a specific user group in the Xibo CMS.
 */
export const assignUserToGroup = createTool({
  id: 'assign-user-to-group',
  description: 'Assigns one or more users to a specific user group.',
  inputSchema: z.object({
    userGroupId: z.number().describe('The ID of the user group to assign users to.'),
    userIds: z.array(z.number()).min(1).describe('An array of user IDs to assign.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { userGroupId, userIds } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/group/members/assign/${userGroupId}`);

      const params = new URLSearchParams();
      userIds.forEach(id => {
        // According to API spec, the parameter key is 'userId'
        params.append('userId[]', String(id));
      });

      logger.debug({ url: url.toString(), userGroupId, userIds }, `Attempting to assign ${userIds.length} user(s) to group ID: ${userGroupId}`);

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
        const message = `Failed to assign users to group. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData, userGroupId }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = z.array(userGroupSchema).safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Assign users to group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ userGroupId, userIds }, `Successfully assigned users to group.`);
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while assigning users to the group.';
      const processedError = processError(error);
      logger.error({ error: processedError, userGroupId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 