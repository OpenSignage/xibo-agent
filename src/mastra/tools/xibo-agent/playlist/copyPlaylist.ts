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
 * @module copy-playlist
 * @description This module provides a tool to copy an existing playlist.
 * It implements the POST /api/playlist/copy/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";

// Sub-schemas for the main playlist object
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable()
});

const permissionSchema = z.object({
  permissionId: z.number(),
  entityId: z.number(),
  groupId: z.number(),
  objectId: z.number(),
  isUser: z.number(),
  entity: z.string(),
  objectIdString: z.string(),
  group: z.string(),
  view: z.number(),
  edit: z.number(),
  delete: z.number(),
  modifyPermissions: z.number()
});

const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string(),
  option: z.string(),
  value: z.string()
});

const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number()
});

const widgetSchema = z.object({
  widgetId: z.number(),
  playlistId: z.number(),
  ownerId: z.number(),
  type: z.string().nullable(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  schemaVersion: z.number(),
  transitionIn: z.number().nullable(),
  transitionOut: z.number().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(widgetOptionSchema),
  mediaIds: z.array(z.number()),
  audio: z.array(audioSchema),
  permissions: z.array(permissionSchema),
  playlist: z.string().nullable()
});

// Main schema for a playlist object, based on the API response for a copied playlist.
const playlistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number().nullable(),
  isDynamic: z.number(),
  filterMediaName: z.string().nullable(),
  filterMediaNameLogicalOperator: z.string().nullable(),
  filterMediaTags: z.string().nullable(),
  filterExactTags: z.number().nullable(),
  filterMediaTagsLogicalOperator: z.string().nullable(),
  filterFolderId: z.number().nullable(),
  maxNumberOfItems: z.number().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  duration: z.number(),
  requiresDurationUpdate: z.number(),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema),
  widgets: z.array(widgetSchema),
  permissions: z.array(permissionSchema),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
});


/**
 * Tool to create a copy of an existing playlist.
 */
export const copyPlaylist = createTool({
  id: 'copy-playlist',
  description: 'Copies an existing playlist.',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to copy.'),
    name: z.string().describe('The name for the new copied playlist.'),
    copyMediaFiles: z.number().min(0).max(1).describe('Whether to copy the associated media files (1 for yes, 0 for no).')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: playlistSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("copyPlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers and construct the target URL for the copy operation.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/copy/${context.playlistId}`;
      logger.debug(`copyPlaylist: Request URL = ${url}`);

      // Prepare the request body with the new name and the flag for copying media.
      const formData = new URLSearchParams();
      formData.append('name', context.name);
      formData.append('copyMediaFiles', context.copyMediaFiles.toString());

      // Make the POST request to the Xibo API to copy the playlist.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      // Handle non-successful API responses.
      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("copyPlaylist: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      // Parse and validate the successful response data against the schema.
      const data = await response.json();
      const validatedData = playlistSchema.parse(data);

      // Return a success object with the validated data.
      return { success: true, data: validatedData };
    } catch (error) {
      // Handle Zod validation errors specifically.
      if (error instanceof z.ZodError) {
        logger.error("copyPlaylist: Validation error", { error: error.issues });
        return { success: false, message: "Validation error occurred", errorData: error.issues };
      }
      // Handle any other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("copyPlaylist: An unexpected error occurred", { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  },
}); 