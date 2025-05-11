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

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";

/**
 * Response schema for layout objects
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
  isLocked: z.union([z.boolean(), z.array(z.any())]).transform(val => Array.isArray(val) ? false : val)
});

/**
 * Tool to add a new fullscreen layout
 * Implements the layout endpoint with resolution values for fullscreen display
 * Creates a layout with one full size region covering the entire layout area
 */
export const addFullscreenLayout = createTool({
  id: 'add-fullscreen-layout',
  description: 'Add a new fullscreen layout with a single region',
  inputSchema: z.object({
    name: z.string().describe('Name for the new layout'),
    width: z.number().default(1920).describe('Width of the layout in pixels (default: 1920)'),
    height: z.number().default(1080).describe('Height of the layout in pixels (default: 1080)'),
    backgroundColor: z.string().default('#000000').describe('Background color in hex format (default: black)'),
    description: z.string().optional().describe('Description for the layout'),
    resolution: z.string().optional().describe('Resolution code, e.g., "1080p" (optional)'),
    enableStat: z.number().min(0).max(1).default(0).describe('Enable statistics collection (0: disabled, 1: enabled)'),
    folderId: z.number().optional().describe('Folder ID to assign the layout to'),
    tags: z.array(z.string()).optional().describe('Array of tags to add to the layout')
  }),
  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout`;

      // Build form data
      const formData = new FormData();
      formData.append('name', context.name);
      formData.append('width', context.width.toString());
      formData.append('height', context.height.toString());
      formData.append('backgroundColor', context.backgroundColor);
      
      // Add optional parameters
      if (context.description) formData.append('description', context.description);
      if (context.resolution) formData.append('resolution', context.resolution);
      formData.append('enableStat', context.enableStat.toString());
      if (context.folderId) formData.append('folderId', context.folderId.toString());
      
      // Add fullscreen region parameter
      formData.append('fullScreenRegion', '1');
      
      // Add tags if provided
      if (context.tags && context.tags.length > 0) {
        context.tags.forEach(tag => {
          formData.append('tags[]', tag);
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      const data = await response.json();
      const validatedData = layoutResponseSchema.parse(data);

      return JSON.stringify(validatedData, null, 2);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
}); 