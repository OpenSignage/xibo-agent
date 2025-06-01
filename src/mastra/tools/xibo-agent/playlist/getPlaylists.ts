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
 * Xibo CMS Playlist Management Tool
 * 
 * This module provides functionality to retrieve and search playlists from the Xibo CMS system.
 * It implements the playlist API endpoint and handles the necessary validation
 * and data transformation for playlist operations.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';

/**
 * Schema for playlist data validation
 * Defines the structure and validation rules for playlist data in the Xibo CMS system
 */
const playlistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number().optional(),
  isDynamic: z.number(),
  filterMediaName: z.string().optional(),
  filterMediaNameLogicalOperator: z.string().optional(),
  filterMediaTags: z.string().optional(),
  filterExactTags: z.number().optional(),
  filterMediaTagsLogicalOperator: z.string().optional(),
  filterFolderId: z.number().optional(),
  maxNumberOfItems: z.number().optional(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.number().optional(),
  requiresDurationUpdate: z.number().optional(),
  enableStat: z.string().optional(),
  tags: z.array(z.object({
    tagId: z.number(),
    tag: z.string()
  })).optional(),
  widgets: z.array(z.object({
    widgetId: z.number(),
    type: z.string(),
    duration: z.number().optional(),
    useDuration: z.number().optional(),
    displayOrder: z.number().optional()
  })).optional(),
  permissions: z.array(z.object({
    groupId: z.number(),
    view: z.number(),
    edit: z.number(),
    delete: z.number()
  })).optional(),
  folderId: z.number().optional(),
  permissionsFolderId: z.number().optional()
});

/**
 * Tool for retrieving and searching playlists from Xibo CMS
 * 
 * This tool provides functionality to:
 * - Search playlists by various criteria (ID, name, user, tags, etc.)
 * - Filter playlists based on user permissions
 * - Include related data through embedding options
 * - Handle playlist data validation and transformation
 */
export const getPlaylists = createTool({
  id: 'get-playlists',
  description: 'Search and retrieve playlists from Xibo CMS',
  inputSchema: z.object({
    playlistId: z.number().optional().describe('Filter by playlist ID'),
    name: z.string().optional().describe('Filter by playlist name (partial match)'),
    userId: z.number().optional().describe('Filter by user ID'),
    tags: z.string().optional().describe('Filter by tags'),
    exactTags: z.number().optional().describe('Exact tag match flag'),
    logicalOperator: z.string().optional().describe('Logical operator for multiple tags (AND|OR)'),
    ownerUserGroupId: z.number().optional().describe('Filter by user group ID'),
    embed: z.union([
      z.string().describe('Include related data as comma-separated values (e.g. "regions,widgets,permissions,tags"). If not specified, these detailed information will not be included in the response.'),
      z.array(z.string()).describe('Include related data as array of values')
    ]).optional(),
    folderId: z.number().optional().describe('Filter by folder ID')
  }),
  outputSchema: z.array(playlistSchema),
  execute: async ({ context }) => {
    try {
      // Validate CMS URL configuration
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      // Prepare request headers and parameters
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      // Add filter parameters if provided
      if (context.playlistId) params.append('playlistId', context.playlistId.toString());
      if (context.name) params.append('name', context.name);
      if (context.userId) params.append('userId', context.userId.toString());
      if (context.tags) params.append('tags', context.tags);
      if (context.exactTags) params.append('exactTags', context.exactTags.toString());
      if (context.logicalOperator) params.append('logicalOperator', context.logicalOperator);
      if (context.ownerUserGroupId) params.append('ownerUserGroupId', context.ownerUserGroupId.toString());
      if (context.embed) params.append('embed', context.embed.toString());
      if (context.folderId) params.append('folderId', context.folderId.toString());

      // Construct and execute API request
      const url = `${config.cmsUrl}/api/playlist?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      // Handle error responses
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to retrieve playlists', {
          status: response.status,
          error: errorText
        });
        return errorText;
      }

      // Process successful response
      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Error in getPlaylists', { error });
      return error instanceof Error ? error.message : 'Unknown error';
    }
  },
}); 