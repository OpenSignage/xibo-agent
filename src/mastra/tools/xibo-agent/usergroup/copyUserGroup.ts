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
 * @module copyUserGroup
 * @description Provides a tool to copy an existing user group in the Xibo CMS.
 * It implements the POST /group/{userGroupId}/copy API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { userGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after copying a user group.
 */
const copyUserGroupResponseSchema = z.object({
  success: z.literal(true),
  data: userGroupSchema,
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([copyUserGroupResponseSchema, errorResponseSchema]);

/**
 * Tool to copy an existing user group in the Xibo CMS.
 */
export const copyUserGroup = createTool({
  id: 'copy-user-group',
  description: 'Copies an existing User Group.',
  inputSchema: z.object({
    userGroupId: z.number().describe('The ID of the user group to copy.'),
    group: z.string().describe('The name for the new, copied user group.'),
    copyMembers: z.number().optional().describe('Flag to copy members (1 for yes, 0 for no).'),
    copyFeatures: z.number().optional().describe('Flag to copy feature permissions (1 for yes, 0 for no).'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { userGroupId, ...body } = context;

    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/group/${userGroupId}/copy`);
      
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }

      logger.debug({ url: url.toString(), params: params.toString() }, `Attempting to copy user group ID ${userGroupId} to '${context.group}'`);

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
        const message = `Failed to copy user group. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData, userGroupId }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = userGroupSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Copy user group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      logger.info({ newGroup: validationResult.data }, `User group copied successfully.`);
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while copying the user group.';
      const processedError = processError(error);
      logger.error({ error: processedError, userGroupId }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 