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
 * @module GetDisplayProfiles
 * @description This module provides a tool to retrieve a list of display profiles
 * from the Xibo CMS, with optional filtering.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { displayProfileSchema } from './schemas';

/**
 * Defines the output schema for the getDisplayProfiles tool.
 * This schema can represent either a successful response with an array of display profiles
 * or a failed response with an error message.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(displayProfileSchema),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool for retrieving display profiles.
 * This tool fetches display profiles from the Xibo CMS, allowing filtering by ID,
 * name, and type. It also supports embedding related data.
 */
export const getDisplayProfiles = createTool({
  id: "get-display-profiles",
  description: "Search and retrieve display profiles.",
  inputSchema: z.object({
    displayProfileId: z.number().optional().describe("Filter by DisplayProfile Id"),
    displayProfile: z.string().optional().describe("Filter by DisplayProfile Name"),
    type: z.string().optional().describe("Filter by DisplayProfile Type (windows|android|lg)"),
    embed: z.string().default("config,commands,configWithDefault").optional().describe("Embed related data such as config,commands,configWithDefault"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/displayprofile`);
    const params = new URLSearchParams();
    if (context.displayProfileId) params.append("displayProfileId", context.displayProfileId.toString());
    if (context.displayProfile) params.append("displayProfile", context.displayProfile);
    if (context.type) params.append("type", context.type);
    if (context.embed) params.append("embed", context.embed);
    url.search = params.toString();

    logger.info({ url: url.toString() }, 'Requesting display profiles.');

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to retrieve display profiles. API responded with status ${response.status}.`;
        logger.error({ response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = z.array(displayProfileSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Display profiles response validation failed.";
        logger.error({ error: validationResult.error, data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully retrieved ${validationResult.data.length} display profiles.`;
      logger.info({ count: validationResult.data.length }, message);
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while retrieving display profiles.";
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 