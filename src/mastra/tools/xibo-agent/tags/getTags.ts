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
 * @module getTags
 * @description Provides a tool to retrieve and search for tags within the Xibo CMS.
 * It implements the tag API endpoint and handles validation and error handling for tag operations.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a single tag record.
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
 * Defines the schema for a successful response, containing an array of tags and a success flag.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: z.array(tagSchema).describe("An array of tag records."),
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
 * A tool for retrieving tags from the Xibo CMS.
 * It supports filtering tags by various criteria such as ID, name, or system status.
 */
export const getTags = createTool({
  id: "get-tags",
  description: "Search and retrieve tags from Xibo CMS.",
  inputSchema: z.object({
    tagId: z.number().optional().describe("Filter by a specific tag ID."),
    tag: z
      .string()
      .optional()
      .describe("Filter by a partial match on the tag name."),
    exactTag: z
      .string()
      .optional()
      .describe("Filter by an exact match on the tag name."),
    isSystem: z
      .number()
      .optional()
      .describe("Filter by system tag status (0 for non-system, 1 for system)."),
    isRequired: z
      .number()
      .optional()
      .describe("Filter by required tag status (0 for optional, 1 for required)."),
    haveOptions: z
      .number()
      .optional()
      .describe(
        "Filter for tags that have predefined options (1 for yes, 0 for no)."
      ),
  }),
  outputSchema: z
    .union([successSchema, errorSchema])
    .describe("The result of the get operation."),
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

    // Construct the API endpoint URL for tags.
    const url = new URL(`${config.cmsUrl}/api/tag`);

    // Helper function to append a query parameter to the URL only if it has a value.
    const appendIfExists = (key: string, value: any) => {
      if (value !== undefined && value !== null) {
        const stringValue = String(value);
        if (stringValue !== "") {
          url.searchParams.append(key, stringValue);
        }
      }
    };

    // Dynamically build the query string from the tool's input context.
    appendIfExists("tagId", context.tagId);
    appendIfExists("tag", context.tag);
    appendIfExists("exactTag", context.exactTag);
    appendIfExists("isSystem", context.isSystem);
    appendIfExists("isRequired", context.isRequired);
    appendIfExists("haveOptions", context.haveOptions);

    logger.info(`Requesting tags from: ${url.toString()}`);

    // Perform the GET request to the Xibo CMS API.
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
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
      const errorMessage = `Failed to get tags. API responded with status ${response.status}.`;
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

    // The Xibo API can return tags as a direct array or wrapped in a data object.
    // This handles both cases by extracting the array if it's nested.
    const dataToValidate = Array.isArray(responseData)
      ? responseData
      : responseData?.data;

    // Validate the structure of the successful response data.
    const validationResult = z.array(tagSchema).safeParse(dataToValidate);

    if (!validationResult.success) {
      const errorMessage = "Tags response validation failed.";
      logger.error(errorMessage, {
        error: validationResult.error.issues,
        data: dataToValidate,
      });
      return {
        success: false,
        message: errorMessage,
        error: {
          validationIssues: validationResult.error.issues,
          receivedData: dataToValidate,
        },
      };
    }

    // On success, check if any tags were actually found.
    if (validationResult.data.length === 0) {
      const errorMessage = "Tag not found.";
      logger.info(errorMessage, { context });
      return {
        success: false,
        message: errorMessage,
      };
    }

    // On success, log and return the validated data.
    logger.info(
      `Successfully retrieved ${validationResult.data.length} tag records.`
    );
    return {
      success: true,
      data: validationResult.data,
    };
  },
});

export default getTags; 