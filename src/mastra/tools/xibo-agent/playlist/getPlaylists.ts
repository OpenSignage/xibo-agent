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
import { parseJsonStrings } from '../utility/jsonParser';
import { TreeNode, createTreeViewResponse } from '../utility/treeView';
import { decodeErrorMessage } from "../utility/error";

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
 * Convert playlist data to a hierarchical tree structure.
 * @param playlists - Array of playlist objects from the API.
 * @returns An array of TreeNode objects representing the hierarchy.
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

    // Add permissions if available
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
 * @returns Formatted string representation of the node
 */
function playlistNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'playlist':
      return `📋 Playlist: ${node.name}`;
    case 'info':
      return `ℹ️ ${node.name}`;
    case 'widgets':
      return `🔧 ${node.name}`;
    case 'widget':
      return `└─ ${node.name}`;
    case 'widget-info':
      return `   ${node.name}`;
    case 'tags':
      return `🏷️ ${node.name}`;
    case 'tag':
      return `└─ ${node.name}`;
    case 'permissions':
      return `🔒 ${node.name}`;
    case 'permission':
      return `└─ ${node.name}`;
    case 'duration':
    case 'owner':
    case 'created':
    case 'modified':
      return `└─ ${node.name}`;
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
    folderId: z.number().optional().describe('Filter by folder ID'),
    treeView: z.boolean().optional().describe('Set to true to return playlists in tree structure')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
    data: z.union([
      z.array(playlistSchema),
      z.string() // For markdown tree view
    ]).optional()
  }),
  execute: async ({ context }) => {
    try {
      // Validate CMS URL configuration
      if (!config.cmsUrl) {
        logger.error("getPlaylists: CMS URL is not configured");
        return { success: false, message: "CMS URL is not configured" };
      }

      // Prepare request headers and parameters
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      // Add filter parameters if provided, skipping treeView
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && key !== 'treeView') {
          if (key === 'embed' && Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });
      
      // If treeView is enabled, ensure all necessary data is embedded
      if (context.treeView && !params.has('embed')) {
        params.append('embed', 'regions,widgets,permissions,tags');
      }
      
      // Construct and execute API request
      const url = `${config.cmsUrl}/api/playlist?${params.toString()}`;

      logger.debug("getPlaylists: Request details", {
        url,
        method: 'GET',
        headers,
        params: params.toString()
      });

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      // Handle error responses
      if (!response.ok) {
        const errorMessage = await decodeErrorMessage(await response.text());
        logger.error("getPlaylists: API error response", {
            status: response.status,
            error: errorMessage
        });
        return {
          success: false,
          message: `HTTP error! status: ${response.status}, message: ${errorMessage}`,
          error: errorMessage
        };
      }

      // Process successful response
      const data = await response.json();
      
      // Handle empty response
      if (Array.isArray(data) && data.length === 0) {
        return { success: true, data: [] };
      }

      const parsedData = parseJsonStrings(data);

      if (context.treeView) {
        logger.info(`Generating tree view for ${parsedData.length} playlists`);
        const playlistTree = buildPlaylistTree(parsedData);
        return createTreeViewResponse(parsedData, playlistTree, playlistNodeFormatter);
      }

      return {
        success: true,
        data: parsedData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in getPlaylists';
      logger.error('Error in getPlaylists', { error: errorMessage });
      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      };
    }
  },
}); 