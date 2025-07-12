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
 * @description This module provides a tool to edit an existing user in the Xibo CMS.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import {
  userSchema,
} from './schemas';
import { base64Encode } from '../utility/encoding';

// Schema for a successful response, containing the updated user object.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: userSchema,
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, which can be a success or error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * @tool editUser
 * @description A tool for editing an existing user in the Xibo CMS.
 */
export const editUser = createTool({
  id: 'edit-user',
  description: 'Edits an existing user in the Xibo CMS.',
  inputSchema: z.object({
    userId: z.number().describe('ID of the user to be edited. This is required.'),
    userName: z.string().optional().describe('A new username for the user.'),
    userTypeId: z.number().optional().describe('The ID of the new user type for this user.'),
    userGroupId: z.number().optional().describe('The ID of the new group for this user.'),
    homePage: z.string().optional().describe("The new home page for this user (e.g., 'dashboard', 'status', etc.)."),
    newPassword: z.string().optional().describe('A new password for the user. Must be provided with retypeNewPassword.'),
    retypeNewPassword: z.string().optional().describe('Confirmation of the new password. Must match newPassword.'),
    isRetired: z.number().min(0).max(1).optional().describe('Set to 1 to retire the user, or 0 to un-retire.'),
    email: z.string().email().optional().describe("The user's email address."),
    libraryQuota: z.number().optional().describe('The library storage quota in megabytes (MB).'),
    firstName: z.string().optional().describe("The user's first name."),
    lastName: z.string().optional().describe("The user's last name."),
    phone: z.string().optional().describe("The user's phone number."),
    ref1: z.string().optional().describe('A user-definable reference field.'),
    ref2: z.string().optional().describe('A user-definable reference field.'),
    ref3: z.string().optional().describe('A user-definable reference field.'),
    ref4: z.string().optional().describe('A user-definable reference field.'),
    ref5: z.string().optional().describe('A user-definable reference field.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    if (context.newPassword !== context.retypeNewPassword) {
        const message = 'Passwords do not match.';
        logger.error(message);
        return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/user/${context.userId}`);
    const formData = new URLSearchParams();
    
    // Dynamically build the form data from the tool's input context.
    const { userId, newPassword, retypeNewPassword, userGroupId, ...rest } = context;
    
    Object.entries(rest).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    if (newPassword) {
      formData.append('newPassword', base64Encode(newPassword));
      formData.append('retypeNewPassword', base64Encode(retypeNewPassword!));
    }
    
    if (userGroupId) {
        formData.append('groupId', String(userGroupId));
    }

    try {
      logger.info({ userId: context.userId }, 'Attempting to edit user.');

      const response = await fetch(url.toString(), {
        method: 'PUT',
        headers: {
            ...(await getAuthHeaders()),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to edit user. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError, userId: context.userId }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = userSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Edit user response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error, errorData: responseData };
      }
      
      logger.info({ user: validationResult.data }, `User (ID: ${context.userId}) was updated successfully.`);
      return { success: true as const, data: validationResult.data };
    } catch (error: unknown) {
      const message = `An unexpected error occurred while editing user ${context.userId}.`;
      logger.error({ error, userId: context.userId }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 