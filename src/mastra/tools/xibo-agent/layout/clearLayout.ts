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
 * Xibo CMS Layout Clear Tool
 * 
 * This module provides functionality to clear all regions and widgets from a layout
 * in the Xibo CMS system, resulting in an empty canvas while preserving layout settings.
 * It implements the layout/{id} POST endpoint from Xibo API.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Defines the schema for a successful response, containing the cleared layout data.
 */
const successSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.any().optional(), // Using z.any() as the layout structure is complex.
});

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
 * Permission schema for layout, region, and widget permissions
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
 * Tag schema for layout and playlist tags
 */
const tagSchema = z.object({
  tag: z.string(),
  tagId: z.union([z.number(), z.string().transform(Number)]),
  value: z.string()
});

/**
 * Region option schema
 */
const regionOptionSchema = z.object({
  regionId: z.union([z.number(), z.string().transform(Number)]),
  option: z.string(),
  value: z.union([z.string(), z.number()])
});

/**
 * Widget option schema
 */
const widgetOptionSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string(),
  option: z.string(),
  value: z.string()
});

/**
 * Audio schema for widget audio settings
 */
const audioSchema = z.object({
  widgetId: z.union([z.number(), z.string().transform(Number)]),
  mediaId: z.union([z.number(), z.string().transform(Number)]),
  volume: z.union([z.number(), z.string().transform(Number)]),
  loop: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Widget schema for playlist widgets
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
  widgetOptions: z.array(widgetOptionSchema).nullable(),
  mediaIds: z.array(z.union([z.number(), z.string().transform(Number)])).nullable(),
  audio: z.array(audioSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  playlist: z.string()
});

/**
 * Playlist schema for region playlists
 */
const playlistSchema = z.object({
  playlistId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  name: z.string(),
  regionId: z.union([z.number(), z.string().transform(Number)]),
  isDynamic: z.union([z.number(), z.string().transform(Number)]),
  filterMediaName: z.string(),
  filterMediaNameLogicalOperator: z.string(),
  filterMediaTags: z.string(),
  filterExactTags: z.union([z.number(), z.string().transform(Number)]),
  filterMediaTagsLogicalOperator: z.string(),
  filterFolderId: z.union([z.number(), z.string().transform(Number)]),
  maxNumberOfItems: z.union([z.number(), z.string().transform(Number)]),
  createdDt: z.string(),
  modifiedDt: z.string(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  requiresDurationUpdate: z.union([z.number(), z.string().transform(Number)]),
  enableStat: z.string(),
  tags: z.array(tagSchema).nullable(),
  widgets: z.array(widgetSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  folderId: z.union([z.number(), z.string().transform(Number)]),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Region schema for layout regions
 */
const regionSchema = z.object({
  regionId: z.union([z.number(), z.string().transform(Number)]),
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  type: z.string(),
  name: z.string(),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  top: z.union([z.number(), z.string().transform(Number)]),
  left: z.union([z.number(), z.string().transform(Number)]),
  zIndex: z.union([z.number(), z.string().transform(Number)]),
  syncKey: z.string(),
  regionOptions: z.array(regionOptionSchema).nullable(),
  permissions: z.array(permissionSchema).nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]),
  isDrawer: z.union([z.number(), z.string().transform(Number)]),
  regionPlaylist: playlistSchema
});

/**
 * Schema for layout clear response
 * Contains the complete layout information after clearing
 */
const layoutClearResponseSchema = z.object({
  layoutId: z.union([z.number(), z.string().transform(Number)]),
  ownerId: z.union([z.number(), z.string().transform(Number)]),
  campaignId: z.union([z.number(), z.string().transform(Number)]),
  parentId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  publishedStatusId: z.union([z.number(), z.string().transform(Number)]),
  publishedStatus: z.string().nullable(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]).nullable(),
  layout: z.string().nullable(),
  description: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  status: z.union([z.number(), z.string().transform(Number)]),
  retired: z.union([z.number(), z.string().transform(Number)]).nullable(),
  backgroundzIndex: z.union([z.number(), z.string().transform(Number)]),
  width: z.union([z.number(), z.string().transform(Number)]),
  height: z.union([z.number(), z.string().transform(Number)]),
  orientation: z.string().nullable(),
  displayOrder: z.union([z.number(), z.string().transform(Number)]).nullable(),
  duration: z.union([z.number(), z.string().transform(Number)]).nullable(),
  statusMessage: z.string().nullable(),
  enableStat: z.union([z.number(), z.string().transform(Number)]).nullable(),
  autoApplyTransitions: z.union([z.number(), z.string().transform(Number)]).nullable(),
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
  regions: z.array(regionSchema).nullable(),
  tags: z.array(tagSchema).nullable(),
  folderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)]).nullable()
});

/**
 * Tool to clear all regions and widgets from a layout
 * Implements the layout endpoint with POST method from Xibo API
 * This resets the layout to an empty canvas while preserving layout settings
 */
export const clearLayout = createTool({
  id: 'clear-layout',
  description: 'Clear all content from a layout canvas',
  inputSchema: z.object({
    layoutId: z.number().describe("ID of the layout to clear"),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`clearLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    logger.info(`Clearing layout with ID: ${context.layoutId}`);

    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/clear/${context.layoutId}`;

    logger.info(`Sending PUT request to ${url} to clear layout`);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to clear layout. API responded with status ${response.status}.`;
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
    
    // Successful response might have a body or not (e.g. 204 No Content)
    const responseText = await response.text();
    if (!responseText) {
        logger.info(`Successfully cleared layout ${context.layoutId} (No Content)`);
        return {
          success: true,
          message: "Layout cleared successfully.",
        };
    }

    try {
      const data = JSON.parse(responseText);
      const validatedData = layoutClearResponseSchema.parse(data);
      logger.info(`Successfully cleared layout ${context.layoutId}`);
      return {
        success: true,
        data: validatedData,
      };
    } catch (validationError) {
      const errorMessage = "Response data validation failed after clearing layout.";
      logger.error(errorMessage, {
        error:
          validationError instanceof Error
            ? validationError.message
            : "Unknown validation error",
        layoutId: context.layoutId,
        receivedData: responseText
      });
      return {
        success: false,
        message: errorMessage,
        error: {
          validationError:
            validationError instanceof Error
              ? validationError.message
              : "Unknown validation error",
          receivedData: responseText
        },
      };
    }
  },
}); 