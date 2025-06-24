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
 * Xibo CMS Layout Retirement Tool
 * 
 * This module provides functionality to retire a layout in the Xibo CMS system.
 * It implements the layout/{id}/retire endpoint from Xibo API.
 * Retiring a layout makes it unavailable for scheduling but preserves it in the system.
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
 * Tool to retire a layout
 * Implements the layout/{id}/retire endpoint from Xibo API
 * Retiring a layout makes it unavailable for scheduling but preserves it in the system
 */
export const retireLayout = createTool({
  id: 'retire-layout',
  description: 'Retire a layout to make it unavailable for scheduling',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to retire')
  }),

  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    // Log the start of layout retirement process
    logger.info(`Retiring layout with ID: ${context.layoutId}`);

    // Validate CMS URL configuration
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`retireLayout: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }

    // Prepare API request
    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/retire/${context.layoutId}`;
    logger.debug(`Sending PUT request to ${url}`);

    // Send retirement request to CMS
    const response = await fetch(url, {
      method: 'PUT',
      headers,
    });

    // Handle 204 No Content for successful retirement
    if (response.status === 204) {
      logger.info(`Layout ID ${context.layoutId} retired successfully`);
      return { success: true, message: "Layout retired successfully" };
    }

    // Handle other non-ok responses
    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to retire layout. API responded with status ${response.status}.`;
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
    logger.info(`Layout ID ${context.layoutId} retired successfully with status ${response.status}`);
    return { success: true, message: "Layout retired successfully" };
  },
}); 