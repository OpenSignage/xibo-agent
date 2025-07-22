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
 * Layout Deletion Tool
 * This module provides functionality to delete existing layouts in Xibo CMS
 * with appropriate error handling and validation
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
 * Tool for deleting layouts in Xibo CMS
 * Makes a DELETE request to the CMS API to remove an existing layout
 */
export const deleteLayout = createTool({
  id: "delete-layout",
  description: "Deletes a layout from Xibo CMS",
  inputSchema: z.object({
    layoutId: z.number().describe("Layout ID to delete"),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    logger.info(`Deleting layout with ID: ${context.layoutId}`);

    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`deleteLayout: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Get authentication headers for the API request
    const headers = await getAuthHeaders();

    // Construct the API endpoint URL for the layout deletion
    const url = `${config.cmsUrl}/api/layout/${context.layoutId}`;
    logger.debug(`Sending DELETE request to ${url}`);

    // Make a DELETE request to the Xibo CMS API
    const response = await fetch(url, {
      method: "DELETE",
      headers: headers,
    });

    // Handle 204 No Content response for successful deletion
    if (response.status === 204) {
      logger.info(`Layout ID ${context.layoutId} deleted successfully`);
      return { success: true, message: "Layout deleted successfully" };
    }
    
    // Handle error responses from the API
    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to delete layout. API responded with status ${response.status}.`;
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

    // This part might not be reached if API always returns 204 on success,
    // but it's here for completeness.
    logger.info(`Layout ID ${context.layoutId} deleted successfully with status ${response.status}`);
    return { success: true, message: "Layout deleted successfully" };
  },
});