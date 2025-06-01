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
 * Xibo CMS Tag Management Tool
 * 
 * This module provides functionality to retrieve and search tags from the Xibo CMS system.
 * It implements the tag API endpoint and handles the necessary validation
 * and data transformation for tag operations.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for tag data validation
 * Defines the structure and validation rules for tag data in the Xibo CMS system
 */
const tagSchema = z.object({
  tagId: z.number(),
  tag: z.string(),
  isSystem: z.number(),
  isRequired: z.number(),
  options: z.string().nullable().optional(),  // Allow null values for options
});

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(tagSchema),
  error: z.object({
    status: z.number(),
    message: z.string()
  }).optional()
});

/**
 * Tool for retrieving tags from Xibo CMS
 * 
 * This tool provides functionality to:
 * - Search tags by various criteria (ID, name, system status, etc.)
 * - Filter tags based on different parameters
 * - Handle tag data validation and transformation
 */
export const getTags = createTool({
  id: "get-tags",
  description: "Search and retrieve tags from Xibo CMS",
  inputSchema: z.object({
    tagId: z.number().optional().describe("Filter by tag ID"),
    tag: z.string().optional().describe("Filter by tag name (partial match)"),
    exactTag: z.string().optional().describe("Filter by exact tag name match"),
    isSystem: z.number().optional().describe("Filter by system tag status (0: non-system, 1: system)"),
    isRequired: z.number().optional().describe("Filter by required tag status (0: optional, 1: required)"),
    haveOptions: z.number().optional().describe("Filter by tags with options (0: no options, 1: has options)"),
  }),
  outputSchema: z.array(tagSchema),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/tag`);
    
    // Add query parameters
    if (context.tagId) url.searchParams.append("tagId", context.tagId.toString());
    if (context.tag) url.searchParams.append("tag", context.tag);
    if (context.exactTag) url.searchParams.append("exactTag", context.exactTag);
    if (context.isSystem) url.searchParams.append("isSystem", context.isSystem.toString());
    if (context.isRequired) url.searchParams.append("isRequired", context.isRequired.toString());
    if (context.haveOptions) url.searchParams.append("haveOptions", context.haveOptions.toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const decodedError = decodeErrorMessage(errorText);
      logger.error('HTTP error occurred:', {
        status: response.status,
        error: decodedError
      });
      throw new Error(decodedError);
    }

    const rawData = await response.json();
    
    // Convert array response to appropriate format
    const responseData = Array.isArray(rawData) ? rawData : rawData.data;
    
    try {
      // Validate the response data
      const validatedData = apiResponseSchema.parse({
        success: true,
        data: responseData
      });

      return validatedData.data;
    } catch (error) {
      logger.error('Validation error:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
});

export default getTags; 