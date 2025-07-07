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
 * @module
 * This module defines common Zod schemas for the Display Group tools in the Xibo Agent.
 * These schemas are used for data validation and type inference across multiple tools.
 */

import { z } from 'zod';

/**
 * Schema for tag data associated with display groups.
 */
export const tagSchema = z.object({
  tag: z.string().describe('The name of the tag.'),
  tagId: z.number().describe('The unique identifier for the tag.'),
  value: z.string().describe('The value associated with the tag.'),
});

/**
 * Schema for a single display group object.
 */
export const displayGroupSchema = z.object({
  displayGroupId: z.number().describe('The unique identifier for the display group.'),
  displayGroup: z.string().describe('The name of the display group.'),
  description: z.string().nullable().describe('A description for the display group.'),
  isDisplaySpecific: z.number().describe('Flag indicating if the group is display-specific (0 or 1).'),
  isDynamic: z.number().describe('Flag indicating if the group is dynamic (0 or 1).'),
  dynamicCriteria: z.string().nullable().describe('The criteria for a dynamic group.'),
  dynamicCriteriaLogicalOperator: z.string().nullable().describe('The logical operator for dynamic criteria (AND/OR).'),
  dynamicCriteriaTags: z.string().nullable().describe('Tags used for dynamic criteria.'),
  dynamicCriteriaExactTags: z.number().describe('Flag for exact tag matching in dynamic criteria (0 or 1).'),
  dynamicCriteriaTagsLogicalOperator: z.string().nullable().describe('The logical operator for dynamic tag criteria (AND/OR).'),
  userId: z.number().describe('The user ID of the group owner.'),
  tags: z.array(tagSchema).describe('An array of tags associated with the display group.'),
  bandwidthLimit: z.number().describe('The bandwidth limit for the group.'),
  groupsWithPermissions: z.string().nullable().describe('Permissions for the group.'),
  createdDt: z.string().describe('The creation date of the group (ISO 8601 format).'),
  modifiedDt: z.string().describe('The last modification date of the group (ISO 8601 format).'),
  folderId: z.number().describe('The ID of the folder containing the group.'),
  permissionsFolderId: z.number().describe('The ID of the folder that defines permissions.'),
  ref1: z.string().nullable().describe('Optional reference field 1.'),
  ref2: z.string().nullable().describe('Optional reference field 2.'),
  ref3: z.string().nullable().describe('Optional reference field 3.'),
  ref4: z.string().nullable().describe('Optional reference field 4.'),
  ref5: z.string().nullable().describe('Optional reference field 5.'),
}); 