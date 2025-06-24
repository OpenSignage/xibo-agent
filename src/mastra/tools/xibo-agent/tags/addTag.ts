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
 * @module addTag
 * @description Provides a tool to add a new tag to the Xibo CMS.
 * It implements the tag creation API endpoint and handles the necessary validation.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a single tag record, used for API responses.
 * This ensures that data received from the Xibo API conforms to the expected structure.
 */
const tagSchema = z.object({
  tagId: z.number().describe("The unique ID of the tag."),
  tag: z.string().describe("The name or value of the tag."),
  isSystem: z
    .number()
    .describe("A flag indicating if the tag is a system tag (1 for yes, 0 for no)."),
  isRequired: z
    .number()
    .describe("A flag indicating if the tag is required (1 for yes, 0 for no)."),
  options: z
    .string()
    .nullable()
    .optional()
    .describe("Optional predefined values for the tag, if any."),
});

/**
 * Defines the schema for a successful operation, combining the tag data with a success flag.
 */
const successSchema = tagSchema.extend({
  success: z.literal(true),
});

/**
 * Defines the schema for a failed operation, including a success flag, a message, and optional error details.
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
 * A tool for adding a new tag to the Xibo CMS.
 * It allows specifying the tag's name, required status, and options upon creation.
 */
export const addTag = createTool({
  id: "add-tag",
  description: "Add a new tag to Xibo CMS.",
  inputSchema: z.object({
    name: z
      .string()
      .min(1, { message: "Tag name must be at least 1 character long." })
      .max(50, { message: "Tag name must be 50 characters or less." })
      .describe("The name for the new tag (1-50 characters)."),
    isRequired: z
      .number()
      .optional()
      .describe("Set the tag as required (0 for optional, 1 for required)."),
    options: z
      .string()
      .optional()
      .describe("A JSON string representing an array of tag options."),
  }),
  outputSchema: z
    .union([successSchema, errorSchema])
    .describe("The result of the add operation."),
  execute: async ({
    context,
  }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    // Ensure the CMS URL is configured before proceeding.
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
      };
    }

    try {
      // Construct the API endpoint URL for adding a tag.
      const url = new URL(`${config.cmsUrl}/api/tag`);

      // Create the request body using URLSearchParams for form-urlencoded content.
      const params = new URLSearchParams();
      params.append("name", context.name);
      if (context.isRequired !== undefined)
        params.append("isRequired", String(context.isRequired));
      if (context.options !== undefined)
        params.append("options", context.options);

      logger.info("Parameters being sent to addTag API:", {
        body: params.toString(),
      });
      logger.info(`Adding new tag at: ${url.toString()}`);

      // Perform the POST request to the Xibo CMS API.
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      // Read the response body as text to handle various response formats.
      const responseText = await response.text();
      let responseData: any;

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      // Handle non-successful HTTP responses.
      if (!response.ok) {
        const decodedText = decodeErrorMessage(responseText);
        const errorMessage = `Failed to add tag. API responded with status ${response.status}.`;
        logger.error(errorMessage, {
          status: response.status,
          response: decodedText,
        });
        return {
          success: false,
          message: `${errorMessage} Message: ${decodedText}`,
          error: {
            statusCode: response.status,
            responseBody: responseData,
          },
        };
      }

      // Validate the structure of the successful response data.
      const validationResult = tagSchema.safeParse(responseData);

      if (!validationResult.success) {
        const errorMessage = "Add tag response validation failed.";
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

      // On success, log and return the validated data.
      logger.info(`Successfully added tag ${validationResult.data.tagId}.`);
      return {
        ...validationResult.data,
        success: true,
      };
    } catch (error: any) {
      // Catch any other errors, log them, and return a structured error response.
      const errorMessage = `An unexpected error occurred in addTag: ${
        error.message
      }`;
      logger.error(errorMessage, { error });
      return {
        success: false,
        message: errorMessage,
        error,
      };
    }
  },
});

export default addTag; 