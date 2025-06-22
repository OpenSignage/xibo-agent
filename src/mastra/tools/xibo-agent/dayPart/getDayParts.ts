/*
 * Copyright 2024 Mastra, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @module getDayParts
 * @description This module provides functionality to retrieve DayPart records from the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for a single DayPart object
const dayPartSchema = z.object({
  dayPartId: z.number(),
  isAlways: z.number(),
  isCustom: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  exceptionDays: z.array(z.string()).optional(),
  exceptionStartTimes: z.array(z.string()).optional(),
  exceptionEndTimes: z.array(z.string()).optional(),
});

// Schema for the output of the tool, covering both success and error cases
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(dayPartSchema),
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
 * Tool to retrieve a list of DayParts
 * This tool interfaces with the Xibo API to fetch DayPart records based on specified filters.
 */
export const getDayParts = createTool({
  id: "get-dayparts",
  description: "Get DayParts",
  inputSchema: z.object({
    dayPartId: z.number().optional().describe("Filter by a specific DayPart ID"),
    name: z.string().optional().describe("Filter by DayPart name"),
    embed: z.string().optional().describe("Embed related data, e.g., 'exceptions'"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/daypart`);
      if (context.dayPartId) {
        url.searchParams.append("dayPartId", context.dayPartId.toString());
      }
      if (context.name) {
        url.searchParams.append("name", context.name);
      }
      if (context.embed) {
        url.searchParams.append("embed", context.embed);
      }

      logger.info(`Requesting DayParts from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get DayParts. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = z.array(dayPartSchema).safeParse(rawData);

      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      logger.info(`Successfully retrieved ${validationResult.data.length} DayParts.`);
      return { success: true, data: validationResult.data, message: "Successfully retrieved DayParts." };
    } catch (error) {
      const message = "An unexpected error occurred while getting DayParts.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default getDayParts; 