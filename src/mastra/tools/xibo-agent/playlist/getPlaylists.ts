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
 * @module get-playlists
 * @description This module provides functionality to retrieve and search playlists from the Xibo CMS system.
 * It implements the GET /api/playlist endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../logger';
import { parseJsonStrings } from '../utility/jsonParser';
import { TreeNode, treeResponseSchema, createTreeViewResponse } from '../utility/treeView';

// Schema for tags associated with a playlist
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.number(),
  value: z.string().nullable(),
});

// Schema for widgets within a playlist
const widgetSchema = z.object({
  widgetId: z.number(),
  playlistId: z.number(),
  ownerId: z.number(),
  type: z.string().nullable(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number(),
  createdDt: z.number().nullable(),
  modifiedDt: z.number().nullable(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  schemaVersion: z.number(),
  transitionIn: z.string().nullable(),
  transitionOut: z.string().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(z.any()), // Can be more specific if needed
  mediaIds: z.array(z.number()),
  audio: z.array(z.any()), // Can be more specific if needed
  permissions: z.array(z.any()), // Can be more specific if needed
  playlist: z.string().nullable(),
});

// Main schema for a single playlist object
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
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.number(),
  requiresDurationUpdate: z.number(),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema),
  widgets: z.array(widgetSchema),
  permissions: z.array(z.any()), // Can be more specific if needed
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
  // Handling cases where statusMessage can be a string or an array
  statusMessage: z.union([z.string(), z.array(z.any())]).nullable().optional(),
});

/**
 * Recursively builds a hierarchical tree structure from a flat array of playlists.
 * @param playlists - Array of playlist objects from the API.
 * @returns An array of TreeNode objects representing the playlist hierarchy.
 */
function buildPlaylistTree(playlists: any[]): TreeNode[] {
  if (!Array.isArray(playlists)) return [];
  return playlists.map(playlist => {
    const playlistNode: TreeNode = {
      type: 'playlist',
      id: playlist.playlistId,
      name: playlist.name || `Playlist ${playlist.playlistId}`,
      children: []
    };
    
    // Add basic information as children
    const infoNode: TreeNode = {
      type: 'info',
      id: -playlist.playlistId,
      name: 'Information',
      children: [
        {
          type: 'duration',
          id: -playlist.playlistId * 10 - 1,
          name: `Duration: ${playlist.duration || 0} seconds`
        },
        {
          type: 'owner',
          id: -playlist.playlistId * 10 - 2,
          name: `Owner ID: ${playlist.ownerId}`
        }
      ]
    };

    if (playlist.createdDt) {
      infoNode.children!.push({
        type: 'created',
        id: -playlist.playlistId * 10 - 3,
        name: `Created: ${playlist.createdDt}`
      });
    }

    if (playlist.modifiedDt) {
      infoNode.children!.push({
        type: 'modified',
        id: -playlist.playlistId * 10 - 4,
        name: `Modified: ${playlist.modifiedDt}`
      });
    }

    playlistNode.children!.push(infoNode);
    
    // Add widgets as children
    if (playlist.widgets && Array.isArray(playlist.widgets) && playlist.widgets.length > 0) {
      const widgetsNode: TreeNode = {
        type: 'widgets',
        id: -playlist.playlistId * 100,
        name: 'Widgets',
        children: playlist.widgets.map((widget: any, index: number) => ({
          type: 'widget',
          id: widget.widgetId,
          name: `${widget.type || 'Widget'} (ID: ${widget.widgetId})`,
          children: [
            {
              type: 'widget-info',
              id: widget.widgetId * 10 + 1,
              name: `Duration: ${widget.duration || 0}s, Order: ${widget.displayOrder || index + 1}`
            }
          ]
        }))
      };
      playlistNode.children!.push(widgetsNode);
    }

    // Add tags as children
    if (playlist.tags && Array.isArray(playlist.tags) && playlist.tags.length > 0) {
      const tagsNode: TreeNode = {
        type: 'tags',
        id: -playlist.playlistId * 1000,
        name: 'Tags',
        children: playlist.tags.map((tag: any) => ({
          type: 'tag',
          id: tag.tagId,
          name: tag.tag || `Tag ${tag.tagId}`
        }))
      };
      playlistNode.children!.push(tagsNode);
    }

    // Add permissions information if available in the embedded data
    if (playlist.permissions && Array.isArray(playlist.permissions) && playlist.permissions.length > 0) {
      const permissionsNode: TreeNode = {
        type: 'permissions',
        id: -playlist.playlistId * 10000,
        name: 'Permissions',
        children: playlist.permissions.map((perm: any) => ({
          type: 'permission',
          id: perm.groupId,
          name: `Group ${perm.groupId}: View(${perm.view}) Edit(${perm.edit}) Delete(${perm.delete})`
        }))
      };
      playlistNode.children!.push(permissionsNode);
    }

    return playlistNode;
  });
}

