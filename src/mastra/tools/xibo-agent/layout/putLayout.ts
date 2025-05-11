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
 * Tool to update an existing layout
 * Implements the layout/{id} PUT endpoint from Xibo API
 * Allows updating various properties of a layout
 */
export const putLayout = createTool({
  id: 'put-layout',
  description: 'Update an existing layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to update'),
    name: z.string().optional().describe('Layout name'),
    description: z.string().optional().describe('Layout description'),
    backgroundColor: z.string().optional().describe('Background color in hex format'),
    backgroundImageId: z.number().optional().describe('Background image ID'),
    backgroundzIndex: z.number().optional().describe('Background z-index'),
    width: z.number().optional().describe('Width of the layout'),
    height: z.number().optional().describe('Height of the layout'),
    orientation: z.string().optional().describe('Orientation (landscape or portrait)'),
    displayOrder: z.number().optional().describe('Display order'),
    duration: z.number().optional().describe('Duration in seconds'),
    enableStat: z.number().optional().describe('Enable statistics (0-1)'),
    autoApplyTransitions: z.number().optional().describe('Auto-apply transitions (0-1)'),
    code: z.string().optional().describe('Layout identification code'),
    folderId: z.number().optional().describe('Folder ID to assign the layout to')
  }),

  outputSchema: z.string(),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        throw new Error("CMS URL is not configured");
      }

      const headers = await getAuthHeaders();

      // Build form data
      const formData = new URLSearchParams();
      if (context.name) formData.append('name', context.name);
      if (context.description) formData.append('description', context.description);
      if (context.backgroundColor) formData.append('backgroundColor', context.backgroundColor);
      if (context.backgroundImageId) formData.append('backgroundImageId', context.backgroundImageId.toString());
      if (context.backgroundzIndex) formData.append('backgroundzIndex', context.backgroundzIndex.toString());
      if (context.width) formData.append('width', context.width.toString());
      if (context.height) formData.append('height', context.height.toString());
      if (context.orientation) formData.append('orientation', context.orientation);
      if (context.displayOrder) formData.append('displayOrder', context.displayOrder.toString());
      if (context.duration) formData.append('duration', context.duration.toString());
      if (context.enableStat !== undefined) formData.append('enableStat', context.enableStat.toString());
      if (context.autoApplyTransitions !== undefined) formData.append('autoApplyTransitions', context.autoApplyTransitions.toString());
      if (context.code) formData.append('code', context.code);
      if (context.folderId) formData.append('folderId', context.folderId.toString());

      const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
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