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
 * @module addUserGroup
 * @description Provides a tool to add a new user group to the Xibo CMS.
 * It implements the POST /group API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { userGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after adding a user group.
 * The API returns an array, but we expect a single new group.
 */
const addUserGroupResponseSchema = z.object({
  success: z.literal(true),
  data: userGroupSchema,
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([addUserGroupResponseSchema, errorResponseSchema]);

/**
 * Tool to create a new user group in the Xibo CMS.
 */
export const addUserGroup = createTool({
  id: 'add-user-group',
  description: 'Adds a new User Group to the Xibo CMS.',
  inputSchema: z.object({
    group: z.string().describe('Name for the User Group.'),
    description: z.string().optional().describe('A description for the User Group.'),
    libraryQuota: z.string().optional().describe('The quota in KiB. 0 for no quota.'),
    isSystemNotification: z.number().optional().describe('Flag (0, 1) to receive system notifications.'),
    isDisplayNotification: z.number().optional().describe('Flag (0, 1) to receive display notifications.'),
    isDataSetNotification: z.number().optional().describe('Flag (0, 1) to receive DataSet notification emails.'),
    isLayoutNotification: z.number().optional().describe('Flag (0, 1) to receive Layout notification emails.'),
    isLibraryNotification: z.number().optional().describe('Flag (0, 1) to receive Library notification emails.'),
    isReportNotification: z.number().optional().describe('Flag (0, 1) to receive Report notification emails.'),
    isScheduleNotification: z.number().optional().describe('Flag (0, 1) to receive Schedule notification emails.'),
    isCustomNotification: z.number().optional().describe('Flag (0, 1) to receive Custom notification emails.'),
    isShownForAddUser: z.number().optional().describe('Flag (0, 1) to show this Group in the Add User form.'),
    defaultHomePageId: z.number().optional().describe('Default home page ID for new users in this group.'),
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
      
      const params = new URLSearchParams();
      // Note: API spec has a typo 'decription', but we use 'description'
      if (context.description) params.append('decription', context.description);
      
      for (const [key, value] of Object.entries(context)) {
        if (value !== undefined && key !== 'description') {
          params.append(key, String(value));
        }
      }

      logger.debug({ url: url.toString(), params: params.toString() }, `Attempting to add user group: ${context.group}`);

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
        const message = `Failed to add user group. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }
      
      // API returns an array containing the new group
      const newGroupData = Array.isArray(responseData) ? responseData[0] : responseData;

      const validationResult = userGroupSchema.safeParse(newGroupData);
      if (!validationResult.success) {
        const message = 'Add user group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: newGroupData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: newGroupData,
        };
      }

      logger.info({ userGroup: validationResult.data }, 'User group added successfully.');
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred during user group creation.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 