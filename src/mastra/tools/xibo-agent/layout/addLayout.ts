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
import { logger } from '../../../index';

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
  code: z.string().nullable(),
  isLocked: z.union([z.boolean(), z.array(z.any())]).transform(val => Array.isArray(val) ? false : val).nullable()
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

  outputSchema: layoutResponseSchema,
  execute: async ({ context }) => {
    try {
      logger.info(`Creating new layout "${context.name}"`, {
        templateId: context.layoutId,
        resolutionId: context.resolutionId,
        folderId: context.folderId
      });

      if (!config.cmsUrl) {
        logger.error("CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();

      // Build form data
      const formData = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value.toString());
        }
      });

      const url = `${config.cmsUrl}/api/layout`;
      logger.debug(`Sending request to ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        const decodedError = decodeErrorMessage(errorText);
        logger.error(`Failed to create layout: ${decodedError}`, {
          status: response.status, 
          name: context.name
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${decodedError}`);
      }

      const data = await response.json();
      
      try {
        const validatedData = layoutResponseSchema.parse(data);
        logger.info(`Layout created successfully with ID: ${validatedData.layoutId}`, {
          layoutId: validatedData.layoutId,
          name: validatedData.layout
        });
        return validatedData;
      } catch (validationError) {
        logger.warn(`Response validation failed`, {
          error: validationError,
          responseData: data
        });
        // Return raw data even if validation fails
        return data;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in addLayout: ${errorMessage}`, { error });
      throw error;
    }
  },
}); 