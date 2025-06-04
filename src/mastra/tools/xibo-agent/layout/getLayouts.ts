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
 * Layout Management Tool
 * This module provides functionality to retrieve and manage Xibo layouts
 * through the CMS API with comprehensive data validation
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';
import { parseJsonStrings } from '../utility/jsonParser';
import { 
  TreeNode, 
  treeResponseSchema, 
  generateTreeView, 
  flattenTree, 
  createTreeViewResponse 
} from "../utility/treeView";

// Schema definition for layout response validation
const layoutResponseSchema = z.array(z.object({
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  campaignId: z.union([z.number(), z.string().transform(Number)]),
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
  isLocked: z.union([z.boolean(), z.array(z.any())]).transform(val => Array.isArray(val) ? false : val),
  regions: z.array(z.object({
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
    regionOptions: z.array(z.object({
      regionId: z.union([z.number(), z.string().transform(Number)]),
      option: z.string().nullable(),
      value: z.string().nullable()
    })),
    permissions: z.array(z.object({
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
    })),
    duration: z.union([z.number(), z.string().transform(Number)]),
    isDrawer: z.union([z.number(), z.string().transform(Number)]),
    regionPlaylist: z.object({
      playlistId: z.union([z.number(), z.string().transform(Number)]),
      ownerId: z.union([z.number(), z.string().transform(Number)]),
      name: z.string().nullable(),
      regionId: z.union([z.number(), z.string().transform(Number)]),
      isDynamic: z.union([z.number(), z.string().transform(Number)]),
      filterMediaName: z.string().nullable(),
      filterMediaNameLogicalOperator: z.string().nullable(),
      filterMediaTags: z.string().nullable(),
      filterExactTags: z.union([z.number(), z.string().transform(Number)]),
      filterMediaTagsLogicalOperator: z.string().nullable(),
      filterFolderId: z.union([z.number(), z.string().transform(Number)]),
      maxNumberOfItems: z.union([z.number(), z.string().transform(Number)]),
      createdDt: z.string().nullable(),
      modifiedDt: z.string().nullable(),
      duration: z.union([z.number(), z.string().transform(Number)]),
      requiresDurationUpdate: z.union([z.number(), z.string().transform(Number)]),
      enableStat: z.string().nullable(),
      tags: z.array(z.object({
        tag: z.string().nullable(),
        tagId: z.union([z.number(), z.string().transform(Number)]),
        value: z.string().nullable()
      })),
      widgets: z.array(z.object({
        widgetId: z.union([z.number(), z.string().transform(Number)]),
        playlistId: z.union([z.number(), z.string().transform(Number)]),
        ownerId: z.union([z.number(), z.string().transform(Number)]),
        type: z.string().nullable(),
        duration: z.union([z.number(), z.string().transform(Number)]),
        displayOrder: z.union([z.number(), z.string().transform(Number)]),
        useDuration: z.union([z.number(), z.string().transform(Number)]),
        calculatedDuration: z.union([z.number(), z.string().transform(Number)]),
        createdDt: z.union([z.string(), z.number()]).nullable(),
        modifiedDt: z.union([z.string(), z.number()]).nullable(),
        fromDt: z.union([z.number(), z.string().transform(Number)]),
        toDt: z.union([z.number(), z.string().transform(Number)]),
        schemaVersion: z.union([z.number(), z.string().transform(Number)]),
        transitionIn: z.union([z.number(), z.string().transform(Number)]).nullable(),
        transitionOut: z.union([z.number(), z.string().transform(Number)]).nullable(),
        transitionDurationIn: z.union([z.number(), z.string().transform(Number)]).nullable(),
        transitionDurationOut: z.union([z.number(), z.string().transform(Number)]).nullable(),
        widgetOptions: z.array(z.object({
          widgetId: z.union([z.number(), z.string().transform(Number)]),
          type: z.string().nullable(),
          option: z.string().nullable(),
          value: z.union([z.string(), z.array(z.any()), z.record(z.any())]).nullable()
        })),
        mediaIds: z.array(z.union([z.number(), z.string().transform(Number)])),
        audio: z.array(z.object({
          widgetId: z.union([z.number(), z.string().transform(Number)]),
          mediaId: z.union([z.number(), z.string().transform(Number)]),
          volume: z.union([z.number(), z.string().transform(Number)]),
          loop: z.union([z.number(), z.string().transform(Number)])
        })),
        permissions: z.array(z.object({
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
        })),
        playlist: z.string().nullable()
      })),
      permissions: z.array(z.object({
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
      })),
      folderId: z.union([z.number(), z.string().transform(Number)]),
      permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
    }).nullable()
  })),
  tags: z.array(z.object({
    tag: z.string().nullable(),
    tagId: z.union([z.number(), z.string().transform(Number)]),
    value: z.string().nullable()
  })),
  folderId: z.union([z.number(), z.string().transform(Number)]),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
}));

