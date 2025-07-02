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
 * Add Command Tool
 * 
 * This module provides functionality to add new commands to the Xibo CMS.
 * It implements the command creation API and handles the necessary validation
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
 * Tool for adding commands
 * 
 * This tool creates new commands in the Xibo CMS system.
 */
export const addCommand = createTool({
  id: "add-command",
  description: "Add a new command to the Xibo CMS",
  inputSchema: z.object({
    command: z.string().describe("The command name (required)"),
    code: z.string().describe("The command code/identifier (required)"),
    description: z.string().optional().describe("Description of the command (optional)"),
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

      const url = new URL(`${config.cmsUrl}/api/command`);
      
      // Create form data
      const formData = new FormData();
      formData.append("command", context.command);
      formData.append("code", context.code);
      if (context.description) formData.append("description", context.description);
      if (context.commandString) formData.append("commandString", context.commandString);
      if (context.validationString) formData.append("validationString", context.validationString);
      if (context.availableOn) formData.append("availableOn", context.availableOn);
      if (context.createAlertOn) formData.append("createAlertOn", context.createAlertOn);

      logger.info("Adding command", { command: context.command, code: context.code });
      logger.debug("Request URL", { url: url.toString() });

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: await getAuthHeaders(),
        body: formData,
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(message, { status: response.status, response: rawData });
        return { success: false, message, errorData: rawData };
      }

      const validationResult = successResponseSchema.safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false, message, error: validationResult.error, errorData: rawData };
      }

      logger.info("Command added successfully", { commandId: validationResult.data.data.commandId });
      return validationResult.data;

    } catch (error) {
      const message = "Unexpected error occurred while adding command";
      logger.error(message, { error });
      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export default addCommand; 