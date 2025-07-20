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
 * @module displayGroup/schemas
 * @description Provides shared Zod schemas for the Display Group tools,
 * ensuring consistent data validation across all related operations.
 */
import { z } from 'zod';

/**
 * Schema for a minimal display object, often used in lists within a display group.
 */
export const embeddedDisplaySchema = z.object({
  displayId: z.number().describe('The ID of the display.'),
  display: z.string().describe('The name of the display.'),
});

/**
 * Schema for the response object when assigning a display to a group.
 */
export const assignedDisplaySchema = z.object({
  displayId: z.number().describe('The ID of the assigned display.'),
  display: z.string().describe('The name of the assigned display.'),
});

/**
 * Core schema for a Display Group object, based on the Xibo API definition.
 */
export const displayGroupSchema = z.object({
  displayGroupId: z.number().describe('The ID of the display group.'),
  displayGroup: z.string().describe('The name of the display group.'),
  description: z
    .string()
    .nullable()
    .describe('An optional description for the group.'),
  isDisplaySpecific: z
    .number()
    .describe('A flag indicating if this group is for a specific display.'),
  isDynamic: z.number().describe('A flag indicating if this is a dynamic group.'),
  dynamicCriteria: z
    .string()
    .nullable()
    .describe('The filter criteria for a dynamic group.'),
  dynamicCriteriaLogicalOperator: z
    .string()
    .optional()
    .describe('Logical operator for dynamic criteria.'),
  dynamicCriteriaTags: z.string().nullable().describe('Tags for dynamic criteria.'),
  dynamicCriteriaExactTags: z
    .number()
    .optional()
    .describe('Flag for exact tag matching in dynamic criteria.'),
  dynamicCriteriaTagsLogicalOperator: z
    .string()
    .optional()
    .describe('Logical operator for tags in dynamic criteria.'),
  userId: z.number().describe('The ID of the user that owns this group.'),
  tags: z
    .array(z.any())
    .nullable()
    .describe('An array of tag objects associated with this group.'),
  bandwidthLimit: z.number().optional().describe('Bandwidth limit for the group.'),
  groupsWithPermissions: z
    .any()
    .nullable()
    .describe('Information about groups with permissions.'),
  createdDt: z.string().optional().describe('Creation date.'),
  modifiedDt: z.string().optional().describe('Last modification date.'),
  folderId: z.number().optional().describe('The ID of the folder.'),
  permissionsFolderId: z.number().optional().describe('The ID of the permissions folder.'),
  ref1: z.string().nullable().describe('Custom reference field 1.'),
  ref2: z.string().nullable().describe('Custom reference field 2.'),
  ref3: z.string().nullable().describe('Custom reference field 3.'),
  ref4: z.string().nullable().describe('Custom reference field 4.'),
  ref5: z.string().nullable().describe('Custom reference field 5.'),
  displays: z
    .array(embeddedDisplaySchema)
    .optional()
    .describe(
      'An array of displays assigned to this group. Requires "embed=displays" parameter.'
    ),
}); 