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
 * @module editUserGroup
 * @description This module provides functionality to edit an existing user group in the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the user group data returned by the API.
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
 * Tool to edit an existing user group in the Xibo CMS.
 */
export const editUserGroup = createTool({
  id: "edit-user-group",
  description: "Edit a user group",
  inputSchema: z.object({
    userGroupId: z.number().describe("The ID of the user group to edit"),
    group: z.string().describe("The new name for the user group"),
    description: z.string().optional().describe("The new description for the user group (optional)"),
    libraryQuota: z.string().optional().describe("The new library quota in MB (optional)"),
    isSystemNotification: z.number().optional().describe("Whether to receive system notifications (0: no, 1: yes)"),
    isDisplayNotification: z.number().optional().describe("Whether to receive display notifications (0: no, 1: yes)"),
    isScheduleNotification: z.number().optional().describe("Whether to receive schedule notifications (0: no, 1: yes)"),
    isCustomNotification: z.number().optional().describe("Whether to receive custom notifications (0: no, 1: yes)"),
    isShownForAddUser: z.number().optional().describe("Whether to show in user creation (0: no, 1: yes)"),
    defaultHomePageId: z.number().optional().describe("The new default home page ID for the user group (optional)"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    logger.info(`Attempting to edit user group ID: ${context.userGroupId}`);

    try {
      const url = new URL(`${config.cmsUrl}/api/group/${context.userGroupId}`);
      
      const formData = new URLSearchParams();
      formData.append("group", context.group);
      if (context.description) formData.append("description", context.description);
      if (context.libraryQuota) formData.append("libraryQuota", context.libraryQuota);
      if (context.isSystemNotification) formData.append("isSystemNotification", context.isSystemNotification.toString());
      if (context.isDisplayNotification) formData.append("isDisplayNotification", context.isDisplayNotification.toString());
      if (context.isScheduleNotification) formData.append("isScheduleNotification", context.isScheduleNotification.toString());
      if (context.isCustomNotification) formData.append("isCustomNotification", context.isCustomNotification.toString());
      if (context.isShownForAddUser) formData.append("isShownForAddUser", context.isShownForAddUser.toString());
      if (context.defaultHomePageId) formData.append("defaultHomePageId", context.defaultHomePageId.toString());

      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const rawData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(rawData);
        const message = `Failed to edit user group. API responded with status ${response.status}`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = userGroupSchema.safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = `User group '${validationResult.data.group}' edited successfully.`;
      logger.info(message, { groupId: validationResult.data.groupId });
      return { success: true, data: validationResult.data, message };

    } catch (error) {
      const message = "An unexpected error occurred while editing the user group.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 