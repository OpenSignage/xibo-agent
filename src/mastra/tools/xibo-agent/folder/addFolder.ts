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
 * @module addFolder
 * @description Provides a tool to create new folders in the Xibo CMS.
 * It handles the necessary API calls, data validation, and error handling.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for the folder data returned by the API upon creation.
 * The API is expected to return an array containing the newly created folder object.
 */
const folderSchema = z.object({
  id: z.number().describe("The unique identifier for the newly created folder."),
  type: z.string().nullable().describe("The type of the folder, if specified."),
  text: z.string().describe("The name of the folder."),
  parentId: z.number().nullable().describe("The ID of the parent folder."),
  isRoot: z.number().nullable().describe("Flag indicating if this is a root folder."),
  children: z
    .string()
    .nullable()
    .describe("A string representation related to child items, typically null on creation."),
  permissionsFolderId: z
    .number()
    .nullable()
    .optional()
    .describe("The ID of the folder that defines permissions for this folder."),
});

/**
 * Defines the schema for a successful response, containing an array with the new folder and a success flag.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z
    .array(folderSchema)
    .describe("An array containing the newly created folder object."),
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
 * A tool to create a new folder in the Xibo CMS.
 * It takes a folder name and an optional parent ID as input.
 */
export const addFolder = createTool({
  id: "add-folder",
  description: "Adds a new folder to the Xibo CMS.",
  inputSchema: z.object({
    text: z.string().describe("The name for the new folder. This is required."),
    parentId: z
      .number()
      .optional()
      .describe("The ID of the parent folder. If omitted, it will be a root folder."),
  }),
  outputSchema: z
    .union([successSchema, errorSchema])
    .describe("An array containing the newly created folder object."),
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

    // Construct the API URL for creating folders.
    const url = new URL(`${config.cmsUrl}/api/folders`);
    logger.info(`Creating folder '${context.text}'...`);

    // Prepare the form data with the new folder's name and optional parent ID.
    const formData = new URLSearchParams();
    formData.append("text", context.text);
    if (context.parentId) {
      formData.append("parentId", String(context.parentId));
    }

    // Set up the request headers, including authorization and content type.
    const headers = {
      ...(await getAuthHeaders()),
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Perform the POST request to create the folder.
    const response = await fetch(url.toString(), {
      method: "POST",
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
      const errorMessage = `Failed to create folder. API responded with status ${response.status}.`;
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
      const errorMessage = "Folder creation response validation failed.";
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
      `Folder '${validationResult.data[0].text}' created successfully with ID: ${validationResult.data[0].id}.`
    );
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default addFolder; 