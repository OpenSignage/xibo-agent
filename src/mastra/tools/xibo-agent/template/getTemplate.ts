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
 * @module
 * This module provides a tool for searching for templates in the Xibo CMS.
 * It implements the GET /template endpoint.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { decodeErrorMessage } from "../utility/error";
import { logger } from '../../../index';
import { templateSchema } from "./schemas";

/**
 * Tool to search for templates in the CMS.
 */
export const getTemplate = createTool({
  id: 'get-template',
  description: 'Search for templates in the CMS',
  inputSchema: z.object({
    // Adding optional filters based on typical API patterns
    templateId: z.number().optional().describe("Filter by a specific Template ID."),
    name: z.string().optional().describe("Filter templates by name (supports filtering with %)."),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Indicates whether the operation was successful."),
    message: z.string().optional().describe("A message providing details about the operation outcome."),
    data: z.array(templateSchema).optional().describe("An array of template objects on success."),
    error: z.any().optional().describe("Error details if the operation failed."),
  }),
  execute: async ({ context }) => {
    logger.info({ context }, "Executing getTemplate tool.");
    try {
      if (!config.cmsUrl) {
        const message = "CMS URL is not configured.";
        logger.error(message);
        throw new Error(message);
      }
      
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      // Append provided context filters to the search params
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.append(key, String(value));
        }
      });

      const url = `${config.cmsUrl}/api/template?${params.toString()}`;

      logger.debug({ url }, "Sending GET request to fetch templates.");
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = decodeErrorMessage(JSON.stringify(data));
        const message = "Failed to search templates.";
        logger.error({ status: response.status, error: errorMessage }, message);

        return { success: false, message, error: { status: response.status, message: errorMessage, details: data }};
      }
      
      const validatedData = z.array(templateSchema).parse(data);
      logger.info({ count: validatedData.length }, "Successfully retrieved templates.");

      return { success: true, data: validatedData, message: "Successfully retrieved templates." };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      logger.error({ error }, "An unexpected error occurred in getTemplate.");
      return { success: false, message: "An unexpected error occurred.", error: { message: errorMessage, details: error } };
    }
  },
}); 