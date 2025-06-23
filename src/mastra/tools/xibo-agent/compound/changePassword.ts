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
 * @module changePassword
 * @description A compound tool that changes a user's password in the Xibo CMS.
 * It orchestrates calls to `getUser` and `editUser` to perform the action safely.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { logger } from "../../../index";
import { getUser } from "../user/getUser";
import { editUser } from "../user/editUser";

/**
 * A compound tool to change a user's password.
 * This tool first fetches the user's current data to ensure all required fields
 * are present when calling the `editUser` tool.
 */
export const changePassword = createTool({
  id: "change-password",
  description: "Changes the password for a specified user.",
  inputSchema: z.object({
    userId: z.number().describe("The ID of the user whose password will be changed."),
    newPassword: z.string().describe("The new password."),
    retypeNewPassword: z.string().describe("Confirmation of the new password."),
  }),
  // The output schema will be the same as the `editUser` tool's output.
  outputSchema: editUser.outputSchema,
  execute: async ({ context, runtimeContext }) => {
    const { userId, newPassword, retypeNewPassword } = context;

    // Basic validation to ensure passwords match before making any API calls.
    if (newPassword !== retypeNewPassword) {
      const errorMessage = "Passwords do not match.";
      logger.error(errorMessage);
      // We return a structured error response that matches the potential output of editUser.
      return { success: false as const, message: errorMessage };
    }

    logger.info(`Starting password change process for user ID: ${userId}`);

    try {
      // Step 1: Get the current user data using the `getUser` tool.
      logger.info(`Fetching current data for user ID: ${userId}`);
      const userResponse = await getUser.execute({
        context: { userId, treeView: false },
        runtimeContext,
      });

      // Handle cases where the getUser tool fails or returns no data.
      if (!userResponse.success || !userResponse.data) {
        const errorMessage = `Failed to get user data for ID ${userId}. Reason: ${userResponse.message || 'Unknown error'}`;
        logger.error(errorMessage, { response: userResponse });
        return { success: false as const, message: errorMessage, errorData: userResponse };
      }
      
      // The `data` property from the response contains the array of users.
      const userData = Array.isArray(userResponse.data) ? userResponse.data[0] : null;

      if (!userData) {
          const errorMessage = `User with ID ${userId} not found in the response data.`;
          logger.error(errorMessage, { response: userResponse });
          return { success: false as const, message: errorMessage };
      }
      
      logger.info(`Successfully fetched data for user: ${userData.userName}`);

      // Step 2: Call the `editUser` tool with the fetched data and the new password.
      logger.info(`Calling editUser to update password for user ID: ${userId}`);

      // Construct the parameters for editUser based on required fields.
      const editUserParams = {
        userId: userData.userId,
        userName: userData.userName,
        userTypeId: userData.userTypeId,
        homePageId: String(userData.homePageId),
        newUserWizard: 0,
        hideNavigation: 0,
        newPassword,
        retypeNewPassword,
      };
      
      const editResponse = await editUser.execute({ context: editUserParams, runtimeContext });

      if (editResponse.success) {
        logger.info(`Successfully changed password for user ID: ${userId}`);
      } else {
        logger.error(`Failed to change password for user ID: ${userId}`, { error: editResponse });
      }

      return editResponse;

    } catch (error: any) {
      const errorMessage = "An unexpected error occurred during the password change process.";
      logger.error(errorMessage, {
        error: error instanceof Error ? error.message : error,
      });
      return {
        success: false as const,
        message: errorMessage,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default changePassword;
