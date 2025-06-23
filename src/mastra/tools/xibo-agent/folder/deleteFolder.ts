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
 * @module deleteFolder
 * @description Provides a tool to delete a folder from the Xibo CMS.
 * It handles the necessary API calls and error handling for the deletion process.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for the successful response after deleting a folder.
 * A successful deletion typically returns a confirmation message.
 */
const outputSchema = z.object({
  success: z.boolean().describe("Indicates whether the deletion was successful."),
  message: z.string().describe("A confirmation message."),
});

/**
 * A tool to delete an existing folder from the Xibo CMS.
 */
export const deleteFolder = createTool({
  id: "delete-folder",
  description: "Deletes a folder from the Xibo CMS.",
  inputSchema: z.object({
    folderId: z.number().describe("The ID of the folder to delete. This is required."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const { folderId } = context;
      // Construct the API URL for deleting the specific folder.
      const url = new URL(`${config.cmsUrl}/api/folders/${folderId}`);
      logger.info(`Attempting to delete folder with ID: ${folderId}...`);

      // Perform the DELETE request.
      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      // A successful deletion often returns a 204 No Content status.
      // We check for any non-ok status to handle errors.
      if (!response.ok) {
        const responseText = await response.text();
        const decodedText = decodeErrorMessage(responseText);
        const errorMessage = `Failed to delete folder. API responded with status ${response.status}.`;
        logger.error(errorMessage, { status: response.status, response: decodedText });
        throw new Error(`${errorMessage} Message: ${decodedText}`);
      }

      // If the request was successful, log and return a success message.
      const successMessage = `Folder with ID ${folderId} deleted successfully.`;
      logger.info(successMessage);
      return {
        success: true,
        message: successMessage,
      };

    } catch (error: any) {
      // Catch and log any unexpected errors during the process.
      const errorMessage = `An unexpected error occurred in deleteFolder: ${error.message}`;
      logger.error(errorMessage, { error });
      throw error;
    }
  },
});

export default deleteFolder; 