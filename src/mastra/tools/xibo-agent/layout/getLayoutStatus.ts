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
import { logger } from '../../../logger';

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

/**
 * Tag schema
 */
const tagSchema = z.object({
  tag: z.string().nullable(),
  tagId: z.union([z.number(), z.string().transform(Number)]),
  value: z.string().nullable()
});

/**
 * Region option schema
 */
const regionOptionSchema = z.object({
  regionId: z.union([z.number(), z.string().transform(Number)]),
  option: z.string().nullable(),
  value: z.string().nullable()
});

/**
 * Widget option schema
 */
const widgetOptionSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string().nullable(),
  option: z.string().nullable(),
  value: z.union([z.string(), z.array(z.any()), z.record(z.any())]).nullable()
});

/**
 * Audio schema
 */
const audioSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  mediaId: z.union([z.number(), z.string().transform(Number)]),
  volume: z.union([z.number(), z.string().transform(Number)]),
  loop: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Widget schema
 */
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

/**
 * Playlist schema
 */
const playlistSchema = z.object({
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

/**
 * Region schema
 */
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
  duration: z.union([z.number(), z.string().transform(Number)]),
  isDrawer: z.union([z.number(), z.string().transform(Number)]).optional(),
  regionPlaylist: playlistSchema.optional()
});

/**
 * Schema for layout status response
 * Contains information about the layout's current status,
 * publication state, and locking information
 */
const layoutStatusSchema = z.object({
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
  drawers: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional(),
  permissions: z.array(permissionSchema).optional(),
  campaigns: z.array(z.any()).optional(),
  owner: z.string().nullable(),
  groupsWithPermissions: z.any().nullable(),
  folderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)]).nullable()
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