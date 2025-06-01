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
 * Xibo CMS Tag Edit Tool
 * 
 * This module provides functionality to edit existing tags in the Xibo CMS system.
 * It implements the tag update API endpoint and handles the necessary validation
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
  options: z.string().optional(),  // options is received as a string
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
 * Tool for editing tags in Xibo CMS
 * 
 * This tool provides functionality to:
 * - Update existing tags with new parameters
 * - Modify tag properties (name, required status, options)
 * - Handle tag data validation and transformation
 */
export const editTag = createTool({
  id: "edit-tag",
  description: "Edit an existing tag in Xibo CMS",
  inputSchema: z.object({
    tagId: z.number().describe("ID of the tag to edit"),
    name: z.string().optional().describe("New name for the tag"),
    isRequired: z.number().optional().describe("Set tag as required (0: optional, 1: required)"),
    options: z.string().optional().describe("Tag options as a JSON string array"),
  }),
  outputSchema: z.array(tagSchema),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/tag/${context.tagId}`);
    
    // Create form data
    const formData = new FormData();
    if (context.name) formData.append("name", context.name);
    if (context.isRequired) formData.append("isRequired", context.isRequired.toString());
    if (context.options) formData.append("options", context.options);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: formData,
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
    
    try {
      // Validate the response data
      const validatedData = apiResponseSchema.parse({
        success: true,
        data: rawData
      });

      return validatedData.data;
    } catch (error) {
      logger.error('Validation error:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
});

export default editTag; 