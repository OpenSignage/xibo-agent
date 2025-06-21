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
 * Xibo CMS Layout Region Editing Tool
 * 
 * This module provides functionality to edit an existing region within a layout
 * in the Xibo CMS system. It implements the PUT /api/region/{id} endpoint
 * to update a region's properties.
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
 * Schema for the region response from the API.
 */
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
 * Tool to edit an existing region in a layout.
 * Implements the PUT /api/region/{id} endpoint from the Xibo API.
 */
export const editRegion = createTool({
  id: 'edit-region',
  description: 'Edit an existing region in a layout',
  inputSchema: z.object({
    regionId: z.number().describe('The ID of the Region to edit'),
    name: z.string().optional().describe('The new name for the region'),
    width: z.number().optional().describe('The new width for the region'),
    height: z.number().optional().describe('The new height for the region'),
    top: z.number().optional().describe('The new top coordinate for the region'),
    left: z.number().optional().describe('The new left coordinate for the region'),
    zIndex: z.number().optional().describe('The Layer zIndex for this Region'),
    transitionType: z.string().optional().describe('The Transition Type. Must be a valid transition code as returned by /transition'),
    transitionDuration: z.number().optional().describe('The transition duration in milliseconds if required by the transition type'),
    transitionDirection: z.string().optional().describe('The transition direction if required by the transition type'),
    loop: z.number().describe('Flag indicating whether this region should loop if there is only 1 media item in the timeline')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
    data: regionSchema.optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    const { regionId, ...updateData } = context;
    logger.info(`Executing editRegion for region ID: ${regionId}`, { updateData });

    try {
      if (!config.cmsUrl) {
        const errorMsg = "CMS URL is not configured";
        logger.error(`editRegion: ${errorMsg}`);
        return { success: false, message: "Failed to edit region", error: errorMsg };
      }

      const authHeaders = await getAuthHeaders();
      const headers = new Headers(authHeaders);
      headers.set('Content-Type', 'application/x-www-form-urlencoded');

      const url = `${config.cmsUrl}/api/region/${regionId}`;

      // Build form data only with provided fields
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          formData.append(key, value.toString());
        }
      }

      logger.debug("editRegion: Sending PUT request", {
        url,
        body: formData.toString()
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: headers,
        body: formData
      });

      const responseText = await response.text();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(responseText);
        let errorData: any;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = responseText;
        }

        logger.error("editRegion: API error response", {
          status: response.status,
          error: errorMessage,
          errorData: errorData
        });

        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${errorMessage}`,
          error: errorMessage,
          errorData: errorData
        };
      }

      try {
        const data = JSON.parse(responseText);
        const validatedData = regionSchema.parse(data);

        logger.info(`editRegion: Successfully edited region with ID ${validatedData.regionId}`);

        return {
          success: true,
          message: "Successfully edited region.",
          data: validatedData
        };
      } catch (validationError) {
        const errorMessage = validationError instanceof Error ? validationError.message : "Response validation failed";
        logger.error(`editRegion: Failed to validate API response`, { error: validationError, response: responseText });
        return {
          success: false,
          message: "Response validation failed.",
          error: errorMessage,
          errorData: responseText
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`editRegion: An unexpected error occurred`, { error: errorMessage });
      return {
        success: false,
        message: "An unexpected error occurred while editing the region.",
        error: errorMessage
      };
    }
  },
});