/**
 * Convert layout data to tree structure
 * 
 * @param layouts Layout array from API
 * @returns Tree node array
 */
function buildLayoutTree(layouts: any[]): TreeNode[] {
  if (!Array.isArray(layouts)) {
    logger.warn('buildLayoutTree received non-array data:', { type: typeof layouts });
    return [];
  }
  
  return layouts.map(layout => {
    // Create layout node
    const layoutNode: TreeNode = {
      type: 'layout',
      id: layout.layoutId,
      name: layout.layout || `Layout ${layout.layoutId}`,
      children: []
    };
    
    // Add regions
    if (layout.regions && Array.isArray(layout.regions)) {
      layoutNode.children = layout.regions.map((region: any) => {
        const regionNode: TreeNode = {
          type: 'region',
          id: region.regionId,
          name: region.name || `Region ${region.regionId}`,
          children: []
        };
        
        // Add playlist
        if (region.regionPlaylist) {
          const playlist = region.regionPlaylist;
          const playlistNode: TreeNode = {
            type: 'playlist',
            id: playlist.playlistId,
            name: playlist.name || `Playlist ${playlist.playlistId}`,
            children: []
          };
          
          // Add widgets
          if (playlist.widgets && Array.isArray(playlist.widgets)) {
            playlistNode.children = playlist.widgets.map((widget: any) => {
              return {
                type: 'widget',
                id: widget.widgetId,
                name: `${widget.type || 'Widget'} (${widget.widgetId})`,
                duration: widget.duration
              };
            });
          }
          
          regionNode.children = [playlistNode];
        }
        
        return regionNode;
      });
    }
    
    // Add tags
    if (layout.tags && Array.isArray(layout.tags) && layout.tags.length > 0) {
      const tagsNode: TreeNode = {
        type: 'tags',
        id: 0,
        name: 'Tags',
        children: layout.tags.map((tag: any) => ({
          type: 'tag',
          id: tag.tagId,
          name: tag.tag || `Tag ${tag.tagId}`
        }))
      };
      
      layoutNode.children?.push(tagsNode);
    }
    
    return layoutNode;
  });
}

/**
 * Custom formatter for layout nodes
 * 
 * @param node Tree node
 * @returns Formatted display string
 */
function layoutNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'layout':
      return `Layout: ${node.name}`;
    case 'region':
      return `Region: ${node.name}`;
    case 'playlist':
      return `Playlist: ${node.name}`;
    case 'widget':
      return `${node.name}${node.duration ? ` (${node.duration}s)` : ''}`;
    default:
      return `${node.type}: ${node.name}`;
  }
}

/**
 * Tool for retrieving Xibo layouts with filtering options
 * 
 * Example usage with embed parameter:
 * ```
 * const layouts = await getLayouts.execute({
 *   context: {
 *     // Basic filtering
 *     layoutId: 123,
 *     // Include related data using embed parameter
 *     embed: "regions,playlists,widgets,tags"
 *     // OR as an array
 *     // embed: ["regions", "playlists", "widgets", "tags"]
 *     // Tree view option
 *     treeView: true
 *   }
 * });
 * ```
 */
