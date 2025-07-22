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

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../logger';

const regionOptionSchema = z.object({
  regionId: z.number().nullable(),
  option: z.string().nullable(),
  value: z.string().nullable()
});

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

const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number().nullable(),
  value: z.string().nullable()
});

const widgetOptionSchema = z.object({
  widgetId: z.number().nullable(),
  type: z.string().nullable(),
  option: z.string().nullable(),
  value: z.string().nullable()
});

const audioSchema = z.object({
  widgetId: z.number().nullable(),
  mediaId: z.number().nullable(),
  volume: z.number().nullable(),
  loop: z.number().nullable()
});

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

const regionSchema = z.object({
  regionId: z.number(),
  layoutId: z.number(),
  ownerId: z.number(),
  type: z.string().nullable(),
  name: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  left: z.number(),
  zIndex: z.number(),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  duration: z.number().nullable(),
  isDrawer: z.number().nullable(),
  regionPlaylist: regionPlaylistSchema.nullable()
});

/**
 * Tool to add a new region to a layout
 * Implements the layout/region endpoint from Xibo API
 * Creates a new region with specified dimensions and position
 */
export const addRegion = createTool({
  id: 'add-region',
  description: 'Add a new region to a layout',
  inputSchema: z.object({
    id: z.number().describe('The Layout ID to add the Region to'),
    type: z.enum(['zone', 'frame', 'playlist', 'canvas']).default('frame').optional().describe('The type of region this should be, zone, frame, playlist or canvas. Default = frame'),
    width: z.number().default(250).optional().describe('The Width, default 250'),
    height: z.number().default(150).optional().describe('The Height, default 150'),
    top: z.number().default(0).optional().describe('The Top Coordinate, default 0'),
    left: z.number().default(0).optional().describe('The Left Coordinate, default 0')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
    data: regionSchema.optional()
  }),
  execute: async ({ context }) => {
    logger.info(`Executing addRegion for layout ID: ${context.id}`, context);

    try {
      if (!config.cmsUrl) {
        const errorMsg = "CMS URL is not configured";
        logger.error(`addRegion: ${errorMsg}`);
        return { success: false, message: "Failed to add region", error: errorMsg };
      }

      const authHeaders = await getAuthHeaders();
      const headers = new Headers(authHeaders);
      headers.set('Content-Type', 'application/x-www-form-urlencoded');

      const url = `${config.cmsUrl}/api/region/${context.id}`;

      // Build form data
      const formData = new URLSearchParams();
      formData.append('type', context.type as string);
      formData.append('width', (context.width as number).toString());
      formData.append('height', (context.height as number).toString());
      formData.append('top', (context.top as number).toString());
      formData.append('left', (context.left as number).toString());

      logger.debug("addRegion: Sending POST request", {
        url,
        body: formData.toString()
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      const responseText = await response.text();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(responseText);
        logger.error("addRegion: API error response", {
          status: response.status,
          error: errorMessage,
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${errorMessage}`,
          error: errorMessage
        };
      }

      try {
        const data = JSON.parse(responseText);
        const validatedData = regionSchema.parse(data);

        logger.info(`addRegion: Successfully added region with ID ${validatedData.regionId}`);

        return {
          success: true,
          message: "Successfully added region.",
          data: validatedData
        };
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : "Response validation failed";
        logger.error(`addRegion: Failed to validate API response`, { error: validationError, response: responseText });
        return {
          success: false,
          message: "Response validation failed.",
          error: errorMessage
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`addRegion: An unexpected error occurred`, { error: errorMessage });
      return {
        success: false,
        message: "An unexpected error occurred while adding the region.",
        error: errorMessage
      };
    }
  },
});
