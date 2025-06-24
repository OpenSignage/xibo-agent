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
 * @module editFolder
 * @description Provides a tool to edit existing folders in the Xibo CMS.
 * It handles the necessary API calls, data validation, and error handling.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for the folder data returned by the API upon update.
 * The API is expected to return an array containing the updated folder object.
 */
const folderSchema = z.object({
  id: z.number().describe("The unique identifier for the folder."),
  type: z.string().nullable().describe("The type of the folder, if specified."),
  text: z.string().describe("The name of the folder."),
  parentId: z.number().nullable().describe("The ID of the parent folder."),
  isRoot: z.number().nullable().describe("Flag indicating if this is a root folder."),
  children: z
    .string()
    .nullable()
    .describe("A string representation related to child items."),
  permissionsFolderId: z
    .number()
    .nullable()
    .optional()
    .describe("The ID of the folder that defines permissions for this folder."),
});

/**
 * Defines the schema for a successful response, containing an array with the updated folder and a success flag.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z
    .array(folderSchema)
    .describe("An array containing the updated folder object."),
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
 * A tool to edit an existing folder in the Xibo CMS.
 * It primarily allows for changing the folder's name.
 */
export const editFolder = createTool({
  id: "edit-folder",
  description: "Edits an existing folder in the Xibo CMS.",
  inputSchema: z.object({
    folderId: z.number().describe("The ID of the folder to edit. This is required."),
    text: z.string().describe("The new name for the folder. This is required."),
  }),
  outputSchema: z
    .union([successSchema, errorSchema])
    .describe("An array containing the updated folder object."),
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

    // Construct the API URL for the specific folder.
    const url = new URL(`${config.cmsUrl}/api/folders/${context.folderId}`);
    logger.info(`Editing folder with ID ${context.folderId}...`);

    // Prepare the form data with the new folder name.
    const formData = new URLSearchParams();
    formData.append("text", context.text);

    // Set up the request headers, including authorization and content type.
    const headers = {
      ...(await getAuthHeaders()),
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Perform the PUT request to update the folder.
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: headers,
      body: formData.toString(),
    });

    const responseText = await response.text();
    let responseData: any;

    // Try to parse the response as JSON, but fall back to text if it fails.
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    // Handle non-successful HTTP responses.
    if (!response.ok) {
      const decodedText = decodeErrorMessage(responseText);
      const errorMessage = `Failed to edit folder. API responded with status ${response.status}.`;
      logger.error(errorMessage, {
        status: response.status,
        response: decodedText,
      });
      return {
        success: false,
        message: `${errorMessage} Message: ${decodedText}`,
        error: {
          statusCode: response.status,
          responseBody: decodedText,
        },
      };
    }

    // Validate the structure of the successful response.
    const validationResult = z.array(folderSchema).safeParse(responseData);

    if (!validationResult.success) {
      const errorMessage = "Folder edit response validation failed.";
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

    // Log the success and return the validated data.
    logger.info(
      `Folder with ID ${context.folderId} updated successfully to name '${validationResult.data[0].text}'.`
    );
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default editFolder; 