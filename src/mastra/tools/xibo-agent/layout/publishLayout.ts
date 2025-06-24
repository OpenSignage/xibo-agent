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
 * Xibo CMS Layout Publishing Tool
 * 
 * This module provides functionality to publish layouts in the Xibo CMS system.
 * It implements the layout/{id}/publish endpoint from Xibo API.
 * Publishing a layout makes it available for display on devices, either immediately
 * or at a scheduled time.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Defines the schema for a successful response, containing the published layout data.
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
 * Tag schema for layout and playlist tags
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
 * Audio schema for widget audio settings
 */
const audioSchema = z.object({
  widgetId: z.number(),
  mediaId: z.number(),
  volume: z.number(),
  loop: z.number()
});

/**
 * Widget schema for playlist widgets
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
  createdDt: z.number(),
  modifiedDt: z.number(),
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
 * Playlist schema for region playlists
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
 * Region schema for layout regions
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
 * Schema for layout publish response
 * Contains the complete layout information after publishing
 */
const layoutPublishResponseSchema = z.object({
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
  isLocked: z.boolean().nullable(),
  regions: z.array(regionSchema),
  tags: z.array(tagSchema),
  folderId: z.number(),
  permissionsFolderId: z.number()
});

/**
 * Tool to publish a layout
 * Implements the layout/{id}/publish endpoint from Xibo API
 * Publishing a layout makes it available for display on devices
 */
export const publishLayout = createTool({
  id: 'publish-layout',
  description: 'Publish a layout to make it available for display',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to publish'),
    publishNow: z.number().optional().describe('Flag indicating whether to publish layout now (0 or 1)'),
    publishDate: z.string().optional().describe('The date/time at which layout should be published (ISO 8601 format)')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    // Check CMS URL configuration
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`publishLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Log publishing operation start
    logger.info(`Publishing layout ${context.layoutId}`, {
      publishNow: context.publishNow,
      publishDate: context.publishDate,
    });

    // Prepare request
    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/publish/${context.layoutId}`;

    // Build form data with optional parameters
    const formData = new URLSearchParams();
    if (context.publishNow !== undefined) {
      formData.append("publishNow", context.publishNow.toString());
    }
    if (context.publishDate) {
      formData.append("publishDate", context.publishDate);
    }

    // Send publish request to CMS
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
        const responseText = await response.text();
        const decodedText = decodeErrorMessage(responseText);
        const errorMessage = `Failed to publish layout. API responded with status ${response.status}.`;
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
        logger.info(`Successfully published layout ${context.layoutId} (No Content)`);
        return {
          success: true,
          message: "Layout published successfully.",
        };
    }

    // Validate response data
    try {
      const data = JSON.parse(responseText);
      const validatedData = layoutPublishResponseSchema.parse(data);
      logger.info(`Successfully published layout ${context.layoutId}`);
      return {
        success: true,
        data: validatedData,
      };
    } catch (validationError) {
      const errorMessage = "Response data validation failed after publishing layout.";
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