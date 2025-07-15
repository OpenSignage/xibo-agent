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
 * @module getUserGroups
 * @description Provides a tool to search for user groups in the Xibo CMS.
 * It implements the GET /group API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../index';
import { processError } from '../utility/error';
import { userGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response, containing an array of user groups.
 */
const getUserGroupsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(userGroupSchema),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([getUserGroupsResponseSchema, errorResponseSchema]);

/**
 * Tool to retrieve a list of user groups from the Xibo CMS.
 */
export const getUserGroups = createTool({
  id: 'get-user-groups',
  description: 'Retrieves a list of User Groups from the Xibo CMS.',
  inputSchema: z.object({
    userGroupId: z.number().optional().describe('Filter by a specific User Group ID.'),
    userGroup: z.string().optional().describe('Filter by a user group name (partial match supported).'),
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
      const url = new URL(`${config.cmsUrl}/api/group`);

      if (context.userGroupId) {
        url.searchParams.append('userGroupId', context.userGroupId.toString());
      }
      if (context.userGroup) {
        url.searchParams.append('userGroup', context.userGroup);
      }

      logger.debug({ url: url.toString() }, 'Attempting to get user groups');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get user groups. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }

      const validationResult = z.array(userGroupSchema).safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Get user groups response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      logger.info(`Successfully retrieved ${validationResult.data.length} user group(s).`);
      return { success: true as const, data: validationResult.data };
    } catch (error) {
      const message = 'An unexpected error occurred while getting user groups.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 