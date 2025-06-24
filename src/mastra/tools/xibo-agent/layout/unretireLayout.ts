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
 * Xibo CMS Layout Unretirement Tool
 * 
 * This module provides functionality to unretire a previously retired layout
 * in the Xibo CMS system. It implements the layout/{id}/unretire endpoint
 * from Xibo API. Unretiring a layout makes it available for scheduling again.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  message: z.string(),
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
 * Tool to unretire a previously retired layout
 * Implements the layout/{id}/unretire endpoint from Xibo API
 * Makes the layout available for scheduling again
 */
export const unretireLayout = createTool({
  id: 'unretire-layout',
  description: 'Unretire a layout to make it available for scheduling again',
  inputSchema: z.object({
    layoutId: z.number().describe("ID of the layout to unretire"),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    // Log the start of layout unretirement process
    logger.info(`Unretiring layout with ID: ${context.layoutId}`);

    // Validate CMS URL configuration
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`unretireLayout: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }

    // Prepare API request
    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/unretire/${context.layoutId}`;
    logger.debug(`Sending PUT request to ${url}`);

    // Send unretirement request to CMS
    const response = await fetch(url, {
      method: "PUT",
      headers,
    });

    // Handle 204 No Content for successful unretirement
    if (response.status === 204) {
      logger.info(`Layout ID ${context.layoutId} unretired successfully`);
      return { success: true, message: "Layout unretired successfully" };
    }

    // Handle other non-ok responses
    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to unretire layout. API responded with status ${response.status}.`;
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

    // Handle successful responses that are not 204
    logger.info(`Layout ID ${context.layoutId} unretired successfully with status ${response.status}`);
    return { success: true, message: "Layout unretired successfully" };
  },
}); 