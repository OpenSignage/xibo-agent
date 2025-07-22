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
 * Tool to enable or disable statistics collection for a layout
 * Implements the layout/setenablestat endpoint from Xibo API
 * Statistics tracking helps monitor how often and when layouts are displayed
 */
export const setLayoutEnableStat = createTool({
  id: 'set-layout-enable-stat',
  description: 'Enable or disable statistics collection for a layout',
  inputSchema: z.object({
    layoutId: z.number().describe('ID of the layout to change statistics setting for'),
    enableStat: z.number().min(0).max(1).describe('Enable statistics collection (0: disabled, 1: enabled)')
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured";
      logger.error(`setLayoutEnableStat: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    logger.info(`Updating layout statistics setting for layout ${context.layoutId}`, {
      enableStat: context.enableStat
    });

    const headers = await getAuthHeaders();
    const url = `${config.cmsUrl}/api/layout/setenablestat/${context.layoutId}`;

    // Prepare form data for statistics setting update
    const formData = new URLSearchParams();
    formData.append('enableStat', context.enableStat.toString());

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    // Handle 204 No Content response first
    if (response.status === 204) {
      return {
        success: true,
        message: "Layout statistics setting updated successfully",
        data: null
      };
    }

    if (!response.ok) {
      const responseText = await response.text();
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to update layout statistics setting. API responded with status ${response.status}.`;
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

    // For other successful responses, try to parse JSON
    try {
      const data = await response.json();
      return {
        success: true,
        message: "Layout statistics setting updated successfully",
        data
      };
    } catch (e) {
      // If parsing fails but the request was OK, it might be an empty body for other success codes
      return {
        success: true,
        message: "Layout statistics setting updated successfully (no content)",
        data: null,
      };
    }
  },
}); 