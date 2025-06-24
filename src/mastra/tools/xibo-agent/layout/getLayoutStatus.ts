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
 * Xibo CMS Layout Status Tool
 * 
 * This module provides functionality to retrieve the current status of a layout in the Xibo CMS system.
 * It implements the layout/status endpoint from Xibo API.
 * Provides detailed information about the layout's structure, publication state, and locking status.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { TreeNode, createTreeViewResponse } from "../utility/treeView";
import { logger } from '../../../index';

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.any();

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

/**
 * Permission schema
 */
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

/**
 * Tag schema
 */
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string()
});

/**
 * Region option schema
 */
const regionOptionSchema = z.object({
  regionId: z.number(),
  option: z.string(),
  value: z.string()
});

/**
 * Widget option schema
 */
const widgetOptionSchema = z.object({
  widgetId: z.number(),
  type: z.string(),
  option: z.string(),
  value: z.string()
});

/**
 * Audio schema
 */
const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number()
});

/**
 * Widget schema
 */
const widgetSchema = z.object({
  widgetId: z.number(),
  playlistId: z.number(),
  ownerId: z.number(),
  type: z.string(),
  duration: z.number(),
  displayOrder: z.number(),
  useDuration: z.number(),
  calculatedDuration: z.number().optional(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  fromDt: z.number().nullable(),
  toDt: z.number().nullable(),
  schemaVersion: z.number(),
  transitionIn: z.number().nullable(),
  transitionOut: z.number().nullable(),
  transitionDurationIn: z.number().nullable(),
  transitionDurationOut: z.number().nullable(),
  widgetOptions: z.array(widgetOptionSchema).optional(),
  mediaIds: z.array(z.number()).optional(),
  audio: z.array(audioSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  playlist: z.string().optional()
});

/**
 * Playlist schema
 */
const playlistSchema = z.object({
  playlistId: z.number(),
  ownerId: z.number(),
  name: z.string(),
  regionId: z.number().optional(),
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
  tags: z.array(tagSchema).optional(),
  widgets: z.array(widgetSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable()
});

/**
 * Region schema
 */
const regionSchema = z.object({
  regionId: z.number(),
  layoutId: z.number(),
  ownerId: z.number(),
  type: z.string().nullable(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  left: z.number(),
  zIndex: z.number(),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
  duration: z.number(),
  isDrawer: z.number().optional(),
  regionPlaylist: playlistSchema.optional()
});

/**
 * Schema for layout status response
 * Contains information about the layout's current status,
 * publication state, and locking information
 */
const layoutStatusSchema = z.object({
  layoutId: z.number(),
  ownerId: z.number(),
  campaignId: z.number(),
  parentId: z.number().nullable(),
  publishedStatusId: z.number(),
  publishedStatus: z.string(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.number().nullable(),
  schemaVersion: z.number(),
  layout: z.string(),
  description: z.string().nullable(),
  backgroundColor: z.string(),
  createdDt: z.string(),
  modifiedDt: z.string(),
  status: z.number(),
  retired: z.number(),
  backgroundzIndex: z.number(),
  width: z.number(),
  height: z.number(),
  orientation: z.string(),
  displayOrder: z.number().nullable(),
  duration: z.number(),
  statusMessage: z.string().nullable(),
  enableStat: z.number(),
  autoApplyTransitions: z.number(),
  code: z.string().nullable(),
  isLocked: z.union([z.boolean(), z.array(z.any())]),
  regions: z.array(z.any()),
  tags: z.array(z.any()),
  drawers: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional(),
  permissions: z.array(z.any()).optional(),
  campaigns: z.array(z.any()).optional(),
  owner: z.string().optional(),
  groupsWithPermissions: z.any().nullable(),
  folderId: z.number(),
  permissionsFolderId: z.number()
});

/**
 * Convert layout information to tree structure
 * Transforms the flat layout data into a hierarchical tree representation
 * 
 * @param layout Layout information from CMS
 * @returns Array of tree nodes representing the layout structure
 */
function buildLayoutTree(layout: any): TreeNode[] {
  if (!layout) {
    logger.warn('buildLayoutTree received null/undefined layout data');
    return [];
  }

  // Create layout as root node
  const rootNode: TreeNode = {
    id: layout.layoutId,
    name: layout.layout,
    type: 'layout',
    children: []
  };

  // Add regions as child nodes
  if (layout.regions && Array.isArray(layout.regions)) {
    rootNode.children = layout.regions.map((region: any) => {
      const regionNode: TreeNode = {
        id: region.regionId,
        name: region.name || `Region ${region.regionId}`,
        type: 'region',
        children: []
      };

      // Add playlist information if region has a playlist
      if (region.regionPlaylist) {
        const playlistNode: TreeNode = {
          id: region.regionPlaylist.playlistId,
          name: region.regionPlaylist.name,
          type: 'playlist',
          children: []
        };

        // Add widgets if playlist has widgets
        if (region.regionPlaylist.widgets && Array.isArray(region.regionPlaylist.widgets)) {
          playlistNode.children = region.regionPlaylist.widgets.map((widget: any) => ({
            id: widget.widgetId,
            name: widget.type,
            type: 'widget',
            duration: widget.duration
          }));
        }

        regionNode.children = [playlistNode];
      }

      return regionNode;
    });
  }

  // Add tags section if present
  if (layout.tags && Array.isArray(layout.tags) && layout.tags.length > 0) {
    const tagsNode: TreeNode = {
      id: 0,
      name: 'Tags',
      type: 'tags',
      children: layout.tags.map((tag: any) => ({
        id: tag.tagId,
        name: tag.tag,
        type: 'tag'
      }))
    };

    rootNode.children?.push(tagsNode);
  }

  // Add status information
  rootNode.publishedStatus = layout.publishedStatus;
  rootNode.dimensions = `${layout.width}×${layout.height}`;
  rootNode.duration = layout.duration;

  return [rootNode];
}

/**
 * Custom formatter for layout nodes
 * Formats each node type with appropriate display information
 * 
 * @param node Tree node to format
 * @returns Formatted display string for the node
 */
function layoutNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'layout':
      return `📄 Layout: ${node.name}`;
    case 'region':
      return `🖼️ Region: ${node.name}`;
    case 'playlist':
      return `📋 Playlist: ${node.name}`;
    case 'widget':
      return `🔧 Widget: ${node.name}`;
    case 'media':
      return `🖼️ Media: ${node.name}`;
    case 'tag':
      return `🏷️ Tag: ${node.name}`;
    default:
      return node.name;
  }
}

/**
 * Tool to get the current status of a layout
 * Implements the layout/status endpoint from Xibo API
 * Provides information about publication state, locking status, and more
 */
export const getLayoutStatus = createTool({
  id: 'get-layout-status',
  description: 'Get the current status of a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to check status for'),
    treeView: z.boolean().optional().describe('Whether to display the layout structure as a tree view')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`getLayoutStatus: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/status/${context.layoutId}`;

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to retrieve layout status. API responded with status ${response.status}.`;
      logger.error(errorMessage, {
        status: response.status,
        layoutId: context.layoutId,
        response: decodedText,
      });

      return {
        success: false,
        message: `${errorMessage} Message: ${decodedText}`,
        error: {
          statusCode: response.status,
          responseBody: decodedText,
        },
      };
    }

    const data = await response.json();

    try {
      const validatedData = layoutStatusSchema.parse(data);

      // Generate tree view if requested
      if (context.treeView) {
        const layoutTree = buildLayoutTree(validatedData);
        return createTreeViewResponse(
          validatedData,
          layoutTree,
          layoutNodeFormatter
        );
      }

      return {
        success: true,
        data: validatedData,
      };
    } catch (validationError) {
      const errorMessage = "Layout status data validation failed.";
      logger.error(errorMessage, {
        error:
          validationError instanceof Error
            ? validationError.message
            : "Unknown validation error",
        layoutId: context.layoutId,
        receivedData: data,
      });
      return {
        success: false,
        message: errorMessage,
        error: {
          validationError:
            validationError instanceof Error
              ? validationError.message
              : "Unknown validation error",
          receivedData: data,
        },
      };
    }
  },
}); 