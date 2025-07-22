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
 * Xibo CMS Layout Checkout Tool
 * 
 * This module provides functionality to checkout layouts in the Xibo CMS system.
 * It implements the layout/checkout endpoint from Xibo API.
 * Checking out a layout creates a draft version that can be modified.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../logger';

/**
 * Defines the schema for a successful response, containing the checked-out layout data.
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
  entity: z.string().nullable(),
  objectIdString: z.string().nullable(),
  group: z.string().nullable(),
  view: z.union([z.number(), z.string().transform(Number)]),
  edit: z.union([z.number(), z.string().transform(Number)]),
  delete: z.union([z.number(), z.string().transform(Number)]),
  modifyPermissions: z.union([z.number(), z.string().transform(Number)])
});

/**
 * Tag schema for layout and playlist tags
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
 * Playlist schema for region playlists
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
 * Region schema for layout regions
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
 * Schema for layout checkout response
 * Contains the complete layout information after checkout
 */
const layoutCheckoutResponseSchema = z.object({
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
  folderId: z.union([z.number(), z.string().transform(Number)]).nullable(),
  permissionsFolderId: z.union([z.number(), z.string().transform(Number)]).nullable()
});

/**
 * Tool to checkout a layout for editing
 * Implements the layout/checkout endpoint from Xibo API
 * Checking out a layout creates a draft version that can be modified
 */
export const checkoutLayout = createTool({
  id: 'checkout-layout',
  description: 'Checkout a layout for editing',
  inputSchema: z.object({
    layoutId: z.number().describe("ID of the layout to checkout"),
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
      logger.error(`checkoutLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Log checkout operation start
    logger.info(`Checking out layout ${context.layoutId}`);

    // Prepare request
    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/checkout/${context.layoutId}`;

    // Send checkout request to CMS
    const response = await fetch(url, {
      method: "PUT",
      headers,
    });
    
    if (!response.ok) {
        const responseText = await response.text();
        const decodedText = decodeErrorMessage(responseText);
        const errorMessage = `Failed to checkout layout. API responded with status ${response.status}.`;
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
        logger.info(`Successfully checked out layout ${context.layoutId} (No Content)`);
        return {
          success: true,
          message: "Layout checked out successfully.",
        };
    }

    // Validate response data
    try {
      const data = JSON.parse(responseText);
      const validatedData = layoutCheckoutResponseSchema.parse(data);
      logger.info(`Successfully checked out layout ${context.layoutId}`);
      return {
        success: true,
        data: validatedData,
      };
    } catch (validationError) {
      const errorMessage = "Response data validation failed after checkout.";
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