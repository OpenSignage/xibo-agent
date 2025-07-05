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
 * @module addDisplayProfile
 * @description Provides a tool to add a new display profile to the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { displayProfileSchema } from './schemas';

/**
 * Schema for the tool's output.
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
 * A tool for adding a new display profile.
 */
export const addDisplayProfile = createTool({
  id: "add-display-profile",
  description: "Add a new display profile.",
  inputSchema: z.object({
    name: z.string().describe("The name for the new display profile."),
    type: z.string().describe("The type of the display profile (e.g., 'android', 'windows')."),
    isDefault: z.number().describe("Set to 1 if this is the default profile, otherwise 0."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/displayprofile`);
    logger.info(`Attempting to add display profile: ${context.name}`);

    try {
      const formData = new URLSearchParams();
      formData.append("name", context.name);
      formData.append("type", context.type);
      formData.append("isDefault", context.isDefault.toString());

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
        const message = `Failed to add display profile. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = displayProfileSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Display profile response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const message = `Successfully added display profile: ${validationResult.data.name}`;
      logger.info(message, { displayProfileId: validationResult.data.displayProfileId });
      return {
        success: true as const,
        data: validationResult.data,
        message,
      };
    } catch (error) {
      const message = "An unexpected error occurred while adding the display profile.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 