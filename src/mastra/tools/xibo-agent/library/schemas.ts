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
 * Shared Schemas for Library Tools
 *
 * This module defines shared Zod schemas for the data objects
 * related to media library management in the Xibo CMS, based on xibo-api.json.
 */
import { z } from "zod";

/**
 * Schema for a media item in the Xibo Library.
 * This is based on the 'Library' definition in the API specification.
 */
export const librarySchema = z.object({
    mediaId: z.number().describe("The unique ID of the media item."),
    ownerId: z.number().describe("The ID of the user who owns this media item."),
    name: z.string().describe("The name of the media item."),
    mediaType: z.string().describe("The type of the media (e.g., 'image', 'video')."),
    duration: z.number().describe("The duration of the media item in seconds."),
    fileSize: z.number().describe("The size of the media file in bytes."),
    storedAs: z.string().describe("The filename of the media as stored on the CMS."),
    md5: z.string().nullable().describe("The MD5 hash of the media file."),
    createdDt: z.string().describe("The date and time the media item was created."),
    modifiedDt: z.string().describe("The date and time the media item was last modified."),
    retired: z.number().describe("A flag indicating if the media item is retired (1 for yes, 0 for no)."),
    updateInLayouts: z.number().optional().describe("A flag to indicate that Layouts should be updated with this new version of the media."),
    isTidied: z.number().optional().describe("A flag to indicate whether the media has been tidied or not."),
    isEdited: z.number().describe("A flag to indicate whether the media has been edited or not."),
    nonTidyPath: z.string().nullable().optional().describe("The path to the file if it hasn't been tidied."),
    folderId: z.number().nullable().describe("The ID of the folder this media item belongs to."),
    // Optional fields that can be embedded
    tags: z.array(z.object({
        tagId: z.number(),
        tag: z.string(),
        value: z.string().nullable(),
    })).optional().describe("Tags associated with the media item."),
    permissions: z.string().nullable().optional().describe("Permissions string for the media item."),
    groupsWithPermissions: z.array(z.object({
        groupId: z.number(),
        group: z.string(),
        objectOwner: z.string(),
    })).nullable().optional().describe("User groups with permissions for this media item."),
});

/**
 * Schema for the successful response of library search operations.
 */
export const librarySearchResponseSchema = z.array(librarySchema); 