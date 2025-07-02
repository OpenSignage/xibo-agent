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
 * Edit Command Tool
 * 
 * This module provides functionality to edit existing commands in the Xibo CMS.
 * It implements the command editing API and handles the necessary validation
 * and data transformation for command management.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for command object
const commandSchema = z.object({
  commandId: z.number(),
  command: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  userId: z.number(),
  commandString: z.string().nullable(),
  validationString: z.string().nullable(),
  displayProfileId: z.number().nullable(),
  commandStringDisplayProfile: z.string().nullable(),
  validationStringDisplayProfile: z.string().nullable(),
  availableOn: z.string().nullable(),
  createAlertOn: z.string().nullable(),
  createAlertOnDisplayProfile: z.string().nullable(),
  groupsWithPermissions: z.string().nullable(),
});

// Schema for successful response
const successResponseSchema = z.object({
  success: z.literal(true),
  data: commandSchema,
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
 * Tool for editing commands
 * 
 * This tool edits existing commands in the Xibo CMS system.
 */
export const editCommand = createTool({
  id: "edit-command",
  description: "Edit an existing command in the Xibo CMS",
  inputSchema: z.object({
    commandId: z.number().describe("ID of the command to edit (required)"),
    command: z.string().min(1, "Command name must be at least 1 character").max(254, "Command name must not exceed 254 characters").describe("The command name (required, 1-254 characters)"),
    description: z.string().describe("Description of the command (required)"),
    commandString: z.string().optional().describe("The command string to execute (optional)"),
    validationString: z.string().optional().describe("Validation string for the command (optional)"),
    availableOn: z.string().optional().describe("Platforms where the command is available (optional)"),
    createAlertOn: z.enum(["success", "failure", "always", "never"]).optional().describe("When to create alerts for this command (optional)"),
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
      
      // Create form data with URL-encoded format
      const formData = new URLSearchParams();
      formData.append("command", context.command.trim());
      formData.append("description", context.description);
      if (context.commandString) formData.append("commandString", context.commandString);
      if (context.validationString) formData.append("validationString", context.validationString);
      if (context.availableOn) formData.append("availableOn", context.availableOn);
      if (context.createAlertOn) formData.append("createAlertOn", context.createAlertOn);

      logger.info("Editing command", { commandId: context.commandId, command: context.command });

      // Send PUT request to update command
      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...await getAuthHeaders(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(message, { status: response.status, response: rawData });
        return { success: false, message, errorData: rawData };
      }

      // Try to parse as direct command response first
      const directValidationResult = commandSchema.safeParse(rawData);
      if (directValidationResult.success) {
        logger.info("Command edited successfully", { commandId: context.commandId });
        return {
          success: true,
          data: directValidationResult.data
        };
      }

      // Fallback to wrapped response format
      const validationResult = successResponseSchema.safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false, message, error: validationResult.error, errorData: rawData };
      }

      logger.info("Command edited successfully", { commandId: context.commandId });
      return validationResult.data;

    } catch (error) {
      const message = "Unexpected error occurred while editing command";
      logger.error(message, { error, commandId: context.commandId });
      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export default editCommand; 