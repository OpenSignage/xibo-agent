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
    statusMessage: z.union([z.string(), z.array(z.any())]).nullable(),
    enableStat: z.union([z.number(), z.string().transform(Number)]).nullable(),
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
 * Tool to position specified regions in a layout.
 * This tool triggers the positioning of specified regions for a given layout
 * in the Xibo CMS.
 */
export const positionAllRegions = createTool({
  id: 'position-all-regions',
  description: 'Position specified regions in a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('The Layout ID to position regions in.'),
    regions: z.array(z.string()).describe('An array of comma-separated strings, each representing a region to position. The order must be: regionId,top,left,width,height,zIndex.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: layoutSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      // Ensure the CMS URL is configured before proceeding
      if (!config.cmsUrl) {
        logger.error("positionAllRegions: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Retrieve authentication headers and construct the API endpoint URL
      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/region/position/all/${context.layoutId}`;

      // Prepare form data for the request.
      // The API expects a single 'regions' parameter containing a JSON-encoded string of region data.
      const formData = new URLSearchParams();
      try {
        const regionsArray = context.regions.map(regionString => {
          const parts = regionString.split(',');
          if (parts.length !== 6) {
            throw new Error('Each region string must contain 6 comma-separated values in the order: regionId,top,left,width,height,zIndex');
          }
          // The CMS expects lowercase property names for all fields except for 'zIndex', which must be camelCase.
          // This is due to an inconsistency in the CMS backend code.
          return {
            regionid: parseInt(parts[0], 10),
            top: parseInt(parts[1], 10),
            left: parseInt(parts[2], 10),
            width: parseInt(parts[3], 10),
            height: parseInt(parts[4], 10),
            zIndex: parseInt(parts[5], 10),
          };
        });
        
        // The entire array of region objects is stringified and appended as a single 'regions' parameter.
        formData.append('regions', JSON.stringify(regionsArray));
      } catch (e) {
        const errorMessage = `Invalid region data. ${e instanceof Error ? e.message : 'Unknown error'}`;
        logger.error(errorMessage, { regions: context.regions, error: e });
        return { success: false, message: errorMessage };
      }

      // Perform the PUT request to the Xibo API
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      // Handle non-successful API responses
      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            // Try to parse the error response as JSON
            parsedError = JSON.parse(responseText);
        } catch (e) {
            // Fallback to the raw text if parsing fails
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

      // Parse the successful JSON response and validate it against the layout schema
      const data = await response.json();
      const validatedData = layoutSchema.parse(data);

      // Return a successful response with the validated data
      return {
        success: true,
        data: validatedData
      };
    } catch (error) {
      // Handle Zod validation errors specifically for detailed logging
      if (error instanceof z.ZodError) {
        logger.error("positionAllRegions: Validation error", { error: error.issues });
        return {
          success: false,
          message: "Validation error occurred",
          errorData: error.issues
        };
      }
      // Handle any other unexpected errors
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error("positionAllRegions: An unexpected error occurred", { error: errorMessage });
      return {
        success: false,
        message: errorMessage
      };
    }
  },
});
