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
 * Xibo CMS Layout Update Tool
 * 
 * This module provides functionality to update layout information in the Xibo CMS system.
 * It implements the layout/{id} PUT endpoint from Xibo API and supports tree view visualization
 * of the layout structure with regions and widgets.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { TreeNode, createTreeViewResponse } from "../utility/treeView";
import { logger } from '../../../index';

/**
 * Schema for region options
 * Defines the configuration options specific to a region
 */
const regionOptionSchema = z.object({
  regionId: z.union([z.number(), z.string().transform(Number)]),
  option: z.string(),
  value: z.string()
});

/**
 * Schema for permissions
 * Defines the access control entries for layout elements
 */
const permissionSchema = z.object({
  permissionId: z.union([z.number(), z.string().transform(Number)]),
  entityId: z.union([z.number(), z.string().transform(Number)]),
  groupId: z.union([z.number(), z.string().transform(Number)]),
  objectId: z.union([z.number(), z.string().transform(Number)]),
  isUser: z.union([z.number(), z.string().transform(Number)]),
  entity: z.string(),
  objectIdString: z.string(),
  group: z.string(),
  view: z.union([z.number(), z.string().transform(Number)]),
  edit: z.union([z.number(), z.string().transform(Number)]),
  delete: z.union([z.number(), z.string().transform(Number)]),
  modifyPermissions: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Schema for widget options
 * Defines the configuration options specific to a widget
 */
const widgetOptionSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string(),
  option: z.string(),
  value: z.string()
});

/**
 * Schema for audio objects
 * Defines audio settings associated with widgets
 */
const audioSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  mediaId: z.union([z.number(), z.string().transform(Number)]),
  volume: z.union([z.number(), z.string().transform(Number)]),
  loop: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Schema for widgets
 * Defines the media content items placed within regions
 */
const widgetSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  playlistId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  displayOrder: z.union([z.number(), z.string().transform(Number)]),
  useDuration: z.union([z.number(), z.string().transform(Number)]),
  calculatedDuration: z.union([z.number(), z.string().transform(Number)]),
  createdDt: z.string(),
  modifiedDt: z.string(),
  fromDt: z.union([z.number(), z.string().transform(Number)]),
  toDt: z.union([z.number(), z.string().transform(Number)]),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  transitionIn: z.union([z.number(), z.string().transform(Number)]),
  transitionOut: z.union([z.number(), z.string().transform(Number)]),
  transitionDurationIn: z.union([z.number(), z.string().transform(Number)]),
  transitionDurationOut: z.union([z.number(), z.string().transform(Number)]),
  widgetOptions: z.array(widgetOptionSchema),
  mediaIds: z.array(z.union([z.number(), z.string().transform(Number)])),
  audio: z.array(audioSchema),
  permissions: z.array(permissionSchema),
  playlist: z.string().nullable()
}).nullable();

/**
 * Schema for tags
 * Defines metadata tags that can be applied to layouts
 */
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.union([z.number(), z.string().transform(Number)]),
  value: z.string()
});

/**
 * Schema for playlists
 * Defines collections of widgets that play in sequence within a region
 */
const playlistSchema = z.object({
  playlistId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  name: z.string(),
  regionId: z.union([z.number(), z.string().transform(Number)]),
  isDynamic: z.union([z.number(), z.string().transform(Number)]),
  filterMediaName: z.string().nullable(),
  filterMediaNameLogicalOperator: z.string().nullable(),
  filterMediaTags: z.string().nullable(),
  filterExactTags: z.union([z.number(), z.string().transform(Number)]),
  filterMediaTagsLogicalOperator: z.string().nullable(),
  filterFolderId: z.union([z.number(), z.string().transform(Number)]),
  maxNumberOfItems: z.union([z.number(), z.string().transform(Number)]),
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  requiresDurationUpdate: z.union([z.number(), z.string().transform(Number)]),
  enableStat: z.string().nullable(),
  tags: z.array(tagSchema),
  widgets: z.array(widgetSchema.nullish()),
  permissions: z.array(permissionSchema),
  folderId: z.union([z.number(), z.string().transform(Number)]),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Schema for regions
 * Defines the display areas within a layout where content can be placed
 */
const regionSchema = z.object({
  regionId: z.union([z.number(), z.string().transform(Number)]),
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string().nullable(),
  name: z.string(),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  top: z.union([z.number(), z.string().transform(Number)]),
  left: z.union([z.number(), z.string().transform(Number)]),
  zIndex: z.union([z.number(), z.string().transform(Number)]),
  syncKey: z.string().nullable(),
  regionOptions: z.array(regionOptionSchema),
  permissions: z.array(permissionSchema),
  duration: z.union([z.number(), z.string().transform(Number)]),
  isDrawer: z.union([z.number(), z.string().transform(Number)]),
  regionPlaylist: playlistSchema
});

/**
 * Response schema for layout objects
 * Based on Xibo API documentation
 * Defines the complete structure of a layout with all its components
 */
const layoutResponseSchema = z.object({
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
  isLocked: z.any().transform(v => v === true),
  regions: z.array(regionSchema).optional(),
  tags: z.array(tagSchema).optional(),
  folderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)]).nullable()
});

/**
 * Converts a layout object to a tree structure for visualization
 * 
 * @param layout Layout object retrieved from Xibo CMS API
 * @returns Tree structure representing the layout and its components
 */
