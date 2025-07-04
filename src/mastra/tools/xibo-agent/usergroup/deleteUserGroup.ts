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
 * @module deleteUserGroup
 * @description This module provides functionality to delete a user group from the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the tool's output.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
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
 * Tool to delete a user group from the Xibo CMS.
 */
export const deleteUserGroup = createTool({
  id: "delete-user-group",
  description: "Delete a user group",
  inputSchema: z.object({
    userGroupId: z.number().describe("The ID of the user group to delete"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    logger.info(`Attempting to delete user group ID: ${context.userGroupId}`);

    try {
      const url = new URL(`${config.cmsUrl}/api/group/${context.userGroupId}`);
      
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (response.status === 204) {
        const message = `User group ID ${context.userGroupId} deleted successfully.`;
        logger.info(message);
        return { success: true, message };
      }

      const rawData = await response.json();
      
      if (!response.ok) {
        const decodedError = decodeErrorMessage(rawData);
        const message = `Failed to delete user group. API responded with status ${response.status}`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      // Should not happen for a DELETE request if successful
      const message = "User group deleted, but with an unexpected response.";
      logger.warn(message, { userGroupId: context.userGroupId, data: rawData });
      return { success: true, message };

    } catch (error) {
      const message = "An unexpected error occurred while deleting the user group.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 