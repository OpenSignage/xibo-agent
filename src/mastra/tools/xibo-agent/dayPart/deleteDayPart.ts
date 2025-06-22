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
 * @module deleteDayPart
 * @description This module provides functionality to delete a DayPart from the Xibo CMS.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the output of the tool, covering both success and error cases
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
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
 * Tool to delete a DayPart
 * This tool interfaces with the Xibo API to remove an existing DayPart record.
 */
export const deleteDayPart = createTool({
  id: "delete-daypart",
  description: "Delete a DayPart",
  inputSchema: z.object({
    dayPartId: z.number().describe("The ID of the DayPart to delete (required)"),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/daypart/${context.dayPartId}`);
      logger.info(`Attempting to delete DayPart from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      // A successful DELETE request returns a 204 No Content status
      if (response.status !== 204) {
        const errorData = await response.json().catch(() => response.text());
        const message = `Failed to delete DayPart. API responded with status ${response.status}`;
        logger.error(message, { response: errorData });
        return { success: false as const, message, errorData };
      }

      const message = `DayPart with ID ${context.dayPartId} was successfully deleted.`;
      logger.info(message);
      return { success: true, message };
    } catch (error) {
      const message = "An unexpected error occurred while deleting the DayPart.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default deleteDayPart; 