export function layoutToTree(layout: any): TreeNode[] {
  // Create the root node representing the layout
  const rootNode: TreeNode = {
    id: layout.layoutId,
    name: layout.layout || `Layout ${layout.layoutId}`,
    type: 'layout',
    width: layout.width,
    height: layout.height,
    backgroundColor: layout.backgroundColor,
    orientation: layout.orientation,
    duration: layout.duration,
    children: []
  };

  // Add regions if they exist
  if (layout.regions && Array.isArray(layout.regions)) {
    rootNode.children = layout.regions.map((region: any) => {
      const regionNode: TreeNode = {
        id: region.regionId,
        name: region.name || `Region ${region.regionId}`,
        type: 'region',
        width: region.width,
        height: region.height,
        top: region.top,
        left: region.left,
        zIndex: region.zIndex,
        duration: region.duration,
        children: []
      };

      // Add widgets from the region's playlist if they exist
      if (region.regionPlaylist && region.regionPlaylist.widgets && Array.isArray(region.regionPlaylist.widgets)) {
        regionNode.children = region.regionPlaylist.widgets
          .filter((widget: any) => widget !== null) // Filter out null values
          .map((widget: any) => {
            return {
              id: widget.widgetId,
              name: widget.type || `Widget ${widget.widgetId}`,
              type: 'widget',
              duration: widget.duration,
              displayOrder: widget.displayOrder
            };
          });
      }

      return regionNode;
    });
  }

  return [rootNode];
}

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
 * Tool to update an existing layout
 * Implements the layout/{id} PUT endpoint from Xibo API
 * Allows updating various properties of a layout and supports tree view visualization
 */
export const editLayout = createTool({
  id: 'edit-layout',
  description: 'Update an existing layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to update'),
    name: z.string().describe('Layout name'),
    description: z.string().optional().describe('Layout description'),
    tags: z.string().optional().describe('A comma separated list of Tags'),
    retired: z.number().optional().describe('Flag indicating whether this Layout is retired (0-1)'),
    enableStat: z.number().optional().describe('Flag indicating whether the Layout stat is enabled (0-1)'),
    code: z.string().optional().describe('Layout identification code'),
    folderId: z.number().optional().describe('Folder ID to which this object should be assigned to'),
    includeTree: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include the layout structure as a tree view"),
  }),

  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`editLayout: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }

    logger.info(
      `Updating layout ${context.layoutId} with parameters: ${JSON.stringify({
        name: context.name,
        description: context.description,
        tags: context.tags,
        retired: context.retired,
        enableStat: context.enableStat,
        code: context.code,
        folderId: context.folderId,
      })}`
    );

    const headers = await getAuthHeaders();

    // Build form data
    const formData = new URLSearchParams();
    formData.append("name", context.name);
    if (context.description) formData.append("description", context.description);
    if (context.tags) formData.append("tags", context.tags);
    if (context.retired !== undefined)
      formData.append("retired", context.retired.toString());
    if (context.enableStat !== undefined)
      formData.append("enableStat", context.enableStat.toString());
    if (context.code) formData.append("code", context.code);
    if (context.folderId)
      formData.append("folderId", context.folderId.toString());

    const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;

    // Send the update request
    logger.debug(`Sending PUT request to ${url}`);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    // Handle error response
    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to update layout. API responded with status ${response.status}.`;
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

    // Parse and validate the response
    let validatedData;
    try {
      const data = await response.json();
      validatedData = layoutResponseSchema.parse(data);
      logger.info(`Successfully updated layout ${context.layoutId}`);
    } catch (validationError) {
      const errorMessage = "Response data validation failed after update.";
      logger.error(errorMessage, {
        error:
          validationError instanceof Error
            ? validationError.message
            : "Unknown validation error",
        layoutId: context.layoutId,
      });
      return {
        success: false,
        message: errorMessage,
        error:
          validationError instanceof Error
            ? validationError.message
            : "Unknown validation error",
      };
    }

    // Generate tree view if requested
    if (context.includeTree) {
      logger.info(`Generating tree view for layout ${context.layoutId}`);

      // Fetch detailed layout data including regions and widgets
      const detailUrl = `${config.cmsUrl}/api/layout/${context.layoutId}?embed=regions,playlists,widgets`;
      logger.debug(`Fetching detailed layout data from ${detailUrl}`);

      const detailResponse = await fetch(detailUrl, {
        method: "GET",
        headers: headers,
      });

      if (!detailResponse.ok) {
        const responseText = await detailResponse.text();
        const errorMessage = `Failed to fetch detailed layout data for tree view: ${decodeErrorMessage(responseText)}`;
        logger.warn(errorMessage, {
          statusCode: detailResponse.status,
        });
        // Return basic layout data without tree view as a fallback
        return {
          success: true,
          message:
            "Layout updated, but failed to fetch details for tree view.",
          data: validatedData,
          warning: errorMessage,
        };
      }

      const detailData = await detailResponse.json();

      // Convert layout to tree structure
      const layoutTree = layoutToTree(detailData);
      logger.debug(
        `Generated tree structure with ${
          layoutTree[0].children?.length || 0
        } regions`
      );

      // Create tree view response with visual formatting
      const treeResponse = createTreeViewResponse(
        validatedData,
        layoutTree,
        (node) => {
          let displayText = `${node.name}`;

          if (node.type === "layout") {
            displayText += ` (${node.width}×${node.height})`;
            if (node.duration) {
              displayText += ` [${node.duration}s]`;
            }
          } else if (node.type === "region") {
            displayText += ` (${node.width}×${node.height} at ${node.left},${node.top})`;
            if (node.duration) {
              displayText += ` [${node.duration}s]`;
            }
          } else if (node.type === "widget") {
            if (node.duration) {
              displayText += ` [${node.duration}s]`;
            }
          }

          return displayText;
        }
      );

      logger.info(
        `Successfully generated tree view for layout ${context.layoutId}`
      );
      return treeResponse;
    }

    // Return basic layout data without tree view
    return validatedData;
  },
});