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
 * This module defines common Zod schemas for the MenuBoard tools in the Xibo Agent.
 * These schemas are used for data validation and type inference across multiple tools.
 */

import { z } from 'zod';

/**
 * Schema for a single menu board object.
 */
export const menuBoardSchema = z.object({
  menuId: z.number().describe('The unique identifier for the menu board.'),
  name: z.string().describe('The name of the menu board.'),
  description: z.string().optional().describe('An optional description for the menu board.'),
  code: z.string().optional().describe('An optional code for the menu board.'),
  userId: z.number().describe('The ID of the user who owns the menu board.'),
  modifiedDt: z.number().describe('The last modification timestamp.'),
  folderId: z.string().describe('The ID of the folder containing the menu board.'),
  permissionsFolderId: z.number().describe('The ID of the folder that defines permissions.'),
  groupsWithPermissions: z.string().describe('Permissions for the groups.'),
});

/**
 * Schema for a single menu board category.
 */
export const menuBoardCategorySchema = z.object({
  menuCategoryId: z.number().describe('The unique identifier for the menu category.'),
  menuId: z.number().describe('The ID of the menu board this category belongs to.'),
  name: z.string().describe('The name of the category.'),
  description: z.string().optional().describe('An optional description for the category.'),
  code: z.string().optional().describe('An optional code for the category.'),
  mediaId: z.number().optional().describe('The ID of the media associated with the category.'),
});

/**
 * Schema for a single menu board product.
 */
export const menuBoardProductSchema = z.object({
  menuProductId: z.number().describe('The unique identifier for the product.'),
  menuCategoryId: z.number().describe('The ID of the category this product belongs to.'),
  menuId: z.number().describe('The ID of the menu board this product belongs to.'),
  name: z.string().describe('The name of the product.'),
  price: z.number().optional().describe('The price of the product.'),
  description: z.string().optional().describe('An optional description for the product.'),
  code: z.string().optional().describe('An optional code for the product.'),
  displayOrder: z.number().describe('The display order of the product.'),
  availability: z.number().optional().describe('Flag indicating product availability.'),
  allergyInfo: z.string().optional().describe('Allergy information for the product.'),
  calories: z.number().optional().describe('Calorie count for the product.'),
  mediaId: z.number().optional().describe('The ID of the media associated with the product.'),
  productOptions: z.array(z.string()).optional().describe('An array of product options.'),
}); 