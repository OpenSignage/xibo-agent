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
 * @module addAction
 * @description Provides a tool to add a new action to the Xibo CMS.
 * Actions are events that can be triggered on display groups.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { actionSchema } from "./schemas";

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: actionSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

const actionTypes = z.enum([
  'displayorder', 'changelayout', 'command', 'screengrab', 
  'shellcommand', 'reboot', 'power', 'font'
]).describe("The type of action to create.");

/**
 * Tool for adding a new action to the Xibo CMS.
 */
export const addAction = createTool({
  id: "add-action",
  description: "Add a new action.",
  inputSchema: z.object({
    actionType: actionTypes,
    displayGroupIds: z.array(z.number()).describe("An array of Display Group IDs this action applies to."),
    isSystem: z.number().optional().describe("Flag if this is a system action (0 or 1). Default is 0."),
    layoutId: z.number().optional().describe("Layout ID (required for type 'changelayout')."),
    duration: z.number().optional().describe("Duration in seconds (required for 'changelayout')."),
    commandId: z.number().optional().describe("Command ID (required for type 'command')."),
    command: z.string().optional().describe("Shell command string (required for type 'shellcommand')."),
    reboot: z.enum(['true', 'false']).optional().describe("Reboot flag (required for type 'reboot')."),
    powerState: z.enum(['on', 'off']).optional().describe("Power state (required for type 'power')."),
    font: z.string().optional().describe("System font to install (required for type 'font')."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    // Manual validation based on type
    const { actionType, layoutId, duration, commandId, command, reboot, powerState, font } = context;
    let errorMessage: string | null = null;

    if (actionType === 'changelayout' && (layoutId === undefined || duration === undefined)) {
      errorMessage = "layoutId and duration are required for type 'changelayout'.";
    } else if (actionType === 'command' && commandId === undefined) {
      errorMessage = "commandId is required for type 'command'.";
    } else if (actionType === 'shellcommand' && command === undefined) {
      errorMessage = "command is required for type 'shellcommand'.";
    } else if (actionType === 'reboot' && reboot === undefined) {
      errorMessage = "reboot flag is required for type 'reboot'.";
    } else if (actionType === 'power' && powerState === undefined) {
      errorMessage = "powerState is required for type 'power'.";
    } else if (actionType === 'font' && font === undefined) {
      errorMessage = "font is required for type 'font'.";
    }

    if (errorMessage) {
      logger.error(errorMessage, { context });
      return { success: false as const, message: errorMessage };
    }

    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/action`);
    logger.info("Attempting to add a new action.");

    try {
      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(val => params.append(`${key}[]`, String(val)));
          } else {
            params.append(key, String(value));
          }
        }
      });

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          ...await getAuthHeaders(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to add action. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = actionSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Add action response validation failed.";
        logger.error(message, { error: validationResult.error, data: responseData });
        return { 
          success: false as const, 
          message, 
          error: validationResult.error, 
          errorData: responseData,
        };
      }

      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = "An unexpected error occurred while adding the action.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 