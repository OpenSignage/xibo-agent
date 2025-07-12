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
import { z } from 'zod';

/**
 * @module FolderSchemas
 * @description This module defines the Zod schemas for folder-related tools in the Xibo CMS.
 * It includes schemas for folder data structures and API responses.
 */

/**
 * Base schema for folder data.
 * It is defined lazily to handle recursive child folders.
 */
export const folderSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.number().describe("The unique identifier for the folder."),
    type: z.string().nullable().describe("The type of the folder, if specified."),
    text: z.string().describe("The display name of the folder."),
    parentId: z
      .union([z.number(), z.string()])
      .nullable()
      .describe("The ID of the parent folder."),
    isRoot: z.number().nullable().describe("Flag indicating if this is a root folder."),
    children: z
      .union([z.array(folderSchema), z.string(), z.null()])
      .describe("A list of child folders, a string representation, or null if there are none."),
    permissionsFolderId: z
      .number()
      .nullable()
      .optional()
      .describe("The ID of the folder that defines permissions for this folder."),
    folderId: z.number().optional().describe("An alternative folder ID field."),
    folderName: z.string().optional().describe("An alternative folder name field."),
  }),
);

/**
 * TypeScript type inferred from the folderSchema for use in application code.
 */
export type FolderData = z.infer<typeof folderSchema>;

/**
 * Schema for a successful API response, containing an array of folders.
 */
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(folderSchema).describe('An array of folder objects.'),
});

/**
 * Generic schema for a successful response that returns a single folder object.
 */
export const singleFolderSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: folderSchema,
});

/**
 * Schema for a failed API response, including a message and optional error details.
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
}); 