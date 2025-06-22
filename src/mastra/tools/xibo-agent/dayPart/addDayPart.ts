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
 * @module addDayPart
 * @description This module provides functionality to add a new DayPart to the Xibo CMS.
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
    data: dayPartSchema,
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
 * Tool to add a new DayPart
 * This tool interfaces with the Xibo API to create a new DayPart record.
 */
export const addDayPart = createTool({
  id: "add-daypart",
  description: "Add a DayPart",
  inputSchema: z.object({
    name: z.string().describe("Name for the new DayPart (required)"),
    description: z.string().optional().describe("Description for the DayPart (optional)"),
    startTime: z.string().describe("Start time in HH:mm:ss format (required)"),
    endTime: z.string().describe("End time in HH:mm:ss format (required)"),
    exceptionDays: z.array(z.string()).optional().describe("Array of exception dates in YYYY-MM-DD format"),
    exceptionStartTimes: z.array(z.string()).optional().describe("Array of exception start times in HH:mm:ss format"),
    exceptionEndTimes: z.array(z.string()).optional().describe("Array of exception end times in HH:mm:ss format"),
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
      const params = new URLSearchParams();
      params.append("name", context.name);
      params.append("startTime", context.startTime);
      params.append("endTime", context.endTime);
      if (context.description) {
        params.append("description", context.description);
      }
      if (context.exceptionDays) {
        context.exceptionDays.forEach((day: string) => params.append("exceptionDays[]", day));
      }
      if (context.exceptionStartTimes) {
        context.exceptionStartTimes.forEach((time: string) => params.append("exceptionStartTimes[]", time));
      }
      if (context.exceptionEndTimes) {
        context.exceptionEndTimes.forEach((time: string) => params.append("exceptionEndTimes[]", time));
      }

      logger.info(`Attempting to add DayPart to: ${url.toString()}`);
      logger.debug("Request body:", { body: params.toString() });

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...(await getAuthHeaders()),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to add DayPart. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = dayPartSchema.safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      const message = "DayPart added successfully";
      logger.info(message, { data: validationResult.data });
      return { success: true, data: validationResult.data, message };
    } catch (error) {
      const message = "An unexpected error occurred while adding DayPart.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default addDayPart; 