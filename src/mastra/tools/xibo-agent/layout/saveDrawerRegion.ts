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
 * @module save-drawer-region
 * @description This module provides a tool to update a drawer region's properties.
 * It implements the PUT /api/region/drawer/{id} endpoint of the Xibo CMS API.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

// Schema for region options
const regionOptionSchema = z.object({
  regionId: z.number(),
  option: z.string(),
  value: z.string()
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

// Schema for tags
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string()
});

// Schema for widget options
const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string(),
  option: z.string(),
  value: z.string()
});

// Schema for audio associated with a widget
const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number()
});

// Schema for a widget
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
  transitionIn: z.string().nullable(),
  transitionOut: z.string().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(widgetOptionSchema),
  mediaIds: z.array(z.number()),
  audio: z.array(audioSchema),
  permissions: z.array(permissionSchema),
  playlist: z.string().nullable()
});

// Schema for a region's playlist
const regionPlaylistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number(),
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
  permissionsFolderId: z.number().nullable()
});

// Main schema for a region
const regionSchema = z.object({
  regionId: z.number(),
  layoutId: z.number(),
  ownerId: z.number(),
  type: z.string(),
  name: z.string().nullable(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  left: z.number(),
  zIndex: z.number(),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema),
  permissions: z.array(permissionSchema),
  duration: z.number().nullable(),
  isDrawer: z.number(),
  regionPlaylist: regionPlaylistSchema.nullable()
});

/**
 * Tool to save/update a drawer region.
 * This tool implements the PUT region/drawer endpoint from the Xibo API to update
 * the dimensions of a specified drawer region.
 */
export const saveDrawerRegion = createTool({
  id: 'save-drawer-region',
  description: 'Save a drawer region',
  inputSchema: z.object({
    id: z.number().describe('The Drawer ID to save.'),
    width: z.number().optional().describe('The width of the drawer region.'),
    height: z.number().optional().describe('The height of the drawer region.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: regionSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("saveDrawerRegion: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      logger.info(`Saving drawer region ${context.id}`, {
        width: context.width,
        height: context.height
      });

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/region/drawer/${context.id}`;

      const formData = new URLSearchParams();
      if (context.width !== undefined) {
        formData.append('width', context.width.toString());
      }
      if (context.height !== undefined) {
        formData.append('height', context.height.toString());
      }

      logger.debug("saveDrawerRegion: Request details", {
        url,
        method: 'PUT',
        body: formData.toString()
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("saveDrawerRegion: API error response", {
          status: response.status,
          error: parsedError
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}`,
          errorData: parsedError
        };
      }

      const data = await response.json();
      const validatedData = regionSchema.parse(data);

      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("saveDrawerRegion: Validation error", { error: error.issues });
        return {
          success: false,
          message: "Validation error occurred",
          errorData: error.issues
        };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("saveDrawerRegion: An unexpected error occurred", { error: errorMessage });
      return {
        success: false,
        message: errorMessage
      };
    }
  },
});
