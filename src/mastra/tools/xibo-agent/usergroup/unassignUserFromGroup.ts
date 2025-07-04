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
 * @module unassignUserFromGroup
 * @description This module provides functionality to unassign users from a user group
 * in the Xibo CMS.
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
 * Tool to unassign users from a user group in the Xibo CMS.
 */
export const unassignUserFromGroup = createTool({
  id: "unassign-user-from-group",
  description: "Unassign users from a user group",
  inputSchema: z.object({
    userGroupId: z.number().describe("The ID of the user group"),
    userIds: z.array(z.number()).describe("An array of user IDs to unassign"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    logger.info(`Attempting to unassign ${context.userIds.length} user(s) from group ID: ${context.userGroupId}`);

    try {
      const url = new URL(`${config.cmsUrl}/api/group/members/unassign/${context.userGroupId}`);
      
      const formData = new URLSearchParams();
      context.userIds.forEach(id => {
        formData.append("users[]", id.toString());
      });

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      // Successful unassignment returns a 204 No Content with an empty body
      if (response.status === 204) {
        const message = `Users unassigned from group ID ${context.userGroupId} successfully.`;
        logger.info(message);
        return { success: true, message };
      }

      const rawData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(rawData);
        const message = `Failed to unassign users. API responded with status ${response.status}`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }
      
      const message = "Users unassigned from group, but with an unexpected response.";
      logger.warn(message, { userGroupId: context.userGroupId, data: rawData });
      return { success: true, message };

    } catch (error) {
      const message = "An unexpected error occurred while unassigning users from the group.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 