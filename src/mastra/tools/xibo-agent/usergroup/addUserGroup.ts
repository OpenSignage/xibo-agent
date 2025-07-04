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
 * @module addUserGroup
 * @description This module provides functionality to create new user groups
 * in the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { userGroupSchema } from "./schemas";

/**
 * Schema for the tool's output.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(userGroupSchema),
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
 * Tool to create a new user group in the Xibo CMS.
 */
export const addUserGroup = createTool({
  id: "add-user-group",
  description: "Add a new user group to Xibo CMS",
  inputSchema: z.object({
    group: z.string().describe("Name of the user group to be created"),
    description: z.string().optional().describe("Description of the user group (optional)"),
    libraryQuota: z.string().optional().describe("Library quota in MB (optional)"),
    isSystemNotification: z.number().optional().describe("Whether to receive system notifications (0: no, 1: yes)"),
    isDisplayNotification: z.number().optional().describe("Whether to receive display notifications (0: no, 1: yes)"),
    isScheduleNotification: z.number().optional().describe("Whether to receive schedule notifications (0: no, 1: yes)"),
    isCustomNotification: z.number().optional().describe("Whether to receive custom notifications (0: no, 1: yes)"),
    isShownForAddUser: z.number().optional().describe("Whether to show in user creation (0: no, 1: yes)"),
    defaultHomePageId: z.number().optional().describe("Default home page ID for the user group (optional)"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    logger.info(`Attempting to add user group: ${context.group}`);

    try {
      const url = new URL(`${config.cmsUrl}/api/group`);
      
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
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(rawData);
        const message = `Failed to create user group. API responded with status ${response.status}`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const userGroups = Array.isArray(rawData) ? rawData : [rawData];
      const validationResult = z.array(userGroupSchema).safeParse(userGroups);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = `User group '${validationResult.data[0].group}' created successfully.`;
      logger.info(message, { groupId: validationResult.data[0].groupId });
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while creating the user group.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 