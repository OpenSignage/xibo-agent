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
 * @module userGroupSchemas
 * @description This module contains shared Zod schemas for Xibo user group tools,
 * defining the structure of user group data and error responses.
 */
import { z } from 'zod';

/**
 * Schema for the main user group data object, based on the Xibo API definition.
 */
export const userGroupSchema = z.object({
  groupId: z.number().describe('The ID of the user group.'),
  group: z.string().describe('The name of the user group.'),
  isUserSpecific: z.number().describe('A flag indicating whether this is a user-specific group (1) or not (0).'),
  isEveryone: z.number().describe('A flag indicating if this is the special "everyone" group (1) or not (0).'),
  description: z.string().nullable().describe('The description of the user group.'),
  libraryQuota: z.number().nullable().describe('The library quota for the group in bytes. 0 means unlimited.'),
  isSystemNotification: z.number().describe('Flag indicating if the group receives system notifications (1) or not (0).'),
  isDisplayNotification: z.number().describe('Flag indicating if the group receives display notifications (1) or not (0).'),
  isDataSetNotification: z.number().describe('Flag indicating if the group receives DataSet notifications (1) or not (0).'),
  isLayoutNotification: z.number().describe('Flag indicating if the group receives layout notifications (1) or not (0).'),
  isLibraryNotification: z.number().describe('Flag indicating if the group receives library notifications (1) or not (0).'),
  isReportNotification: z.number().describe('Flag indicating if the group receives report notifications (1) or not (0).'),
  isScheduleNotification: z.number().describe('Flag indicating if the group receives schedule notifications (1) or not (0).'),
  isCustomNotification: z.number().describe('Flag indicating if the group receives custom notifications (1) or not (0).'),
  isShownForAddUser: z.number().describe('Flag indicating if this group is shown in the "Add User" form (1) or not (0).'),
  defaultHomepageId: z.string().nullable().describe('The default home page ID for new users in this group.'),
  features: z.array(z.string()).nullable().describe('A list of features this user group has access to.'),
});

/**
 * Schema for a standardized error response.
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
}); 