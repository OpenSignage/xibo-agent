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
 * @module getStats
 * @description Provides a tool to retrieve and search statistics data from the Xibo CMS.
 * It implements the statistics API endpoint and handles validation and error handling.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a single statistics data record.
 * This ensures that the data received from the Xibo API conforms to the expected structure.
 */
const statisticsDataSchema = z.object({
  type: z.string().describe("The type of stat record (e.g., 'Layout', 'Media')."),
  display: z.string().describe("The name of the display."),
  displayId: z.number().describe("The ID of the display."),
  layout: z.string().optional().describe("The name of the layout."),
  layoutId: z.number().optional().describe("The ID of the layout."),
  media: z.string().optional().describe("The name of the media."),
  mediaId: z.number().optional().describe("The ID of the media."),
  widgetId: z.number().optional().describe("The ID of the widget."),
  scheduleId: z.number().optional().describe("The ID of the schedule entry."),
  numberPlays: z.number().describe("The number of times the item was played."),
  duration: z.number().describe("The duration of the playback in seconds."),
  start: z.string().describe("The start date and time of the statistics period."),
  end: z.string().describe("The end date and time of the statistics period."),
  statDate: z.string().describe("The date the statistic was recorded."),
  tag: z.string().optional().describe("Any tag associated with the item."),
});

/**
 * Schema for the tool's output.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(statisticsDataSchema),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * A tool for retrieving statistics data from the Xibo CMS.
 * It supports a wide range of filters to search and retrieve specific statistics.
 */
export const getStats = createTool({
  id: "get-stats",
  description: "Search and retrieve statistics data from Xibo CMS.",
  inputSchema: z.object({
    type: z.enum(["Layout", "Media", "Widget"]).optional().describe("The type of stat to return. Can be 'Layout', 'Media', or 'Widget'."),
    fromDt: z.string().optional().describe("The start date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS'). Defaults to 24 hours ago."),
    toDt: z.string().optional().describe("The end date for the filter (e.g., 'YYYY-MM-DD HH:MM:SS'). Defaults to the current time."),
    statDate: z.string().optional().describe("Filter for records on or after a specific date (YYYY-MM-DD)."),
    statId: z.string().optional().describe("Filter for records with a statId greater than the specified value."),
    displayId: z.number().optional().describe("Filter by a single Display ID."),
    displayIds: z.array(z.number()).optional().describe("Filter by a list of Display IDs."),
    layoutId: z.array(z.number()).optional().describe("Filter by a list of Layout IDs."),
    parentCampaignId: z.array(z.number()).optional().describe("Filter by a list of parent Campaign IDs."),
    mediaId: z.array(z.number()).optional().describe("Filter by a list of Media IDs."),
    campaignId: z.number().optional().describe("Filter by a single Campaign ID."),
    returnDisplayLocalTime: z.string().optional().describe("Return results in the display's local time. Use 'on', '1', or 'true'."),
    returnDateFormat: z.string().optional().describe("A PHP-style date format string for how the returned dates should be formatted."),
    embed: z.array(z.enum(["layoutTags", "displayTags", "mediaTags"])).optional().describe("Embed additional data. Options include: 'layoutTags', 'displayTags', 'mediaTags'."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    // Ensure the CMS URL is configured before proceeding.
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      return {
        success: false as const,
        message: errorMessage,
      };
    }

    // Construct the API endpoint URL.
    const url = new URL(`${config.cmsUrl}/api/stats`);

    // Helper function to append a query parameter to the URL only if it has a value.
    // This keeps the resulting URL clean and avoids sending empty parameters.
    const appendIfExists = (key: string, value: any) => {
      if (value !== undefined && value !== null) {
        const stringValue = String(value);
        if (stringValue !== "") {
          url.searchParams.append(key, stringValue);
        }
      }
    };

    // Dynamically build the query string from the tool's input context.
    appendIfExists("type", context.type);
    appendIfExists("fromDt", context.fromDt);
    appendIfExists("toDt", context.toDt);
    appendIfExists("statDate", context.statDate);
    appendIfExists("statId", context.statId);
    appendIfExists("displayId", context.displayId);
    appendIfExists("displayIds", context.displayIds);
    appendIfExists("layoutId", context.layoutId);
    appendIfExists("parentCampaignId", context.parentCampaignId);
    appendIfExists("mediaId", context.mediaId);
    appendIfExists("campaignId", context.campaignId);
    appendIfExists("returnDisplayLocalTime", context.returnDisplayLocalTime);
    appendIfExists("returnDateFormat", context.returnDateFormat);
    appendIfExists("embed", context.embed);

    logger.info(`Requesting statistics from: ${url.toString()}`);

    // Perform the GET request to the Xibo CMS API.
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    // Read the response body as text first to handle both JSON and non-JSON error messages.
    const responseText = await response.text();
    let responseData: any;

    // Attempt to parse the response as JSON. If it fails, use the raw text.
    // This is crucial for capturing non-JSON error details from the API.
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }

    // Handle non-successful HTTP responses.
    if (!response.ok) {
      const decodedText = decodeErrorMessage(responseText);
      const message = `Failed to get statistics. API responded with status ${response.status}.`;
      logger.error(message, {
        status: response.status,
        response: decodedText,
      });
      return {
        success: false as const,
        message: message,
        errorData: responseData,
      };
    }

    // Validate the structure of the successful response data using Zod's safeParse.
    const validationResult =
      z.array(statisticsDataSchema).safeParse(responseData);

    // If validation fails, log the details and throw an error.
    if (!validationResult.success) {
      const message = "Statistics response validation failed.";
      logger.error(message, {
        error: validationResult.error.issues,
        data: responseData,
      });
      return {
        success: false as const,
        message: message,
        error: validationResult.error,
        errorData: responseData,
      };
    }

    // On success, log the number of records retrieved and return the validated data.
    const message = `Successfully retrieved ${validationResult.data.length} statistics records.`;
    logger.info(message);
    return {
      success: true as const,
      data: validationResult.data,
      message: message,
    };
  },
});