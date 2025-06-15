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
 * Xibo CMS Template Creation from Layout Tool
 * 
 * This module provides functionality to create a new template
 * from an existing layout in the Xibo CMS system.
 * It implements the template/{layoutId} endpoint from Xibo API.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

// Schema for template response
const templateResponseSchema = z.object({
  layoutId: z.number(),
  ownerId: z.number(),
  campaignId: z.number(),
  parentId: z.number().nullable(),
  publishedStatusId: z.number(),
  publishedStatus: z.string(),
  publishedDate: z.string().nullable(),
  backgroundImageId: z.number().nullable(),
  schemaVersion: z.number().nullable(),
  layout: z.string(),
  description: z.string().nullable(),
  backgroundColor: z.string(),
  createdDt: z.union([z.string(), z.number()]).nullable(),
  modifiedDt: z.union([z.string(), z.number()]).nullable(),
  status: z.number(),
  retired: z.number().nullable(),
  backgroundzIndex: z.number(),
  width: z.number(),
  height: z.number(),
  orientation: z.string(),
  displayOrder: z.number().nullable(),
  duration: z.number().nullable(),
  statusMessage: z.string().nullable(),
  enableStat: z.number(),
  autoApplyTransitions: z.number(),
  code: z.string().nullable(),
  isLocked: z.boolean().nullable(),
  regions: z.array(z.object({
    regionId: z.number(),
    layoutId: z.number(),
    ownerId: z.number(),
    type: z.string(),
    name: z.string(),
    width: z.number(),
    height: z.number(),
    top: z.number(),
    left: z.number(),
    zIndex: z.number(),
    syncKey: z.string().nullable(),
    regionOptions: z.array(z.object({
      regionId: z.number(),
      option: z.string(),
      value: z.string()
    })),
    permissions: z.array(z.object({
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
    })),
    duration: z.number(),
    isDrawer: z.number(),
    regionPlaylist: z.object({
      playlistId: z.number(),
      ownerId: z.number(),
      name: z.string(),
      regionId: z.number(),
      isDynamic: z.number(),
      filterMediaName: z.string().nullable(),
      filterMediaNameLogicalOperator: z.string(),
      filterMediaTags: z.string().nullable(),
      filterExactTags: z.number(),
      filterMediaTagsLogicalOperator: z.string(),
      filterFolderId: z.number(),
      maxNumberOfItems: z.number(),
      createdDt: z.union([z.string(), z.number()]),
      modifiedDt: z.union([z.string(), z.number()]),
      duration: z.number(),
      requiresDurationUpdate: z.number(),
      enableStat: z.string().nullable(),
      tags: z.array(z.object({
        tag: z.string(),
        tagId: z.number(),
        value: z.string()
      })),
      widgets: z.array(z.object({
        widgetId: z.number(),
        playlistId: z.number(),
        ownerId: z.number(),
        type: z.string(),
        duration: z.number(),
        displayOrder: z.number(),
        useDuration: z.number(),
        calculatedDuration: z.number(),
        createdDt: z.union([z.string(), z.number()]),
        modifiedDt: z.union([z.string(), z.number()]),
        fromDt: z.number(),
        toDt: z.number(),
        schemaVersion: z.number(),
        transitionIn: z.number().nullable(),
        transitionOut: z.number().nullable(),
        transitionDurationIn: z.number().nullable(),
        transitionDurationOut: z.number().nullable(),
        widgetOptions: z.array(z.object({
          widgetId: z.number(),
          type: z.string(),
          option: z.string(),
          value: z.string()
        })),
        mediaIds: z.array(z.number()),
        audio: z.array(z.object({
          widgetId: z.number(),
          mediaId: z.number(),
          volume: z.number(),
          loop: z.number()
        })),
        permissions: z.array(z.object({
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
        })),
        playlist: z.string()
      })),
      permissions: z.array(z.object({
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
      })),
      folderId: z.number(),
      permissionsFolderId: z.number()
    })
  })),
  tags: z.array(z.object({
    tag: z.string(),
    tagId: z.number(),
    value: z.string()
  })),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable()
});

/**
 * Tool for creating templates from existing layouts
 * 
 * This tool creates a new template based on an existing layout
 * in the Xibo CMS system, with options to include widgets and tags.
 */
export const addTemplateFromLayout = createTool({
  id: 'add-template-from-layout',
  description: 'Create a new template from an existing layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to use as a base for the template'),
    includeWidgets: z.number().describe('Whether to include widgets in the template (1: include, 0: exclude)'),
    name: z.string().describe('Name of the template to be created'),
    tags: z.string().optional().describe('Comma-separated list of tags for the template'),
    description: z.string().optional().describe('Optional description for the template')
  }),
  outputSchema: templateResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("addTemplateFromLayout: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/template/${context.layoutId}`;

      // Prepare form data for template creation
      const formData = new URLSearchParams();
      formData.append('includeWidgets', context.includeWidgets.toString());
      formData.append('name', context.name);
      if (context.tags) formData.append('tags', context.tags);
      if (context.description) formData.append('description', context.description);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(JSON.stringify(data));
        logger.error(`Failed to create template from layout: ${errorMessage}`, {
          status: response.status
        });
        return data;
      }

      // Validate response data
      try {
        const validatedData = templateResponseSchema.parse(data);
        logger.info("Successfully created template from layout");
        return validatedData;
      } catch (validationError) {
        logger.error("Template data validation failed", {
          error: validationError
        });
        return data;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`addTemplateFromLayout: An error occurred: ${errorMessage}`, { error });
      throw new Error(errorMessage);
    }
  },
}); 