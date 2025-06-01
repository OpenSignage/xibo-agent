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
 * Xibo CMS Tag Addition Tool
 * 
 * This module provides functionality to add new tags to the Xibo CMS system.
 * It implements the tag creation API endpoint and handles the necessary validation
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
 * Schema for tool response
 */
const toolResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(tagSchema).optional(),
  error: z.string().optional()
});

/**
 * Tool for adding tags to Xibo CMS
 * 
 * This tool provides functionality to:
 * - Create new tags with specified parameters
 * - Set tag properties (required status, options)
 * - Handle tag data validation and transformation
 */
export const addTag = createTool({
  id: "add-tag",
  description: "Add a new tag to Xibo CMS",
  inputSchema: z.object({
    name: z.string().describe("Name of the tag to add"),
    isRequired: z.number().optional().describe("Set tag as required (0: optional, 1: required)"),
    options: z.string().optional().describe("Tag options as a JSON string array"),
  }),
  outputSchema: toolResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      return {
        success: false,
        error: "CMS URL is not set"
      };
    }

    const url = new URL(`${config.cmsUrl}/api/tag`);
    
    // Create URLSearchParams for form data
    const params = new URLSearchParams();
    params.append("name", context.name);
    if (context.isRequired) params.append("isRequired", context.isRequired.toString());
    if (context.options) params.append("options", context.options);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...await getAuthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      const decodedError = decodeErrorMessage(errorText);
      logger.error('HTTP error occurred:', {
        status: response.status,
        error: decodedError
      });
      return JSON.parse(decodedError);
    }

    const rawData = await response.json();
    
    try {
      // Validate the response data
      const validatedData = apiResponseSchema.parse({
        success: true,
        data: [rawData]  // Wrap the response in an array
      });

      return rawData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Validation error:', { 
        error: errorMessage,
        rawData: rawData
      });
      return {
        error: 422,
        message: errorMessage
      };
    }
  },
});

export default addTag; 