/**
 * Format node display based on node type
 * @param node - The tree node to format
 * @returns A formatted string representation of the node for display.
 */
function playlistNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'playlist':
      return `📋 Playlist: ${node.name}`;
    case 'info':
      return `ℹ️ ${node.name}`;
    case 'widgets':
      return `🔧 ${node.name}`;
    case 'tags':
      return `🏷️ ${node.name}`;
    case 'permissions':
      return `🔒 ${node.name}`;
    case 'widget':
    case 'tag':
    case 'permission':
    case 'duration':
    case 'owner':
    case 'created':
    case 'modified':
      return node.name;
    case 'widget-info':
      return node.name;
    default:
      return node.name;
  }
}

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
    playlistId: z.number().optional().describe('Filter by playlist ID.'),
    name: z.string().optional().describe('Filter by playlist name (partial match).'),
    userId: z.number().optional().describe('Filter by user ID.'),
    tags: z.string().optional().describe('Filter by a comma-separated list of tags.'),
    exactTags: z.number().optional().describe('Set to 1 for an exact tag match.'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('Logical operator for tag filtering (AND/OR).'),
    ownerUserGroupId: z.number().optional().describe('Filter by user group ID.'),
    embed: z.union([
      z.string().describe('Include related data as comma-separated values (e.g., "widgets,permissions,tags").'),
      z.array(z.string()).describe('Include related data as an array of values.')
    ]).optional().default('regions,widgets,permissions,tags'),
    folderId: z.number().optional().describe('Filter by folder ID.'),
    treeView: z.boolean().optional().describe('Set to true to return playlists in a tree structure.')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.union([z.array(playlistSchema), treeResponseSchema]).optional(),
    message: z.string().optional(),
    errorData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const logContext = { ...context };
      logger.info(`Retrieving playlists with filters`, logContext);
      
      if (!config.cmsUrl) {
        logger.error("getPlaylists: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      const headers = await getAuthHeaders();
      
      // Dynamically construct query parameters from the input context
      const queryParams = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          // Exclude treeView from query params as it's a client-side flag
          if (key === 'treeView') return;
          
          // Convert array values to comma-separated strings for the API
          const paramValue = Array.isArray(value) ? value.join(',') : String(value);
          queryParams.append(key, paramValue);
          if (key === 'embed') {
            logger.debug(`Using embed parameter: ${paramValue}`);
          }
        }
      });
      
      let url = `${config.cmsUrl}/api/playlist`;
      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }
      
      logger.debug(`Requesting playlists from: ${url}`);
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const responseText = await response.text();
        let parsedError: any;
        try {
            parsedError = JSON.parse(responseText);
        } catch (e) {
            parsedError = responseText;
        }
        logger.error("getPlaylists: API error response", { status: response.status, error: parsedError });
        return { success: false, message: `HTTP error! status: ${response.status}`, errorData: parsedError };
      }

      const data = await response.json();
      
      // Return early with an empty array if the API provides no data
      if (Array.isArray(data) && data.length === 0) {
        return { success: true, data: [] };
      }

      // The API may return JSON strings within the data, so parse them
      const parsedData = parseJsonStrings(data);
      
      // If treeView is requested, transform the flat list into a hierarchical structure
      if (context.treeView) {
        const playlistTree = buildPlaylistTree(parsedData);
        const treeViewData = createTreeViewResponse(parsedData, playlistTree, playlistNodeFormatter);
        return { success: true, data: treeViewData };
      }
      
      // Validate the final data against the playlist schema before returning
      try {
        const validatedData = z.array(playlistSchema).parse(parsedData);
        return { success: true, data: validatedData };
      } catch (validationError) {
        logger.warn(`Playlist data validation failed`, {
          error: validationError,
          dataSize: Array.isArray(parsedData) ? parsedData.length : 'unknown',
          dataPreview: Array.isArray(parsedData) && parsedData.length > 0 ? { playlistId: parsedData[0].playlistId } : 'No data'
        });
        return {
          success: false,
          message: "Playlist data validation failed",
          errorData: validationError instanceof Error ? validationError.message : String(validationError)
        };
      }
    } catch (error) {
      // Catch-all for unexpected errors during execution
      if (error instanceof z.ZodError) {
        logger.error("getPlaylists: Input validation error", { error: error.issues });
        return { success: false, message: "Input validation error occurred", errorData: error.issues };
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in getPlaylists: ${errorMessage}`, { error });
      return { success: false, message: errorMessage };
    }
  },
}); 