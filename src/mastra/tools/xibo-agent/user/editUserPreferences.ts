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
const responseSchema = z.object({
    userId: z.number(),
    userName: z.string(),
    userTypeId: z.number(),
    loggedIn: z.union([z.string(), z.number()]).nullable(),
    email: z.string().nullable(),
    homePageId: z.union([z.string(), z.number()]),
    homeFolderId: z.number(),
    lastAccessed: z.string().nullable(),
    // Add other user fields as needed from the actual API response
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
  outputSchema: responseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // The API endpoint for setting user preferences is typically associated with a user ID.
    // Based on setUserPreferences, the endpoint seems to be /api/user/pref.
    // However, a more RESTful approach would be /api/user/{userId}/preferences.
    // For now, we assume an endpoint that can be targeted with a POST request and a specific body structure.
    // NOTE: The reference `setUserPreferences` used `/api/user/pref`. We will adapt to a more specific endpoint.
    const url = new URL(`${config.cmsUrl}/api/user/pref/${context.userId}`);

    logger.info(`Editing user preferences for user ID ${context.userId} at: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
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
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${responseData}`,
        );
      }

      // Validate the response data against the schema
      const validationResult = responseSchema.safeParse(responseData);

      if (!validationResult.success) {
        const errorMessage = "Zod validation error editing user preferences.";
        logger.error(errorMessage, { error: validationResult.error.issues, data: responseData });
        throw new Error(errorMessage, { cause: validationResult.error });
      }

      const successMessage = `Successfully edited preferences for user ID ${context.userId}.`;
      logger.info(successMessage, { data: validationResult.data });

      return validationResult.data;
    } catch (error: any) {
      if (error instanceof Error && !(error instanceof z.ZodError)) {
        throw error;
      }

      const errorMessage =
        "An unexpected error occurred while editing user preferences.";
      logger.error(errorMessage, { error });
      throw new Error(errorMessage);
    }
  },
});

export default editUserPreferences;
