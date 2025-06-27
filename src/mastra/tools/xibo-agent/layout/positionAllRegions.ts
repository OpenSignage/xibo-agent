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

// Schema for tags
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.union([z.number(), z.string().transform(Number)]),
  value: z.string().nullable()
});

// Schema for widget options
const widgetOptionSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string().nullable(),
  option: z.string().nullable(),
  value: z.union([z.string(), z.array(z.any()), z.record(z.any())]).nullable()
});

// Schema for audio associated with a widget
const audioSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  mediaId: z.union([z.number(), z.string().transform(Number)]),
  volume: z.union([z.number(), z.string().transform(Number)]),
  loop: z.union([z.number(), z.string().transform(Number)])
});

// Schema for a widget
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

// Schema for a region's playlist
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

// Main schema for a region
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
  duration: z.union([z.number(), z.string().transform(Number)]).optional(),
  isDrawer: z.union([z.number(), z.string().transform(Number)]),
  regionPlaylist: regionPlaylistSchema.optional()
});

// Schema for the layout response
const layoutSchema = z.object({
    layoutId: z.union([z.number(), z.string().transform(Number)]),
    ownerId: z.union([z.number(), z.string().transform(Number)]),
    campaignId: z.union([z.number(), z.string().transform(Number)]).nullable(),
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
