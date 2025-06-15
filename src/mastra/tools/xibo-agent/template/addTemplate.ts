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
 * Xibo CMS Template Addition Tool
 * 
 * This module provides functionality to add new templates
 * to the Xibo CMS system. It implements the template endpoint
 * from Xibo API for template creation.
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
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
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
      createdDt: z.string(),
      modifiedDt: z.string(),
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
        createdDt: z.string(),
        modifiedDt: z.string(),
        fromDt: z.number(),
        toDt: z.number(),
        schemaVersion: z.number(),
        transitionIn: z.number(),
        transitionOut: z.number(),
        transitionDurationIn: z.number(),
        transitionDurationOut: z.number(),
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
  folderId: z.number(),
  permissionsFolderId: z.number().nullable()
});

/**
 * Tool for adding new templates
 * 
 * This tool creates a new template in the Xibo CMS system
 * with specified parameters and returns the location of the created template.
 */
export const addTemplate = createTool({
  id: 'add-template',
  description: 'Add a new template to the Xibo CMS system',
  inputSchema: z.object({
    name: z.string().describe('Name of the template to be created'),
    description: z.string().optional().describe('Optional description for the template'),
    resolutionId: z.number().optional().describe('Optional resolution ID for the template'),
    returnDraft: z.boolean().optional().describe('Whether to return draft layout on success')
  }),
  outputSchema: templateResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("addTemplate: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/template`;

      // Prepare form data for template creation
      const formData = new URLSearchParams();
      formData.append('name', context.name);
      if (context.description) formData.append('description', context.description);
      if (context.resolutionId) formData.append('resolutionId', context.resolutionId.toString());
      if (context.returnDraft) formData.append('returnDraft', context.returnDraft.toString());

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
        logger.error(`Failed to add template: ${errorMessage}`, {
          status: response.status
        });
        return data;
      }

      // Validate response data
      try {
        const validatedData = templateResponseSchema.parse(data);
        logger.info("Successfully added new template");
        return validatedData;
      } catch (validationError) {
        logger.error("Template data validation failed", {
          error: validationError
        });
        return data;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`addTemplate: An error occurred: ${errorMessage}`, { error });
      throw new Error(errorMessage);
    }
  },
}); 