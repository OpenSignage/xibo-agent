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
 * @module UserSchemas
 * @description This module defines the Zod schemas for user-related tools in the Xibo CMS.
 * It includes schemas for users, groups, permissions, and API responses.
 */
import { z } from 'zod';

// Basic entity schemas
export const permissionSchema = z.object({
  permissionId: z.number().optional(),
  entityId: z.number(),
  groupId: z.number(),
  objectId: z.number(),
  isUser: z.number().nullable(),
  entity: z.string(),
  objectIdString: z.string().nullable().optional(),
  group: z.string().optional(),
  view: z.number(),
  edit: z.number(),
  delete: z.number(),
  modifyPermissions: z.number().nullable().optional(),
});

export const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserGroup: z.number().optional(),
  isEveryone: z.number().optional(),
  libraryQuota: z.number(),
  userGroupId: z.number().optional(),
  description: z.string().nullable().optional(),
});

// Main user schema
export const userSchema = z.object({
  userId: z.number(),
  userName: z.string(),
  userGroupId: z.number().optional(),
  loggedIn: z.number().nullable(),
  userTypeId: z.number(),
  userType: z.string().optional(),
  lastAccessed: z.string().nullable(),
  homePage: z.string().optional(),
  email: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  ref1: z.string().nullable().optional(),
  ref2: z.string().nullable().optional(),
  ref3: z.string().nullable().optional(),
  ref4: z.string().nullable().optional(),
  ref5: z.string().nullable().optional(),
  libraryQuota: z.number().optional(),
  isRetired: z.number().optional(),
  isLocked: z.number().optional(),
  permissions: z.array(permissionSchema).optional().nullable(),
  groups: z.array(userGroupSchema).optional().nullable(),
});

// Preference Schemas
export const preferenceSchema = z.object({
  preference: z.string(),
  value: z.any(),
  userId: z.number().optional(),
}); 