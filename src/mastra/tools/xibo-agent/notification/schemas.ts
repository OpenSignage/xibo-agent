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
 * @module NotificationSchemas
 * @description Provides shared Zod schemas for notification-related tools.
 * This module centralizes the data structures for notifications, user groups,
 * display groups, and tags to ensure consistency across different tools.
 */
import { z } from 'zod';

/**
 * Schema for tag data, which can be associated with various entities.
 */
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
}).passthrough();

/**
 * Schema for user group data.
 */
const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number(),
  isEveryone: z.number(),
  description: z.string().nullable(),
  libraryQuota: z.number().nullable(),
  isSystemNotification: z.number().nullable(),
  isDisplayNotification: z.number().nullable(),
  isDataSetNotification: z.number().nullable(),
  isLayoutNotification: z.number().nullable(),
  isLibraryNotification: z.number().nullable(),
  isReportNotification: z.number().nullable(),
  isScheduleNotification: z.number().nullable(),
  isCustomNotification: z.number().nullable(),
  isShownForAddUser: z.number().nullable(),
  defaultHomepageId: z.string().nullable(),
  features: z.array(z.string()).nullable(),
}).passthrough();

/**
 * Schema for display group data.
 */
const displayGroupSchema = z.object({
  displayGroupId: z.number(),
  displayGroup: z.string(),
  description: z.string().nullable(),
  isDisplaySpecific: z.number(),
  isDynamic: z.number(),
  dynamicCriteria: z.string().nullable(),
  dynamicCriteriaLogicalOperator: z.string().nullable(),
  dynamicCriteriaTags: z.string().nullable(),
  dynamicCriteriaExactTags: z.number(),
  dynamicCriteriaTagsLogicalOperator: z.string().nullable(),
  userId: z.number(),
  tags: z.array(tagSchema).nullable(),
  bandwidthLimit: z.number().nullable(),
  groupsWithPermissions: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  ref1: z.string().nullable(),
  ref2: z.string().nullable(),
  ref3: z.string().nullable(),
  ref4: z.string().nullable(),
  ref5: z.string().nullable(),
}).passthrough();

/**
 * Schema for the main notification object.
 * It includes details about the notification and can embed user and display group data.
 */
export const notificationSchema = z.object({
  notificationId: z.number(),
  subject: z.string(),
  body: z.string(),
  createDt: z.union([z.string(), z.number()]).optional(),
  releaseDt: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  isEmail: z.number().optional(),
  isInterrupt: z.number(),
  isSystem: z.number(),
  userId: z.number(),
  filename: z.string().nullable().optional(),
  originalFileName: z.string().nullable().optional(),
  nonusers: z.string().nullable().optional(),
  userGroups: z.array(userGroupSchema).nullable().optional(),
  displayGroups: z.array(displayGroupSchema).nullable().optional(),
  displayGroupIds: z.array(z.number()).optional(),
  displayGroupNames: z.array(z.string()).optional(),
  read: z.number().optional(),
  readDt: z.string().nullable().optional(),
  readBy: z.string().nullable().optional()
}).passthrough(); 