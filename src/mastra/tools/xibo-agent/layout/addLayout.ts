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
 * Layout Creation Tool
 * This module provides functionality to create new layouts in Xibo CMS
 * with comprehensive data validation and error handling
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../logger';

/**
 * Defines the schema for a successful response, containing the new layout data.
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

// Response schema for layout validation
const layoutResponseSchema = z.object({
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
  enableStat: z.union([z.number(), z.string().transform(Number)]),
  autoApplyTransitions: z.union([z.number(), z.string().transform(Number)]),
  code: z.string().nullable().describe("Layout identification code"),
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
  folderId: z.number().optional().describe("Folder ID to assign the layout to"),
});

/**
 * Tool for creating new layouts in Xibo CMS
 */
export const addLayout = createTool({
  id: 'add-layout',
  description: 'Creates a new layout in Xibo CMS',
  inputSchema: z.object({
    name: z.string().describe('Layout name'),
    description: z.string().optional().describe('Layout description'),
    layoutId: z.number().optional().describe('Layout ID to use as template'),
    resolutionId: z.number().optional().describe('Resolution ID when not using a template'),
    returnDraft: z.boolean().optional().describe('Return draft layout on success'),
    code: z.string().optional().describe('Layout identification code'),
    folderId: z.number().optional().describe('Folder ID to assign the layout to')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`addLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    logger.info({
      templateId: context.layoutId,
      resolutionId: context.resolutionId,
      folderId: context.folderId,
    }, `Creating new layout "${context.name}"`);

    const headers = await getAuthHeaders();

    const formData = new URLSearchParams();
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const url = `${config.cmsUrl}/api/layout`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to create layout. API responded with status ${response.status}.`;
      logger.error({
        status: response.status,
        name: context.name,
        response: decodedText,
      }, errorMessage);

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
      const validatedData = layoutResponseSchema.parse(data);
      logger.info({
        layoutId: validatedData.layoutId,
        name: validatedData.layout,
      }, `Layout created successfully with ID: ${validatedData.layoutId}`);
      return validatedData;
    } catch (validationError) {
      const errorMessage =
        "Response data validation failed after creating layout.";
      logger.error({
        error:
          validationError instanceof Error
            ? validationError.message
            : "Unknown validation error",
        responseData: data,
      }, errorMessage);
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