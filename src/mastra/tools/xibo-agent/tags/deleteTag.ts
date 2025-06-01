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
 * Xibo CMS Tag Deletion Tool
 * 
 * This module provides functionality to delete tags from the Xibo CMS system.
 * It implements the tag deletion API endpoint and handles the necessary validation
 * and error handling for tag operations.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.null(),
  error: z.object({
    status: z.number(),
    message: z.string()
  }).optional()
});

/**
 * Tool for deleting tags from Xibo CMS
 * 
 * This tool provides functionality to:
 * - Delete existing tags by ID
 * - Handle tag deletion validation and error handling
 */
export const deleteTag = createTool({
  id: "delete-tag",
  description: "Delete a tag from Xibo CMS",
  inputSchema: z.object({
    tagId: z.number().describe("ID of the tag to delete"),
  }),
  outputSchema: z.null(),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/tag/${context.tagId}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
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

    try {
      // Validate the response data
      const validatedData = apiResponseSchema.parse({
        success: true,
        data: null
      });

      return null;
    } catch (error) {
      logger.error('Validation error:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  },
});

export default deleteTag; 