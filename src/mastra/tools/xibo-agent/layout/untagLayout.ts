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
 * Xibo CMS Layout Untagging Tool
 * 
 * This module provides functionality to remove tags from a layout in the Xibo CMS system.
 * It implements the layout/{id}/untag endpoint from Xibo API.
 * Used to declassify or reorganize layouts by removing specific tags.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Tool to remove tags from a layout
 * Implements the layout/{id}/untag endpoint from Xibo API
 * Used to declassify or reorganize layouts by removing specific tags
 */
export const untagLayout = createTool({
  id: 'untag-layout',
  description: 'Remove tags from a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to remove tags from'),
    tags: z.array(z.string()).describe('Array of tags to remove')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: z.any().optional(),
    error: z.object({
      status: z.number().optional(),
      message: z.string(),
      details: z.any().optional(),
      help: z.string().optional()
    }).optional()
  }),
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("untagLayout: CMS URL is not configured");
        throw new Error("CMS URL is not configured");
      }

      logger.info(`Removing tags from layout ${context.layoutId}`, {
        tags: context.tags
      });

      const headers = await getAuthHeaders();
      const url = `${config.cmsUrl}/api/layout/${context.layoutId}/untag`;

      // Build form data with URLSearchParams
      const formData = new URLSearchParams();
      context.tags.forEach(tag => {
        formData.append('tag[]', tag);
      });

      // Send untag request to CMS
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      // Handle error response
      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to remove tags from layout: ${errorMessage}`, {
          status: response.status,
          layoutId: context.layoutId
        });

        let parsedError;
        try {
          parsedError = JSON.parse(errorMessage);
          if (parsedError.message) {
            parsedError.message = decodeURIComponent(parsedError.message);
          }
        } catch (e) {
          parsedError = { message: errorMessage };
        }

        return {
          success: false,
          error: {
            status: response.status,
            message: parsedError.message || errorMessage,
            details: parsedError,
            help: parsedError.help
          }
        };
      }

      // Parse and return successful response
      const data = await response.json();
      logger.info(`Successfully removed tags from layout ${context.layoutId}`);

      return {
        success: true,
        message: "Tags removed successfully",
        data: data
      };
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`Error in untagLayout: ${errorMessage}`, {
        error,
        layoutId: context.layoutId
      });
      return {
        success: false,
        error: {
          message: errorMessage,
          type: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      };
    }
  },
}); 