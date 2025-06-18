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
import { logger } from '../../../index';

const regionOptionSchema = z.object({
  regionId: z.number(),
  option: z.string(),
  value: z.string()
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

const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string()
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
  type: z.string(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  fromDt: z.number(),
  toDt: z.number(),
  schemaVersion: z.number(),
  transitionIn: z.number(),
  transitionOut: z.number(),
  transitionDurationIn: z.number(),
  transitionDurationOut: z.number(),
  widgetOptions: z.array(widgetOptionSchema),
  mediaIds: z.array(z.number()),
  audio: z.array(audioSchema),
  permissions: z.array(permissionSchema),
  playlist: z.string()
});

const regionPlaylistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number(),
  isDynamic: z.number(),
  filterMediaName: z.string(),
  filterMediaNameLogicalOperator: z.string(),
  filterMediaTags: z.string(),
  filterExactTags: z.number(),
  filterMediaTagsLogicalOperator: z.string(),
  filterFolderId: z.number(),
  maxNumberOfItems: z.number(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.number(),
  requiresDurationUpdate: z.number(),
  enableStat: z.string(),
  tags: z.array(tagSchema),
  widgets: z.array(widgetSchema),
  permissions: z.array(permissionSchema),
  folderId: z.number(),
  permissionsFolderId: z.number()
});

const regionSchema = z.object({
  regionId: z.number(),
  layoutId: z.number(),
  ownerId: z.number(),
  type: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  left: z.number(),
  zIndex: z.number(),
  syncKey: z.string(),
  regionOptions: z.array(regionOptionSchema),
  permissions: z.array(permissionSchema),
  duration: z.number(),
  isDrawer: z.number(),
  regionPlaylist: regionPlaylistSchema
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
    try {
      if (!config.cmsUrl) {
        logger.error("addRegion: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Adding region to layout ${context.id}`, {
        type: context.type,
        width: context.width,
        height: context.height,
        top: context.top,
        left: context.left
      });

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/region/${context.id}`;

      // Build form data
      const formData = new URLSearchParams();
      formData.append('type', context.type || 'frame');
      formData.append('width', context.width?.toString() || '');
      formData.append('height', context.height?.toString() || '');
      formData.append('top', context.top?.toString() || '');
      formData.append('left', context.left?.toString() || '');

      logger.info("addRegion: Request details", {
        url,
        method: 'POST',
        headers,
        body: formData.toString()
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });
      console.log(response);
      if (!response.ok) {
        const responseText = await response.text();
        const decodedText = decodeURIComponent(responseText);
        const parsedError = JSON.parse(decodedText);
        logger.error("addRegion: API error response", {
          status: response.status,
          error: parsedError.error,
          message: parsedError.message,
          property: parsedError.property,
          help: parsedError.help
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${parsedError.message}`,
          error: parsedError
        };
      }

      const data = await response.json();
      const validatedData = regionSchema.parse(data);

      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});
