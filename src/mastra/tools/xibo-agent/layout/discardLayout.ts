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
 * Xibo CMS Layout Discard Tool
 * 
 * This module provides functionality to discard changes made to a checked-out layout
 * in the Xibo CMS system. It implements the layout/discard endpoint from Xibo API.
 * This reverts the layout to its last published state and removes the draft version.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Defines the schema for a successful response, containing the reverted layout data.
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
 * Schema for layout discard response
 * Contains the complete layout information after discarding changes
 */
const layoutDiscardResponseSchema = z.object({
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
 * Tool to discard changes made to a checked-out layout
 * Implements the layout/discard endpoint from Xibo API
 * This reverts the layout to its last published state and removes the draft version
 */
export const discardLayout = createTool({
  id: 'discard-layout',
  description: 'Discard changes to a layout and revert to published version',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to discard changes for')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`discardLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    logger.info(`Discarding changes for layout ${context.layoutId}`);

    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/discard/${context.layoutId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers,
    });

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to discard layout changes. API responded with status ${response.status}.`;
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

    // Handle successful response (204 No Content or with body)
    if (response.status === 204) {
        logger.info(`Successfully discarded changes for layout ${context.layoutId} (No Content)`);
        return {
          success: true,
          message: "Layout changes discarded successfully.",
        };
    }

    try {
      const data = await response.json();
      const validatedData = layoutDiscardResponseSchema.parse(data);
      logger.info(`Successfully discarded changes for layout ${context.layoutId}`);
      return {
        success: true,
        data: validatedData,
      };
    } catch (validationError) {
      const errorMessage = "Response data validation failed after discarding layout.";
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
  },
}); 