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
 * Xibo CMS Fullscreen Layout Creation Tool
 * 
 * This module provides functionality to create a new fullscreen layout
 * in the Xibo CMS system. It simplifies the process by creating a layout
 * with a single, full-size region containing a specified media or playlist.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Schema for region options.
 */
const regionOptionSchema = z.object({
  regionId: z.number().nullable(),
  option: z.string().nullable(),
  value: z.string().nullable()
});

/**
 * Schema for permissions on an entity.
 */
const permissionSchema = z.object({
  permissionId: z.number().nullable(),
  entityId: z.number().nullable(),
  groupId: z.number().nullable(),
  objectId: z.number().nullable(),
  isUser: z.number().nullable(),
  entity: z.string().nullable(),
  objectIdString: z.string().nullable(),
  group: z.string().nullable(),
  view: z.number().nullable(),
  edit: z.number().nullable(),
  delete: z.number().nullable(),
  modifyPermissions: z.number().nullable()
});

/**
 * Schema for tags associated with an entity.
 */
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number().nullable(),
  value: z.string().nullable()
});

/**
 * Schema for widget options.
 */
const widgetOptionSchema = z.object({
  widgetId: z.number().nullable(),
  type: z.string().nullable(),
  option: z.string().nullable(),
  value: z.string().nullable()
});

/**
 * Schema for audio associated with a widget.
 */
const audioSchema = z.object({
  widgetId: z.number().nullable(),
  mediaId: z.number().nullable(),
  volume: z.number().nullable(),
  loop: z.number().nullable()
});

/**
 * Schema for a widget within a playlist.
 */
const widgetSchema = z.object({
  widgetId: z.number().nullable(),
  playlistId: z.number().nullable(),
  ownerId: z.number().nullable(),
  type: z.string().nullable(),
  duration: z.number().nullable(),
  displayOrder: z.number().nullable(),
  useDuration: z.number().nullable(),
  calculatedDuration: z.number().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  schemaVersion: z.number().nullable(),
  transitionIn: z.number().nullable(),
  transitionOut: z.number().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(widgetOptionSchema).nullable(),
  mediaIds: z.array(z.number()).nullable(),
  audio: z.array(audioSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  playlist: z.string().nullable()
});

/**
 * Schema for a playlist within a region.
 */
const regionPlaylistSchema = z.object({
  playlistId: z.number().nullable(),
  ownerId: z.number().nullable(),
  name: z.string().nullable(),
  regionId: z.number().nullable(),
  isDynamic: z.number().nullable(),
  filterMediaName: z.string().nullable(),
  filterMediaNameLogicalOperator: z.string().nullable(),
  filterMediaTags: z.string().nullable(),
  filterExactTags: z.number().nullable(),
  filterMediaTagsLogicalOperator: z.string().nullable(),
  filterFolderId: z.number().nullable(),
  maxNumberOfItems: z.number().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  duration: z.number().nullable(),
  requiresDurationUpdate: z.number().nullable(),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema).nullable(),
  widgets: z.array(widgetSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable()
});

/**
 * Schema for a region within a layout.
 */
const regionSchema = z.object({
  regionId: z.number().nullable(),
  layoutId: z.number().nullable(),
  ownerId: z.number().nullable(),
  type: z.string().nullable(),
  name: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  top: z.number().nullable(),
  left: z.number().nullable(),
  zIndex: z.number().nullable(),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  duration: z.number().nullable(),
  isDrawer: z.number().nullable(),
  regionPlaylist: regionPlaylistSchema.nullable()
});

/**
 * Schema for the layout response from the API.
 */
const layoutResponseSchema = z.object({
  layoutId: z.number().nullable(),
  ownerId: z.number().nullable(),
  campaignId: z.number().nullable(),
  parentId: z.number().nullable(),
  publishedStatusId: z.number().nullable(),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.number().nullable(),
  schemaVersion: z.number().nullable(),
  layout: z.string().nullable(),
  description: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  status: z.number().nullable(),
  retired: z.number().nullable(),
  backgroundzIndex: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  orientation: z.string().nullable(),
  displayOrder: z.number().nullable(),
  duration: z.number().nullable(),
  statusMessage: z.string().nullable(),
  enableStat: z.number().nullable(),
  autoApplyTransitions: z.number().nullable(),
  code: z.string().nullable(),
  isLocked: z.boolean().nullable(),
  regions: z.array(regionSchema).nullable(),
  tags: z.array(tagSchema).nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable()
});

/**
 * Tool to add a new fullscreen layout.
 * Implements the `layout/fullscreen` endpoint to create a layout with a single,
 * full-size region.
 */
export const addFullscreenLayout = createTool({
  id: 'add-fullscreen-layout',
  description: 'Add a new fullscreen layout with a single region',
  inputSchema: z.object({
    id: z.number().describe('The Media or Playlist ID that should be added to this Layout'),
    type: z.enum(['media', 'playlist']).describe('The type of Layout to be created: "media" or "playlist"'),
    resolutionId: z.number().optional().describe('The ID of the resolution for this Layout. Defaults to 1080p for playlists or the closest match for media.'),
    backgroundColor: z.string().default('#000000').describe('A HEX color for the background of this Layout. Defaults to black (#000000).'),
    layoutDuration: z.boolean().optional().describe('Used with media type to specify the duration this media should play in one loop.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: layoutResponseSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional()
  }),
  execute: async ({ context }) => {
    logger.info(`Executing addFullscreenLayout with context:`, context);

    try {
      if (!config.cmsUrl) {
        const errorMsg = "CMS URL is not configured";
        logger.error(`addFullscreenLayout: ${errorMsg}`);
        return { success: false, message: "Failed to add fullscreen layout", error: errorMsg };
      }

      const authHeaders = await getAuthHeaders();
      const headers = new Headers(authHeaders);
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
      
      const url = `${config.cmsUrl}/api/layout/fullscreen`;

      // Build form data from the context
      const formData = new URLSearchParams();
      formData.append('id', context.id.toString());
      formData.append('type', context.type);
      if (context.resolutionId !== undefined) {
        formData.append('resolutionId', context.resolutionId.toString());
      }
      formData.append('backgroundColor', context.backgroundColor);
      if (context.layoutDuration !== undefined) {
        formData.append('layoutDuration', context.layoutDuration.toString());
      }
      
      logger.debug(`addFullscreenLayout: Sending POST request to ${url}`, { body: formData.toString() });

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      const responseText = await response.text();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`addFullscreenLayout: API error response`, {
          status: response.status,
          response: responseText
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${errorMessage}`,
          error: errorMessage
        };
      }
      
      try {
        const data = JSON.parse(responseText);
        const validatedData = layoutResponseSchema.parse(data);
  
        logger.info(`addFullscreenLayout: Successfully added fullscreen layout with ID ${validatedData.layoutId}`);
  
        return {
          success: true,
          data: validatedData,
          message: "Successfully added fullscreen layout."
        };
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : "Response validation failed";
        logger.error(`addFullscreenLayout: Failed to validate API response`, { error: validationError, response: responseText });
        return {
          success: false,
          message: "Response validation failed.",
          error: errorMessage
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`addFullscreenLayout: An unexpected error occurred`, { error: errorMessage });
      return {
        success: false,
        message: "An unexpected error occurred while adding the fullscreen layout.",
        error: errorMessage
      };
    }
  },
}); 