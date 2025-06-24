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
 * @module editTag
 * @description Provides a tool to edit an existing tag in the Xibo CMS.
 * It implements the tag update API endpoint and handles validation for the operation.
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
 * A tool for editing an existing tag in the Xibo CMS.
 * It allows updating the tag's name, required status, and options.
 */
export const editTag = createTool({
  id: "edit-tag",
  description: "Edit an existing tag in Xibo CMS.",
  inputSchema: z.object({
    tagId: z.number().describe("The ID of the tag to edit."),
    name: z
      .string()
      .optional()
      .describe("The new name for the tag (1-50 characters)."),
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
    .describe("The result of the edit operation."),
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

    // Construct the API endpoint URL for the specific tag.
    const url = new URL(`${config.cmsUrl}/api/tag/${context.tagId}`);

    // Create the request body using URLSearchParams for form-urlencoded content.
    const params = new URLSearchParams();
    if (context.name !== undefined) params.append("name", context.name);
    if (context.isRequired !== undefined)
      params.append("isRequired", String(context.isRequired));
    if (context.options !== undefined)
      params.append("options", context.options);

    logger.info(`Editing tag ${context.tagId} at: ${url.toString()}`);

    // Perform the PUT request to the Xibo CMS API.
    const response = await fetch(url.toString(), {
      method: "PUT",
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
      const errorMessage = `Failed to edit tag. API responded with status ${response.status}.`;
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
      const errorMessage = "Edit tag response validation failed.";
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
    logger.info(`Successfully edited tag ${validationResult.data.tagId}.`);
    return {
      ...validationResult.data,
      success: true,
    };
  },
});

export default editTag; 