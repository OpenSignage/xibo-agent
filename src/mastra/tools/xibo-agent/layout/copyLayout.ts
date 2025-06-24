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
 * Defines the schema for a successful response, containing the copied layout data.
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
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`copyLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    logger.info(`Copying layout with ID: ${context.layoutId}`, {
      name: context.name,
      description: context.description,
      folderId: context.folderId,
      copyMediaFiles: context.copyMediaFiles,
    });

    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/copy/${context.layoutId}`;

    // Build form data with URLSearchParams
    const formData = new URLSearchParams();
    formData.append("name", context.name);
    if (context.description) formData.append("description", context.description);
    if (context.folderId)
      formData.append("folderId", context.folderId.toString());
    formData.append("copyMediaFiles", context.copyMediaFiles.toString());

    // Send copy request to CMS
    const response = await fetch(url, {
      method: "POST",
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
      const errorMessage = `Failed to copy layout. API responded with status ${response.status}.`;
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

    // Parse and validate successful response
    const data = await response.json();
    const validatedData = layoutResponseSchema.parse(data);
    logger.info(`Successfully copied layout ${context.layoutId}`);

    return {
      success: true,
      message: "Layout copied successfully",
      data: validatedData,
    };
  },
}); 