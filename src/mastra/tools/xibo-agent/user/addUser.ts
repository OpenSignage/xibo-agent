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
 * @module addUser
 * @description This module provides a tool to create a new user in the Xibo CMS.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import {
  userSchema,
} from './schemas';
import { base64Encode } from '../utility/encoding';
import { decodeErrorMessage } from '../utility/error';

// Schema for a successful response, which contains the newly created user object.
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

type Output = z.infer<typeof outputSchema>;


/**
 * @tool addUser
 * @description A tool for creating a new user in the Xibo CMS.
 */
export const addUser = createTool({
  id: 'add-user',
  description: 'Add a new user to Xibo CMS.',
  inputSchema: z.object({
    userName: z.string().describe('The User Name.'),
    password: z.string().describe('The users password.'),
    userTypeId: z.number().describe('The user type ID.'),
    groupId: z.number().describe('The initial user group for this User.'),
    homePageId: z.number().describe('The homepage to use for this User.'),
    newUserWizard: z.number().min(0).max(1).describe('Flag indicating whether to show the new user guide.'),
    hideNavigation: z.number().min(0).max(1).describe('Flag indicating whether to hide the navigation.'),
    email: z.string().optional().describe('The user email address.'),
    libraryQuota: z.number().optional().describe('The users library quota in kilobytes.'),
    isRetired: z.number().min(0).max(1).optional().describe('Set user as retired (0 or 1, optional).'),
    isLocked: z.number().min(0).max(1).optional().describe('Set user as locked (0 or 1, optional).'),
    isPasswordChangeRequired: z.number().min(0).max(1).optional().describe('A flag indicating whether password change should be forced for this user.'),
    firstName: z.string().optional().describe("User's first name (optional)."),
    lastName: z.string().optional().describe("User's last name (optional)."),
    phone: z.string().optional().describe("Phone number for the user (optional)."),
    ref1: z.string().optional().describe('Reference 1 for the user (optional).'),
    ref2: z.string().optional().describe('Reference 2 for the user (optional).'),
    ref3: z.string().optional().describe('Reference 3 for the user (optional).'),
    ref4: z.string().optional().describe('Reference 4 for the user (optional).'),
    ref5: z.string().optional().describe('Reference 5 for the user (optional).'),
  }),
  outputSchema,
  execute: async ({ context }): Promise<Output> => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/user`);
    const formData = new URLSearchParams();

    // Map context to form data, encoding password
    Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
            if (key === 'password') {
                formData.append(key, base64Encode(value as string));
            } else {
                formData.append(key, String(value));
            }
        }
    });

    try {
      logger.info({ userName: context.userName }, 'Attempting to create user.');

      const headers = {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: formData.toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to add user. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false, message, errorData: decodedError };
      }

      const validationResult = userSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Add user response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false, message, error: validationResult.error, errorData: responseData };
      }

      logger.info({ user: validationResult.data }, `User '${validationResult.data.userName}' created successfully.`);
      return { success: true, data: validationResult.data };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while adding the user.';
      logger.error({ error }, message);
      return {
        success: false,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 