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
 * @description Provides a tool to add a new action to a layout in the Xibo CMS.
 * Actions are events that can be triggered, for example, by touch or a webhook.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { actionSchema } from "./schemas";

// Schema for a successful response, containing the newly created action.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: actionSchema,
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, which can be a success or error response.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * Tool for adding a new action to the Xibo CMS.
 * It allows creating various types of actions associated with a layout.
 */
export const addAction = createTool({
  id: "add-action",
  description: "Adds a new action to a specified layout in the Xibo CMS.",
  inputSchema: z.object({
    layoutId: z.number().describe("The ID of the layout to associate this action with. This is a required field."),
    actionType: z.enum(['next', 'previous', 'navLayout', 'navWidget']).describe("The type of action to create, e.g., 'next', 'previous', 'navLayout', 'navWidget'. Required."),
    target: z.enum(['screen', 'region']).describe("The target for this action, e.g., 'screen' or 'region'. Required."),
    targetId: z.string().optional().describe("The ID of the target for this action. This is required if the target is a 'region'."),
    source: z.enum(['layout', 'region', 'widget']).optional().describe("The source for this action, e.g., 'layout', 'region', or 'widget'."),
    sourceId: z.number().optional().describe("The ID of the source object (layoutId, regionId, or widgetId)."),
    triggerType: z.enum(['touch', 'webhook']).optional().describe("The trigger type for the action, e.g., 'touch' or 'webhook'."),
    triggerCode: z.string().optional().describe("The trigger code for the action."),
    widgetId: z.number().optional().describe("The Widget ID to navigate to. This is required for 'navWidget' actionType."),
    layoutCode: z.string().optional().describe("The Layout Code identifier to navigate to. This is required for 'navLayout' actionType."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    const { actionType, widgetId, layoutCode, target, targetId } = context;
    let errorMessage: string | null = null;

    if (actionType === 'navWidget' && widgetId === undefined) {
      errorMessage = "The 'widgetId' is required when 'actionType' is 'navWidget'.";
    } else if (actionType === 'navLayout' && layoutCode === undefined) {
      errorMessage = "The 'layoutCode' is required when 'actionType' is 'navLayout'.";
    } else if (target === 'region' && targetId === undefined) {
      errorMessage = "The 'targetId' is required when 'target' is 'region'.";
    }

    if (errorMessage) {
      logger.error({ context }, errorMessage);
      return { success: false as const, message: errorMessage };
    }

    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/action`);
    logger.info({ url: url.toString(), context }, "Attempting to add a new action.");

    try {
      const params = new URLSearchParams();
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          // The API expects array parameters with `[]` in the key
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
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = actionSchema.safeParse(responseData);

      if (!validationResult.success) {
        const message = "Add action response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { 
          success: false as const, 
          message, 
          error: validationResult.error.flatten(), 
          errorData: responseData,
        };
      }

      return { success: true as const, data: validationResult.data };

    } catch (error) {
      const message = "An unexpected error occurred while adding the action.";
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 