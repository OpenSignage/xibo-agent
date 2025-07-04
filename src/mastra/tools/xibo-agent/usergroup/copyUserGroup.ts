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
 * @module copyUserGroup
 * @description This module provides functionality to copy a user group in the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the copied user group data returned by the API.
 */
const userGroupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number().optional(),
  isEveryone: z.number().optional(),
  description: z.string().nullable().optional(),
  libraryQuota: z.number().nullable().optional(),
  isSystemNotification: z.number().optional(),
  isDisplayNotification: z.number().optional(),
  isDataSetNotification: z.number().optional(),
  isLayoutNotification: z.number().optional(),
  isLibraryNotification: z.number().optional(),
  isReportNotification: z.number().optional(),
  isScheduleNotification: z.number().optional(),
  isCustomNotification: z.number().optional(),
  isShownForAddUser: z.number().optional(),
  defaultHomepageId: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  buttons: z.array(z.string()).optional(),
});

/**
 * Schema for the tool's output.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: userGroupSchema,
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
 * Tool to copy a user group in the Xibo CMS.
 */
export const copyUserGroup = createTool({
  id: "copy-user-group",
  description: "Copy a user group",
  inputSchema: z.object({
    userGroupId: z.number().describe("The ID of the user group to copy"),
    group: z.string().describe("The name for the new user group"),
    copyMembers: z.number().optional().describe("Flag to copy members (1 for yes, 0 for no)"),
    copyFeatures: z.number().optional().describe("Flag to copy feature permissions (1 for yes, 0 for no)"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    logger.info(`Attempting to copy user group ID ${context.userGroupId} to a new group named '${context.group}'`);

    try {
      const url = new URL(`${config.cmsUrl}/api/group/${context.userGroupId}/copy`);
      
      const formData = new URLSearchParams();
      formData.append("group", context.group);
      if (context.copyMembers) formData.append("copyMembers", context.copyMembers.toString());
      if (context.copyFeatures) formData.append("copyFeatures", context.copyFeatures.toString());

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const rawData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(rawData);
        const message = `Failed to copy user group. API responded with status ${response.status}`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = userGroupSchema.safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = `User group copied successfully. New group ID: ${validationResult.data.groupId}`;
      logger.info(message);
      return { success: true, data: validationResult.data, message };

    } catch (error) {
      const message = "An unexpected error occurred while copying the user group.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 