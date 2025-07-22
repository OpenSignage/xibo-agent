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
 * @module editUserGroup
 * @description Provides a tool to edit an existing user group in the Xibo CMS.
 * It implements the PUT /group/{userGroupId} API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger'; 
import { processError } from '../utility/error';
import { userGroupSchema, errorResponseSchema } from './schemas';

/**
 * Schema for the successful response after editing a user group.
 * The API returns an array, but we expect a single edited group.
 */
const editUserGroupResponseSchema = z.object({
  success: z.literal(true),
  data: userGroupSchema,
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([editUserGroupResponseSchema, errorResponseSchema]);

/**
 * Tool to edit an existing user group in the Xibo CMS.
 */
export const editUserGroup = createTool({
  id: 'edit-user-group',
  description: 'Edits an existing User Group in the Xibo CMS.',
  inputSchema: z.object({
    userGroupId: z.number().describe('The ID of the user group to edit.'),
    group: z.string().describe('The new name for the user group.'),
    description: z.string().optional().describe('The new description for the user group.'),
    libraryQuota: z.string().optional().describe('The new library quota in KiB. 0 for unlimited.'),
    isSystemNotification: z.number().optional().describe('Flag (0, 1) to receive system notifications.'),
    isDisplayNotification: z.number().optional().describe('Flag (0, 1) to receive display notifications.'),
    isDataSetNotification: z.number().optional().describe('Flag (0, 1) to receive DataSet notification emails.'),
    isLayoutNotification: z.number().optional().describe('Flag (0, 1) to receive Layout notification emails.'),
    isLibraryNotification: z.number().optional().describe('Flag (0, 1) to receive Library notification emails.'),
    isReportNotification: z.number().optional().describe('Flag (0, 1) to receive Report notification emails.'),
    isScheduleNotification: z.number().optional().describe('Flag (0, 1) to receive Schedule notification emails.'),
    isCustomNotification: z.number().optional().describe('Flag (0, 1) to receive Custom notification emails.'),
    isShownForAddUser: z.number().optional().describe('Flag (0, 1) to show this Group in the Add User form.'),
    defaultHomePageId: z.number().optional().describe('The new default home page ID for the user group.'),
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
      const url = new URL(`${config.cmsUrl}/api/group/${userGroupId}`);

      const params = new URLSearchParams();
      // Note: API spec has a typo 'decription', but we use 'description' for input
      if (body.description) {
        params.append('decription', body.description);
      }
      
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && key !== 'description') {
          params.append(key, String(value));
        }
      }

      logger.debug({ url: url.toString(), params: params.toString() }, `Attempting to edit user group ID: ${userGroupId}`);

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
        const message = `Failed to edit user group. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }

      // API returns an array containing the edited group
      const editedGroupData = Array.isArray(responseData) ? responseData[0] : responseData;

      const validationResult = userGroupSchema.safeParse(editedGroupData);
      if (!validationResult.success) {
        const message = 'Edit user group response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: editedGroupData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: editedGroupData,
        };
      }

      logger.info({ userGroup: validationResult.data }, 'User group edited successfully.');
      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = 'An unexpected error occurred while editing the user group.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
}); 