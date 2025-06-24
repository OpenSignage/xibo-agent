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
 * @module editUserPreferences
 * @description This module provides a tool for editing the preferences of a specific user
 * in the Xibo CMS. It allows setting various user-specific options.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

/**
 * Schema for a single user preference option.
 * Each preference consists of an option key and its corresponding value.
 */
const userOptionSchema = z.object({
  option: z.string().describe("The key of the preference option (e.g., 'designer.layouts.gridSize')."),
  value: z.string().describe("The value to set for the preference option."),
});

/**
 * Schema for the successful response from the API.
 * The API returns the updated user object upon success.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.object({
    userId: z.number(),
    userName: z.string(),
    userTypeId: z.number(),
    loggedIn: z.union([z.string(), z.number()]).nullable(),
    email: z.string().nullable(),
    homePageId: z.union([z.string(), z.number()]),
    homeFolderId: z.number(),
    lastAccessed: z.string().nullable(),
    // Add other user fields as needed from the actual API response
  }),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

/**
 * A tool for editing the preferences of a specific user in the Xibo CMS.
 * It sends a POST request with the new preference values.
 */
export const editUserPreferences = createTool({
  id: "edit-user-preferences",
  description: "Edits preferences for a specific user.",
  inputSchema: z.object({
    userId: z.number().describe("The ID of the user whose preferences are to be edited."),
    preferences: z
      .array(userOptionSchema)
      .describe("An array of preference objects to set."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context,
  }): Promise<
    z.infer<typeof successSchema> | z.infer<typeof errorSchema>
  > => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }

    const url = new URL(`${config.cmsUrl}/api/user/pref/${context.userId}`);

    logger.info(
      `Editing user preferences for user ID ${context.userId} at: ${url.toString()}`
    );

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        ...(await getAuthHeaders()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(context.preferences),
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    if (!response.ok) {
      const errorMessage = `Failed to edit user preferences: ${response.status} ${response.statusText}`;
      logger.error(errorMessage, { response: responseData });
      return {
        success: false,
        message: `${errorMessage} - ${
          typeof responseData === "string"
            ? responseData
            : JSON.stringify(responseData)
        }`,
        error: {
          statusCode: response.status,
          responseBody: responseData,
        },
      };
    }

    // Validate the response data against the schema
    const validationResult = successSchema.shape.data.safeParse(responseData);

    if (!validationResult.success) {
      const errorMessage =
        "User preferences edit response validation failed.";
      logger.error(errorMessage, {
        error: validationResult.error.issues,
        data: responseData,
      });
      return {
        success: false,
        message: errorMessage,
        error: {
          validationIssues: validationResult.error.issues,
          receivedData: responseData,
        },
      };
    }

    const successMessage = `Successfully edited preferences for user ID ${context.userId}.`;
    logger.info(successMessage, { data: validationResult.data });

    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default editUserPreferences;
