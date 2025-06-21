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
 * @module position-all-regions
 * @description This module provides a tool to automatically position specified regions within a layout.
 * It implements the PUT /api/layout/position/{id} endpoint of the Xibo CMS API.
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

// Schema for the layout response
const layoutSchema = z.object({
    layoutId: z.number(),
    ownerId: z.number(),
    campaignId: z.number().nullable(),
    parentId: z.number().nullable(),
    publishedStatusId: z.number(),
    publishedStatus: z.string(),
    publishedDate: z.string().nullable(),
    backgroundImageId: z.number(),
    schemaVersion: z.number(),
    layout: z.string(),
    description: z.string(),
    backgroundColor: z.string(),
    createdDt: z.string(),
    modifiedDt: z.string(),
    status: z.number(),
    retired: z.number(),
    backgroundzIndex: z.number(),
    width: z.number(),
    height: z.number(),
    orientation: z.string(),
    displayOrder: z.number(),
    duration: z.number(),
    statusMessage: z.string().nullable(),
    enableStat: z.number(),
    autoApplyTransitions: z.number(),
    code: z.string().nullable(),
    isLocked: z.boolean(),
    regions: z.array(regionSchema),
    tags: z.array(tagSchema),
    folderId: z.number().nullable(),
    permissionsFolderId: z.number().nullable()
});

// Schema for a single region's position data
const regionPositionSchema = z.object({
  regionId: z.number(),
  top: z.number(),
  left: z.number(),
  width: z.number(),
  height: z.number(),
  zIndex: z.number()
});

/**
 * Tool to position specified regions in a layout.
 * This tool triggers the positioning of specified regions for a given layout
 * in the Xibo CMS.
 */
export const positionAllRegions = createTool({
  id: 'position-all-regions',
  description: 'Position specified regions in a layout',
  inputSchema: z.object({
    id: z.number().describe('The Layout ID to position regions in.'),
    regions: z.array(z.string()).describe('An array of JSON strings, each representing a region to position.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: layoutSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("positionAllRegions: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      logger.info(`Positioning regions in layout ${context.id}`);

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/position/${context.id}`;

      const formData = new URLSearchParams();
      for (const [index, regionString] of context.regions.entries()) {
        try {
          const region = regionPositionSchema.parse(JSON.parse(regionString));
          Object.entries(region).forEach(([key, value]) => {
            formData.append(`regions[${index}][${key}]`, String(value));
          });
        } catch (e) {
          const errorMessage = `Invalid region data at index ${index}. Must be a valid JSON string conforming to the schema.`;
          logger.error(errorMessage, { regionString, error: e });
          return { success: false, message: errorMessage };
        }
      }

      logger.debug("positionAllRegions: Request details", {
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
        logger.error("positionAllRegions: API error response", {
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
      const validatedData = layoutSchema.parse(data);

      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("positionAllRegions: Validation error", { error: error.issues });
        return {
          success: false,
          message: "Validation error occurred",
          errorData: error.issues
        };
      }
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("positionAllRegions: An unexpected error occurred", { error: errorMessage });
      return {
        success: false,
        message: errorMessage
      };
    }
  },
});
