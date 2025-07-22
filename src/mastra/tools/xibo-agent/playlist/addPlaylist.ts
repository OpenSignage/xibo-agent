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
 * @module add-playlist
 * @description This module provides functionality to add a new playlist to the Xibo CMS system.
 * It implements the POST /api/playlist endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../logger';

// Schema for tags that can be associated with a playlist
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
});

// Schema for individual widgets that can be part of a playlist
const widgetSchema = z.object({
  widgetId: z.number(),
  playlistId: z.number(),
  ownerId: z.number(),
  type: z.string().nullable(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  schemaVersion: z.number(),
  transitionIn: z.string().nullable(),
  transitionOut: z.string().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(z.any()),
  mediaIds: z.array(z.number()),
  audio: z.array(z.any()),
  permissions: z.array(z.any()),
  playlist: z.string().nullable(),
});

// Main schema for the playlist object as returned by the Xibo API after creation
const playlistSchema = z.object({
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
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  duration: z.number(),
  requiresDurationUpdate: z.number(),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema),
  widgets: z.array(widgetSchema),
  permissions: z.array(z.any()),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  statusMessage: z.union([z.string(), z.array(z.any())]).nullable().optional(),
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
    data: playlistSchema.optional(),
    message: z.string().optional(),
    errorData: z.any().optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("addPlaylist: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/playlist`;
      
      // Construct the request body from the provided context
      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
          if (value !== undefined) {
              params.append(key, String(value));
          }
      });

      logger.debug(`addPlaylist: Sending request to ${url}`, { params: params.toString() });

      // Send the POST request to create the playlist
      const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        // Handle non-successful API responses
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("addPlaylist: API error response", {
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
      
      // Validate the API response against the defined schema
      try {
        const validatedData = playlistSchema.parse(data);
        logger.info(`addPlaylist: Successfully added playlist with ID ${validatedData.playlistId}`);
        return {
          success: true,
          data: validatedData
        };
      } catch (validationError) {
        // Handle cases where the API response does not match the expected schema
        logger.error('addPlaylist: Response validation failed', { 
          error: validationError, 
          data 
        });
        return { 
          success: false, 
          message: 'Response validation failed', 
          errorData: validationError instanceof Error ? validationError.message : String(validationError)
        };
      }
    } catch (error) {
      // Catch-all for input validation errors or other unexpected issues
      if (error instanceof z.ZodError) {
        logger.error("addPlaylist: Validation error", { error: error.issues });
        return {
          success: false,
          message: "Validation error occurred",
          errorData: error.issues
        };
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in addPlaylist';
      logger.error('Error in addPlaylist', { error: errorMessage });
      return {
        success: false,
        message: errorMessage
      };
    }
  },
}); 