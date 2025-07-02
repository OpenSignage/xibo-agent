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
 * Delete Command Tool
 * 
 * This module provides functionality to delete commands from the Xibo CMS.
 * It implements the command deletion API and handles the necessary validation
 * and data transformation for command management.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string().describe("Success message")
  })
});

// Schema for error response
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

// Union schema for all possible responses
const responseSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool for deleting commands
 * 
 * This tool deletes commands from the Xibo CMS system.
 */
export const deleteCommand = createTool({
  id: "delete-command",
  description: "Delete a command from the Xibo CMS",
  inputSchema: z.object({
    commandId: z.number().describe("ID of the command to delete (required)"),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    try {
      if (!config.cmsUrl) {
        const message = "CMS URL is not configured";
        logger.error(message);
        return { success: false, message };
      }

      const url = new URL(`${config.cmsUrl}/api/command/${context.commandId}`);
      
      logger.info("Deleting command", { commandId: context.commandId });
      logger.debug("Request URL", { url: url.toString() });

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        
        const message = `HTTP error! status: ${response.status}`;
        logger.error(message, { status: response.status, response: errorData });
        return { success: false, message, errorData };
      }

      // DELETE requests typically return 204 No Content
      if (response.status === 204) {
        logger.info("Command deleted successfully", { commandId: context.commandId });
        return {
          success: true,
          data: { message: "Command deleted successfully" }
        };
      }

      // Handle other successful responses
      try {
        const rawData = await response.json();
        logger.info("Command deleted successfully", { commandId: context.commandId, response: rawData });
        return {
          success: true,
          data: { message: "Command deleted successfully" }
        };
      } catch {
        // If no JSON response, still consider it successful
        logger.info("Command deleted successfully", { commandId: context.commandId });
        return {
          success: true,
          data: { message: "Command deleted successfully" }
        };
      }

    } catch (error) {
      const message = "Unexpected error occurred while deleting command";
      logger.error(message, { error, commandId: context.commandId });
      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export default deleteCommand; 