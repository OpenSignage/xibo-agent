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
 * Xibo CMS Layout Tagging Tool
 * 
 * This module provides functionality to add tags to a layout in the Xibo CMS system.
 * It implements the layout/{id}/tag endpoint from Xibo API.
 * Tags help with organization, filtering, and searching layouts.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../logger';

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.any().optional(),
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
 * Tool to add tags to a layout
 * Implements the layout/{id}/tag endpoint from Xibo API
 * Tags help with organization, filtering, and searching layouts
 */
export const tagLayout = createTool({
  id: 'tag-layout',
  description: 'Add tags to a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to add tags to'),
    tags: z.array(z.string()).describe('Array of tags to add')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`tagLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    logger.info(`Adding tags to layout ${context.layoutId}`, {
      tags: context.tags,
    });

    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/${context.layoutId}/tag`;

    // Build form data with URLSearchParams
    const formData = new URLSearchParams();
    context.tags.forEach((tag) => {
      formData.append("tag[]", tag);
    });

    // Send tag request to CMS
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
      const errorMessage = `Failed to add tags to layout. API responded with status ${response.status}.`;
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

    // Parse and return successful response
    const data = await response.json();
    logger.info(`Successfully added tags to layout ${context.layoutId}`);

    return {
      success: true,
      message: "Tags added successfully",
      data: data,
    };
  },
}); 