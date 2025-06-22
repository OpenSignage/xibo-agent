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
 * @module editUser
 * @description This module provides a tool to edit existing users in the Xibo CMS system.
 * It implements the user edit API endpoint and handles the necessary validation
 * and data transformation for updating user settings and permissions.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { base64Encode } from "../utility/encoding";

// =================================================================
// Schema Definitions (from getUser for response validation)
// =================================================================

const tagSchema = z.object({
  tag: z.string(),
  tagId: z.number(),
  value: z.string().optional(),
});

const permissionSchema = z.object({
  permissionId: z.number(),
  entityId: z.number(),
  groupId: z.number(),
  objectId: z.number(),
  isUser: z.number(),
  entity: z.string(),
  objectIdString: z.string(),
  group: z.string(),
  view: z.number(),
  edit: z.number(),
  delete: z.number(),
  modifyPermissions: z.number(),
});

const groupSchema = z.object({
  groupId: z.number(),
  group: z.string(),
  isUserSpecific: z.number(),
  isEveryone: z.number(),
  description: z.string().nullable(),
  libraryQuota: z.number(),
  isSystemNotification: z.number(),
  isDisplayNotification: z.number(),
  isDataSetNotification: z.number(),
  isLayoutNotification: z.number(),
  isLibraryNotification: z.number(),
  isReportNotification: z.number(),
  isScheduleNotification: z.number(),
  isCustomNotification: z.number(),
  isShownForAddUser: z.number(),
  defaultHomepageId: z.string().nullable(),
  features: z.array(z.string()),
  buttons: z.array(z.unknown()).optional(),
});

