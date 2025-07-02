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
 * Get Commands Tool
 * 
 * This module provides functionality to retrieve commands from the Xibo CMS.
 * It implements the command search API and handles the necessary validation
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
  data: z.array(commandSchema),
});

// Schema for direct API response (array format)
const directApiResponseSchema = z.array(commandSchema);

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
 * Tool for retrieving commands
 * 
 * This tool searches and retrieves commands from the Xibo CMS system.
 */
export const getCommands = createTool({
  id: "get-commands",
  description: "Search and retrieve commands from the Xibo CMS",
  inputSchema: z.object({
    commandId: z.number().optional().describe("Filter by specific command ID (optional)"),
    command: z.string().optional().describe("Filter by command name (optional)"),
    code: z.string().optional().describe("Filter by command code (optional)"),
    useRegexForName: z.number().optional().describe("Use regex for command name search (0 or 1, optional)"),
    useRegexForCode: z.number().optional().describe("Use regex for command code search (0 or 1, optional)"),
    logicalOperatorName: z.enum(["AND", "OR"]).optional().describe("Logical operator for name search (optional)"),
    logicalOperatorCode: z.enum(["AND", "OR"]).optional().describe("Logical operator for code search (optional)"),
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
      
      // Add query parameters if provided
      if (context.commandId) url.searchParams.append("commandId", context.commandId.toString());
      if (context.command) url.searchParams.append("command", context.command);
      if (context.code) url.searchParams.append("code", context.code);
      if (context.useRegexForName) url.searchParams.append("useRegexForName", context.useRegexForName.toString());
      if (context.useRegexForCode) url.searchParams.append("useRegexForCode", context.useRegexForCode.toString());
      if (context.logicalOperatorName) url.searchParams.append("logicalOperatorName", context.logicalOperatorName);
      if (context.logicalOperatorCode) url.searchParams.append("logicalOperatorCode", context.logicalOperatorCode);

      logger.info("Retrieving commands");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(message, { status: response.status, response: rawData });
        return { success: false, message, errorData: rawData };
      }

      try {
        // First try to parse as direct array response from API
        const directValidationResult = directApiResponseSchema.safeParse(rawData);
        if (directValidationResult.success) {
          logger.info("Commands retrieved successfully", { count: directValidationResult.data.length });
          return {
            success: true,
            data: directValidationResult.data
          };
        }

        // If direct array parsing fails, try wrapped response format
        const validationResult = successResponseSchema.safeParse(rawData);
        if (!validationResult.success) {
          const message = "API response validation failed";
          logger.error(message, { 
            directError: directValidationResult.error, 
            wrappedError: validationResult.error, 
            data: rawData 
          });
          return { success: false, message, error: validationResult.error, errorData: rawData };
        }

        logger.info("Commands retrieved successfully", { count: validationResult.data.data.length });
        return validationResult.data;
      } catch (validationError) {
        const message = "Response validation error";
        logger.error(message, { error: validationError, data: rawData });
        return { success: false, message, error: validationError, errorData: rawData };
      }

    } catch (error) {
      const message = "Unexpected error occurred while retrieving commands";
      logger.error(message, { error });
      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

export default getCommands; 