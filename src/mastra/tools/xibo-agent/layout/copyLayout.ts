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
 * Xibo CMS Layout Copy Tool
 * 
 * This module provides functionality to copy a layout in the Xibo CMS system.
 * It implements the layout/copy/{id} endpoint from Xibo API.
 * Copying a layout creates a new layout with the same content but a different name.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Response schema for Layout objects
 * Based on Xibo API documentation
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
  isLocked: z.union([
    z.boolean(),
    z.array(z.any()),
    z.null()
  ]).transform(val => {
    if (val === null) return false;
    if (Array.isArray(val)) return false;
    return val;
  })
});

/**
 * Tool to copy a layout from the Xibo CMS
 * Implements the layout/copy endpoint from Xibo API
 */
export const copyLayout = createTool({
  id: 'copy-layout',
  description: 'Copy a layout with a new name',
  inputSchema: z.object({
    layoutId: z.number().describe('The Layout ID to Copy'),
    name: z.string().describe('The name for the new Layout'),
    description: z.string().optional().describe('The Description for the new Layout'),
    folderId: z.number().optional().describe('Folder ID to place the copied layout'),
    copyMediaFiles: z.number().describe('Flag indicating whether to make new Copies of all Media Files assigned to the Layout being Copied')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: layoutResponseSchema.optional(),
    error: z.object({
      status: z.number().optional(),
      message: z.string(),
      details: z.any().optional(),
      help: z.string().optional()
    }).optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("copyLayout: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Copying layout with ID: ${context.layoutId}`, {
        name: context.name,
        description: context.description,
        folderId: context.folderId,
        copyMediaFiles: context.copyMediaFiles
      });

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/copy/${context.layoutId}`;

      // Build form data with URLSearchParams
      const formData = new URLSearchParams();
      formData.append('name', context.name);
      if (context.description) formData.append('description', context.description);
      if (context.folderId) formData.append('folderId', context.folderId.toString());
      formData.append('copyMediaFiles', context.copyMediaFiles.toString());

      // Send copy request to CMS
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      // Handle error response
      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to copy layout: ${errorMessage}`, {
          status: response.status,
          layoutId: context.layoutId
        });

        let parsedError;
        try {
          parsedError = JSON.parse(errorMessage);
          if (parsedError.message) {
            parsedError.message = decodeURIComponent(parsedError.message);
          }
        } catch (e) {
          parsedError = { message: errorMessage };
        }

        return {
          success: false,
          error: {
            status: response.status,
            message: parsedError.message || errorMessage,
            details: parsedError,
            help: parsedError.help
          }
        };
      }

      // Parse and validate successful response
      const data = await response.json();
      const validatedData = layoutResponseSchema.parse(data);
      logger.info(`Successfully copied layout ${context.layoutId}`);

      return {
        success: true,
        message: "Layout copied successfully",
        data: validatedData
      };
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in copyLayout: ${errorMessage}`, {
        error,
        layoutId: context.layoutId
      });
      return {
        success: false,
        error: {
          message: errorMessage,
          type: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      };
    }
  },
}); 