export const getLayouts = createTool({
  id: 'get-layouts',
  description: 'Retrieves a list of Xibo layouts with optional filtering',
  inputSchema: z.object({
    layoutId: z.number().optional().describe('Filter by layout ID'),
    parentId: z.number().optional().describe('Filter by parent ID'),
    showDrafts: z.number().optional().describe('Show drafts (0-1)'),
    layout: z.string().optional().describe('Filter by layout name (partial match)'),
    userId: z.number().optional().describe('Filter by user ID'),
    retired: z.number().optional().describe('Filter by retired status (0-1)'),
    tags: z.string().optional().describe('Filter by tags'),
    exactTags: z.number().optional().describe('Use exact tag matching (0-1)'),
    logicalOperator: z.enum(['AND', 'OR']).optional().describe('Logical operator for multiple tags'),
    ownerUserGroupId: z.number().optional().describe('Filter by user group ID'),
    publishedStatusId: z.number().optional().describe('Filter by publish status (1: Published, 2: Draft)'),
    embed: z.union([
      z.string().describe('Include related data as comma-separated values (e.g. "regions,playlists,widgets,tags,campaigns,permissions")'),
      z.array(z.string()).describe('Include related data as array of values')
    ]).optional(),
    campaignId: z.number().optional().describe('Get layouts belonging to campaign ID'),
    folderId: z.number().optional().describe('Filter by folder ID'),
    treeView: z.boolean().optional().describe('Set to true to return layouts in tree structure')
  }),
  outputSchema: z.union([
    z.string(),
    treeResponseSchema,
    layoutResponseSchema
  ]),
  execute: async ({ context }) => {
    try {
      // Log the request with relevant filter criteria
      const logContext = { ...context };
      logger.info(`Retrieving layouts with filters`, logContext);
      
      if (!config.cmsUrl) {
        logger.error("CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          // Skip internal processing parameters from API request
          if (key === 'treeView') {
            return;
          }
          
          // Special handling for embed parameter
          if (key === 'embed') {
            // Format according to Xibo API specification
            let embedValue: string;
            
            if (Array.isArray(value)) {
              // Convert array to comma-separated string
              embedValue = value.join(',');
            } else {
              // Use string as is
              embedValue = value.toString();
            }
            
            queryParams.append(key, embedValue);
            logger.debug(`Using embed parameter: ${embedValue}`);
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });

      // Build URL
      let url = `${config.cmsUrl}/api/layout`;
      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }
      
      logger.debug(`Requesting layouts from: ${url}`);
      
      try {
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`Failed to retrieve layouts: ${errorText}`, {
            status: response.status,
            filters: logContext
          });
          return errorText;
        }

        // Parse CMS response data
        const data = await response.json();
        
        // Handle empty response (layout not found)
        if (Array.isArray(data) && data.length === 0) {
          const errorResponse = {
            success: false,
            error: 'Layout not found'
          };
          return errorResponse;
        }

        // JSON文字列をパース
        const parsedData = parseJsonStrings(data);
        
        // Generate hierarchical tree view if requested
        if (context.treeView) {
          const layoutTree = buildLayoutTree(parsedData);
          return createTreeViewResponse(parsedData, layoutTree, layoutNodeFormatter);
        }
        
        try {
          // Validate and return the response data
          if (Array.isArray(parsedData)) {
            layoutResponseSchema.parse(parsedData);
            return parsedData;
          } else {
            treeResponseSchema.parse(parsedData);
            return parsedData;
          }
        } catch (validationError) {
          // Handle validation errors
          // This occurs when the CMS response doesn't match our expected schema
          const errorResponse = {
            success: false,
            error: validationError instanceof Error ? validationError.message : 'Validation error'
          };
          logger.warn(`Layout data validation failed`, {
            error: validationError,
            dataSize: Array.isArray(parsedData) ? parsedData.length : 'unknown',
            dataPreview: Array.isArray(parsedData) && parsedData.length > 0 ? 
              { layoutId: parsedData[0].layoutId, type: typeof parsedData[0] } : 'No data'
          });
          return errorResponse;
        }
      } catch (error) {
        // Handle network or parsing errors
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorResponse = {
          success: false,
          error: errorMessage
        };
        logger.error(`Error fetching layouts: ${errorMessage}`, { error, url });
        return errorResponse;
      }
    } catch (error) {
      // Handle any other unexpected errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorResponse = {
        success: false,
        error: errorMessage
      };
      logger.error(`Error in getLayouts: ${errorMessage}`, { error });
      return errorResponse;
    }
  },
});