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
  regionId: z.union([z.number(), z.string().transform(Number)]),
  option: z.string().nullable(),
  value: z.string().nullable()
});

/**
 * Schema for permissions on an entity.
 */
const permissionSchema = z.object({
  permissionId: z.union([z.number(), z.string().transform(Number)]),
  entityId: z.union([z.number(), z.string().transform(Number)]),
  groupId: z.union([z.number(), z.string().transform(Number)]),
  objectId: z.union([z.number(), z.string().transform(Number)]),
  isUser: z.union([z.number(), z.string().transform(Number)]),
  entity: z.string().nullable(),
  objectIdString: z.string().nullable(),
  group: z.string().nullable(),
  view: z.union([z.number(), z.string().transform(Number)]),
  edit: z.union([z.number(), z.string().transform(Number)]),
  delete: z.union([z.number(), z.string().transform(Number)]),
  modifyPermissions: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Schema for tags associated with an entity.
 */
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.union([z.number(), z.string().transform(Number)]),
  value: z.string().nullable()
});

/**
 * Schema for widget options.
 */
const widgetOptionSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string().nullable(),
  option: z.string().nullable(),
  value: z.union([z.string(), z.array(z.any()), z.record(z.any())]).nullable()
});

/**
 * Schema for audio associated with a widget.
 */
const audioSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  mediaId: z.union([z.number(), z.string().transform(Number)]),
  volume: z.union([z.number(), z.string().transform(Number)]),
  loop: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Schema for a widget within a playlist.
 */
const widgetSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  playlistId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string().nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  displayOrder: z.union([z.number(), z.string().transform(Number)]),
  useDuration: z.union([z.number(), z.string().transform(Number)]),
  calculatedDuration: z.union([z.number(), z.string().transform(Number)]).optional(),
  createdDt: z.union([z.string(), z.number()]).nullable(),
  modifiedDt: z.union([z.string(), z.number()]).nullable(),
  fromDt: z.union([z.number(), z.string().transform(Number)]).nullable(),
  toDt: z.union([z.number(), z.string().transform(Number)]).nullable(),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  transitionIn: z.union([z.number(), z.string().transform(Number)]).nullable(),
  transitionOut: z.union([z.number(), z.string().transform(Number)]).nullable(),
  transitionDurationIn: z.union([z.number(), z.string().transform(Number)]).nullable(),
  transitionDurationOut: z.union([z.number(), z.string().transform(Number)]).nullable(),
  widgetOptions: z.array(widgetOptionSchema).optional(),
  mediaIds: z.array(z.union([z.number(), z.string().transform(Number)])).optional(),
  audio: z.array(audioSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  playlist: z.string().nullable()
});

/**
 * Schema for a playlist within a region.
 */
const regionPlaylistSchema = z.object({
  playlistId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  name: z.string().nullable(),
  regionId: z.union([z.number(), z.string().transform(Number)]).optional(),
  isDynamic: z.union([z.number(), z.string().transform(Number)]),
  filterMediaName: z.string().nullable(),
  filterMediaNameLogicalOperator: z.string().nullable(),
  filterMediaTags: z.string().nullable(),
  filterExactTags: z.union([z.number(), z.string().transform(Number)]).nullable(),
  filterMediaTagsLogicalOperator: z.string().nullable(),
  filterFolderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  maxNumberOfItems: z.union([z.number(), z.string().transform(Number)]).nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  requiresDurationUpdate: z.union([z.number(), z.string().transform(Number)]),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema).optional(),
  widgets: z.array(widgetSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  folderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)]).nullable()
});

/**
 * Schema for a region within a layout.
 */
const regionSchema = z.object({
  regionId: z.union([z.number(), z.string().transform(Number)]),
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string().nullable(),
  name: z.string().nullable(),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  top: z.union([z.number(), z.string().transform(Number)]),
  left: z.union([z.number(), z.string().transform(Number)]),
  zIndex: z.union([z.number(), z.string().transform(Number)]),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  isDrawer: z.union([z.number(), z.string().transform(Number)]).optional(),
  regionPlaylist: regionPlaylistSchema.optional()
});

/**
 * Schema for the layout response from the API.
 */
const layoutResponseSchema = z.object({
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  campaignId: z.union([z.number(), z.string().transform(Number)]),
  parentId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  publishedStatusId: z.union([z.number(), z.string().transform(Number)]),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  layout: z.string().nullable(),
  description: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  status: z.union([z.number(), z.string().transform(Number)]),
  retired: z.union([z.number(), z.string().transform(Number)]),
  backgroundzIndex: z.union([z.number(), z.string().transform(Number)]),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  orientation: z.string().nullable(),
  displayOrder: z.union([z.number(), z.string().transform(Number)]).nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  statusMessage: z.string().nullable(),
  enableStat: z.union([z.number(), z.string().transform(Number)]),
  autoApplyTransitions: z.union([z.number(), z.string().transform(Number)]),
  code: z.string().nullable(),
  isLocked: z.union([
    z.object({
      layoutId: z.number(),
      userId: z.number(),
      entryPoint: z.string(),
      expires: z.string(),
      lockedUser: z.boolean()
    }),
    z.boolean(),
    z.array(z.any()).length(0)
  ]).nullable(),
  regions: z.array(regionSchema),
  tags: z.array(tagSchema),
  folderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)]).nullable()
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