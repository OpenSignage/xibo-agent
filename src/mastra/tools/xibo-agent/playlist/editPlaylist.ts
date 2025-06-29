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
 * @module edit-playlist
 * @description This module provides a tool to edit an existing playlist in Xibo.
 * It implements the PUT /api/playlist/{playlistId} endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for tags associated with a playlist
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
});

// Schema for widgets within a playlist
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
  transitionIn: z.string().nullable(),
  transitionOut: z.string().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(z.any()),
  mediaIds: z.array(z.number()),
  audio: z.array(z.any()),
  permissions: z.array(z.any()),
  playlist: z.string().nullable(),
});

// Main schema for a playlist object returned from the API
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
  permissions: z.array(z.any()),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  statusMessage: z.union([z.string(), z.array(z.any())]).nullable().optional(),
});

/**
 * Tool to edit an existing playlist in the Xibo CMS.
 */
export const editPlaylist = createTool({
  id: 'edit-playlist',
  description: 'Edits an existing playlist',
  inputSchema: z.object({
    playlistId: z.number().describe('The ID of the playlist to edit.'),
    name: z.string().describe('The new name for the playlist.'),
    tags: z.string().optional().describe('A comma-separated list of tags for the playlist.'),
    isDynamic: z.number().describe('Set to 1 for a dynamic playlist, 0 for static.'),
    filterMediaName: z.string().optional().describe('For dynamic playlists, filter media by name.'),
    logicalOperatorName: z.enum(['AND', 'OR']).optional().describe('Logical operator for name filtering (AND/OR).'),
    filterMediaTag: z.string().optional().describe('For dynamic playlists, filter media by tags.'),
    exactTags: z.number().optional().describe('For dynamic playlists, set to 1 for exact tag matching.'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('Logical operator for tag filtering (AND/OR).'),
    maxNumberOfItems: z.number().optional().describe('For dynamic playlists, the maximum number of items.'),
    folderId: z.number().optional().describe('The ID of the folder to store the playlist in.')
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
        logger.error("editPlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Get authentication headers for the API request.
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist/${context.playlistId}`;
      logger.debug(`editPlaylist: Request URL = ${url}`);

      // Construct the request body from the provided context using URLSearchParams.
      const formData = new URLSearchParams();
      // Only append fields that are actually provided in the context, excluding the playlistId.
      Object.entries(context).forEach(([key, value]) => {
          if (key !== 'playlistId' && value !== undefined) {
              formData.append(key, String(value));
          }
      });

      logger.debug("editPlaylist: Request details", {
        url,
        method: 'PUT',
        body: formData.toString()
      });

      // Make the API call to the Xibo CMS to edit the playlist.
      const response = await fetch(url, {
        method: 'PUT',
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
        logger.error("editPlaylist: API error response", {
          status: response.status,
          error: parsedError
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}`,
          errorData: parsedError
        };
      }

      // Parse and validate the successful response data against the schema.
      const data = await response.json();
      const validatedData = playlistSchema.parse(data);

      // Return a success object with the validated data.
      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      // Handle Zod validation errors specifically.
      if (error instanceof z.ZodError) {
        logger.error("editPlaylist: Validation error", { error: error.issues });
        return {
          success: false,
          message: "Validation error occurred",
          errorData: error.issues
        };
      }
      // Handle any other unexpected errors.
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("editPlaylist: An unexpected error occurred", { error: errorMessage });
      return {
        success: false,
        message: errorMessage
      };
    }
  },
}); 