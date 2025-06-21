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
 * Xibo CMS Playlist Creation Tool
 * 
 * This module provides functionality to add a new playlist to the Xibo CMS system.
 * It implements the playlist creation API endpoint and handles the necessary validation
 * and data transformation for creating a new playlist.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

// Schema for tags
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string().nullable()
});

// Schema for widget options
const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string(),
  option: z.string(),
  value: z.any() // Value can be of any type
});

// Schema for audio files associated with a widget
const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number()
});

// Schema for permissions
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

// Schema for widgets within a playlist
const widgetSchema = z.object({
  widgetId: z.number(),
  playlistId: z.number(),
  ownerId: z.number(),
  type: z.string(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number(),
  createdDt: z.string(),
  modifiedDt: z.string(),
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


// Schema for the successful playlist creation response
const playlistResponseSchema = z.object({
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
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.number(),
  requiresDurationUpdate: z.number(),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema),
  widgets: z.array(widgetSchema),
  permissions: z.array(permissionSchema),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable()
});

/**
 * Tool for adding a new playlist to Xibo CMS.
 * 
 * This tool allows creating both static and dynamic playlists with various
 * filtering options.
 */
export const addPlaylist = createTool({
  id: 'add-playlist',
  description: 'Adds a new playlist to Xibo CMS',
  inputSchema: z.object({
    name: z.string().describe('The name of the playlist (required)'),
    tags: z.string().optional().describe('Comma-separated list of tags for the playlist'),
    isDynamic: z.number().describe('Flag indicating if the playlist is dynamic (0: No, 1: Yes)'),
    filterMediaName: z.string().optional().describe('Filter media by name (for dynamic playlists)'),
    logicalOperatorName: z.enum(['AND', 'OR']).optional().describe('Logical operator for multiple media name filters'),
    filterMediaTag: z.string().optional().describe('Filter media by tags (for dynamic playlists)'),
    exactTags: z.number().optional().describe('Flag for exact tag matching (0 or 1)'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('Logical operator for multiple tag filters'),
    maxNumberOfItems: z.number().optional().describe('Maximum number of items for a dynamic playlist'),
    folderId: z.number().optional().describe('The ID of the folder to create the playlist in')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: playlistResponseSchema.optional(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("addPlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const authHeaders = await getAuthHeaders();
      const headers = new Headers(authHeaders);
      headers.set('Content-Type', 'application/x-www-form-urlencoded');

      const url = `${config.cmsUrl}/api/playlist`;
      
      const params = new URLSearchParams();
      params.append('name', context.name);
      params.append('isDynamic', context.isDynamic.toString());
      if (context.tags) params.append('tags', context.tags);
      if (context.filterMediaName) params.append('filterMediaName', context.filterMediaName);
      if (context.logicalOperatorName) params.append('logicalOperatorName', context.logicalOperatorName);
      if (context.filterMediaTag) params.append('filterMediaTag', context.filterMediaTag);
      if (context.exactTags !== undefined) params.append('exactTags', context.exactTags.toString());
      if (context.logicalOperator) params.append('logicalOperator', context.logicalOperator);
      if (context.maxNumberOfItems !== undefined) params.append('maxNumberOfItems', context.maxNumberOfItems.toString());
      if (context.folderId !== undefined) params.append('folderId', context.folderId.toString());

      logger.debug(`addPlaylist: Sending request to ${url}`, { params: params.toString() });

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: params
      });

      if (!response.ok) {
        const errorMessage = await decodeErrorMessage(await response.text());
        logger.error("addPlaylist: API error response", {
            status: response.status,
            error: errorMessage
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${errorMessage}`,
          error: errorMessage
        };
      }

      const data = await response.json();
      
      try {
        const validatedData = playlistResponseSchema.parse(data);
        logger.info(`addPlaylist: Successfully added playlist with ID ${validatedData.playlistId}`);
        return {
          success: true,
          data: validatedData
        };
      } catch (validationError) {
        logger.error('addPlaylist: Response validation failed', { 
          error: validationError, 
          data 
        });
        return { 
          success: false, 
          message: 'Response validation failed', 
          error: validationError instanceof Error ? validationError.message : String(validationError)
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in addPlaylist';
      logger.error('Error in addPlaylist', { error: errorMessage });
      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      };
    }
  },
}); 