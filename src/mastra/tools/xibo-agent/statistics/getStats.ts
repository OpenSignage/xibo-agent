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
 * Xibo CMS Statistics Tool
 * 
 * This module provides functionality to retrieve and search statistics data from the Xibo CMS system.
 * It implements the statistics API endpoint and handles the necessary validation
 * and data transformation for statistics operations.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for statistics data validation
 * Defines the structure and validation rules for statistics data in the Xibo CMS system
 */
const statisticsDataSchema = z.object({
  statId: z.number(),
  type: z.string(),
  statDate: z.string(),
  displayId: z.number(),
  layoutId: z.number().optional(),
  mediaId: z.number().optional(),
  campaignId: z.number().optional(),
  duration: z.number(),
  count: z.number(),
  display: z.string(),
  layout: z.string().optional(),
  media: z.string().optional(),
  campaign: z.string().optional(),
  tags: z.string().optional(),
});

/**
 * Schema for API response validation
 * Expected response format from the Xibo CMS API
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(statisticsDataSchema),
});

/**
 * Tool for retrieving statistics data from Xibo CMS
 * 
 * This tool provides functionality to:
 * - Search statistics by various criteria (type, date range, display, layout, etc.)
 * - Filter statistics based on different parameters
 * - Handle statistics data validation and transformation
 */
export const getStats = createTool({
  id: "get-stats",
  description: "Search and retrieve statistics data from Xibo CMS",
  inputSchema: z.object({
    type: z.enum(["Layout", "Media", "Widget"]).optional().describe("Type of statistics to retrieve"),
    fromDt: z.string().optional().describe("Start date for statistics (format: YYYY-MM-DD)"),
    toDt: z.string().optional().describe("End date for statistics (format: YYYY-MM-DD)"),
    statDate: z.string().optional().describe("Specific date for statistics (format: YYYY-MM-DD)"),
    statId: z.string().optional().describe("Filter by statistics ID"),
    displayId: z.number().optional().describe("Filter by display ID"),
    displayIds: z.string().optional().describe("Filter by multiple display IDs (comma-separated numbers)"),
    layoutId: z.string().optional().describe("Filter by layout IDs (comma-separated numbers)"),
    parentCampaignId: z.number().optional().describe("Filter by parent campaign ID"),
    mediaId: z.string().optional().describe("Filter by media IDs (comma-separated numbers)"),
    campaignId: z.number().optional().describe("Filter by campaign ID"),
    returnDisplayLocalTime: z.boolean().optional().describe("Return times in display's local timezone"),
    returnDateFormat: z.string().optional().describe("Format for returned dates"),
    embed: z.string().optional().describe("Embed related data"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not set");
    }

    const url = new URL(`${config.cmsUrl}/api/stats`);
    
    // Add query parameters
    if (context.type) url.searchParams.append("type", context.type);
    if (context.fromDt) url.searchParams.append("fromDt", context.fromDt);
    if (context.toDt) url.searchParams.append("toDt", context.toDt);
    if (context.statDate) url.searchParams.append("statDate", context.statDate);
    if (context.statId) url.searchParams.append("statId", context.statId);
    if (context.displayId) url.searchParams.append("displayId", context.displayId.toString());
    if (context.displayIds) url.searchParams.append("displayIds", context.displayIds);
    if (context.layoutId) url.searchParams.append("layoutId", context.layoutId);
    if (context.parentCampaignId) url.searchParams.append("parentCampaignId", context.parentCampaignId.toString());
    if (context.mediaId) url.searchParams.append("mediaId", context.mediaId);
    if (context.campaignId) url.searchParams.append("campaignId", context.campaignId.toString());
    if (context.returnDisplayLocalTime) url.searchParams.append("returnDisplayLocalTime", context.returnDisplayLocalTime.toString());
    if (context.returnDateFormat) url.searchParams.append("returnDateFormat", context.returnDateFormat);
    if (context.embed) url.searchParams.append("embed", context.embed);

    logger.info('Request URL:', { url: url.toString() });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const decodedError = decodeErrorMessage(errorText);
      logger.error('HTTP error occurred:', {
        status: response.status,
        error: decodedError
      });
      return {
        success: false,
        data: [],
        error: {
          status: response.status,
          message: decodedError
        }
      };
    }

    const rawData = await response.json();
    logger.info('Response data:', rawData);
    const validatedData = apiResponseSchema.parse(rawData);
    return validatedData;
  },
});

export default getStats; 