const userSchema = z.object({
    userId: z.number(),
    userName: z.string(),
    userTypeId: z.number(),
    loggedIn: z.union([z.string(), z.number()]).nullable(),
    email: z.string().nullable(),
    homePageId: z.union([z.string(), z.number()]),
    homeFolderId: z.number(),
    lastAccessed: z.string().nullable(),
    newUserWizard: z.number(),
    retired: z.number(),
    isPasswordChangeRequired: z.number(),
    groupId: z.number(),
    group: z.union([z.string(), z.number()]),
    libraryQuota: z.number(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
    ref1: z.string().nullable(),
    ref2: z.string().nullable(),
    ref3: z.string().nullable(),
    ref4: z.string().nullable(),
    ref5: z.string().nullable(),
    groups: z.array(groupSchema),
    isSystemNotification: z.number(),
    isDisplayNotification: z.number(),
    isDataSetNotification: z.number(),
    isLayoutNotification: z.number(),
    isLibraryNotification: z.number(),
    isReportNotification: z.number(),
    isScheduleNotification: z.number(),
    isCustomNotification: z.number(),
    twoFactorTypeId: z.number(),
    twoFactorSecret: z.string().optional(),
    twoFactorRecoveryCodes: z.array(z.string()).optional(),
    homeFolder: z.string().optional(),
    permissions: z.array(permissionSchema).optional(),
});

const successResponseSchema = z.object({
    success: z.literal(true),
    data: userSchema.describe("The updated user object."),
    message: z.string(),
});

const errorResponseSchema = z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

export const editUser = createTool({
  id: "edit-user",
  description: "Edits an existing user in the Xibo CMS.",
  inputSchema: z.object({
    userId: z.number().describe("ID of the user to be edited. This is required."),
    userName: z.string().optional().describe("A new username for the user."),
    userTypeId: z.number().optional().describe("The ID of the new user type for this user."),
    groupId: z.number().optional().describe("The ID of the new group for this user."),
    homePageId: z.string().optional().describe("The new home page for this user (e.g., 'dashboard', 'status', etc.)."),
    homeFolderId: z.number().optional().describe("The ID of the folder to be used as the user's home folder."),
    newPassword: z.string().optional().describe("A new password for the user. Must be provided with retypeNewPassword."),
    retypeNewPassword: z.string().optional().describe("Confirmation of the new password. Must match newPassword."),
    retired: z.number().optional().describe("Set to 1 to retire the user, or 0 to un-retire."),
    newUserWizard: z.number().optional().describe("Set to 1 to show the new user wizard on next login, or 0 to hide it."),
    hideNavigation: z.number().optional().describe("Set to 1 to hide the top navigation bar, or 0 to show it."),
    firstName: z.string().optional().describe("The user's first name."),
    lastName: z.string().optional().describe("The user's last name."),
    email: z.string().optional().describe("The user's email address."),
    libraryQuota: z.number().optional().describe("The library storage quota in megabytes (MB)."),
    isPasswordChangeRequired: z.number().optional().describe("Set to 1 to force a password change on the next login, 0 otherwise."),
    phone: z.string().optional().describe("The user's phone number."),
    ref1: z.string().optional().describe("A user-definable reference field."),
    ref2: z.string().optional().describe("A user-definable reference field."),
    ref3: z.string().optional().describe("A user-definable reference field."),
    ref4: z.string().optional().describe("A user-definable reference field."),
    ref5: z.string().optional().describe("A user-definable reference field."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    if (context.newPassword !== context.retypeNewPassword) {
        const message = "Passwords do not match.";
        logger.error(message);
        return { success: false as const, message };
    }

    try {
        const url = `${config.cmsUrl}/api/user/${context.userId}`;
        const formData = new URLSearchParams();
        
        // A helper function to append parameters if they exist in the context
        const appendIfExists = (key: string, value: any, transform?: (v: any) => string) => {
            if (value !== undefined && value !== null) {
                formData.append(key, transform ? transform(value) : String(value));
            }
        };

        // Append all optional parameters from context to formData
        appendIfExists("userName", context.userName);
        appendIfExists("userTypeId", context.userTypeId);
        appendIfExists("homePageId", context.homePageId);
        appendIfExists("homeFolderId", context.homeFolderId);
        appendIfExists("retired", context.retired);
        appendIfExists("groupId", context.groupId);
        appendIfExists("newUserWizard", context.newUserWizard);
        appendIfExists("hideNavigation", context.hideNavigation);
        appendIfExists("firstName", context.firstName);
        appendIfExists("lastName", context.lastName);
        appendIfExists("email", context.email);
        appendIfExists("libraryQuota", context.libraryQuota);
        appendIfExists("isPasswordChangeRequired", context.isPasswordChangeRequired);
        appendIfExists("phone", context.phone);
        appendIfExists("ref1", context.ref1);
        appendIfExists("ref2", context.ref2);
        appendIfExists("ref3", context.ref3);
        appendIfExists("ref4", context.ref4);
        appendIfExists("ref5", context.ref5);
        appendIfExists("newPassword", context.newPassword, base64Encode);
        appendIfExists("retypeNewPassword", context.retypeNewPassword, base64Encode);
        
        logger.debug(`Attempting to edit user ${context.userId} with data:`, { body: formData.toString() });

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                ...(await getAuthHeaders()),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
        });

        const responseText = await response.text();
        let responseData: any = null;
        try {
            responseData = responseText ? JSON.parse(responseText) : null;
        } catch (e) {
            responseData = responseText;
        }

        if (!response.ok) {
            const message = `Failed to edit user. API responded with status ${response.status}`;
            logger.error(message, { status: response.status, response: responseData });
            return { success: false as const, message, errorData: responseData };
        }

        const validationResult = userSchema.safeParse(responseData);

        if (!validationResult.success) {
            const message = "API call succeeded, but response validation failed.";
            logger.error(message, { error: validationResult.error, data: responseData });
            return { success: false as const, message, error: validationResult.error, errorData: responseData };
        }
        
        const message = `User '${validationResult.data.userName}' (ID: ${context.userId}) was updated successfully.`;
        logger.info(message, { data: validationResult.data });
        return { success: true, data: validationResult.data, message };

    } catch (error) {
        const message = `An unexpected error occurred while editing user ${context.userId}.`;
        logger.error(message, { error });
        return {
            success: false as const,
            message,
            error: error instanceof Error ? { name: error.name, message: error.message } : error,
        };
    }
  },
});

export default editUser; 