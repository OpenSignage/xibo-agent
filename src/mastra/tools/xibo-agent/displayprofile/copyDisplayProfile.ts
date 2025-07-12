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
 * @module CopyDisplayProfile
 * @description This module provides a tool to copy an existing display profile in the Xibo CMS.
 * It sends a POST request to a specific endpoint to duplicate a display profile
 * and returns the newly created profile data.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { displayProfileSchema } from './schemas';

/**
 * Defines the output schema for the copyDisplayProfile tool.
 * This schema can represent either a successful response with the copied display profile data
 * or a failed response with an error message.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: displayProfileSchema,
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
 * Tool for copying an existing display profile.
 * This tool duplicates a display profile identified by its ID and gives it a new name.
 */
export const copyDisplayProfile = createTool({
  id: "copy-display-profile",
  description: "Copy an existing display profile.",
  inputSchema: z.object({
    displayProfileId: z.number().describe("The ID of the display profile to copy."),
    name: z.string().describe("The name for the new, copied display profile."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/displayprofile/${context.displayProfileId}/copy`);
    logger.info({ displayProfileId: context.displayProfileId, name: context.name }, "Attempting to copy display profile.");

    try {
      const formData = new URLSearchParams();
      formData.append("name", context.name);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to copy display profile. API responded with status ${response.status}.`;
        logger.error({ response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = displayProfileSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Display profile response validation failed.";
        logger.error({ error: validationResult.error, data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully copied display profile to '${validationResult.data.name}'.`;
      logger.info({ newDisplayProfileId: validationResult.data.displayProfileId }, message);
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while copying the display profile.";
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 