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
 * @module getActions
 * @description Provides a tool to retrieve a list of actions from the Xibo CMS,
 * with extensive filtering capabilities based on the Xibo API.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import { actionSchema } from "./schemas";

// Schema for a successful response, containing an array of actions.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(actionSchema),
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
 * Tool for retrieving a list of actions from the Xibo CMS.
 * It supports various filters to narrow down the search results.
 */
export const getActions = createTool({
  id: "get-actions",
  description: "Get a list of actions, with optional filters.",
  inputSchema: z.object({
    actionId: z.number().optional().describe("Filter by a specific Action ID."),
    ownerId: z.number().optional().describe("Filter by a specific owner User ID."),
    triggerType: z.string().optional().describe("Filter by the action's trigger type (e.g., 'touch', 'webhook')."),
    triggerCode: z.string().optional().describe("Filter by the action's trigger code."),
    actionType: z.string().optional().describe("Filter by a specific action type (e.g., 'next', 'navLayout')."),
    source: z.string().optional().describe("Filter by the action's source (e.g., 'layout', 'region')."),
    sourceId: z.number().optional().describe("Filter by the action's source ID."),
    target: z.string().optional().describe("Filter by the action's target (e.g., 'screen', 'region')."),
    targetId: z.number().optional().describe("Filter by the action's target ID."),
    layoutId: z.number().optional().describe("Return all actions pertaining to a particular Layout ID."),
    sourceOrTargetId: z.number().optional().describe("Return all actions related to a source or target with the provided ID."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }
    
    const url = new URL(`${config.cmsUrl}/api/action`);
    
    // Append optional query parameters
    Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
            url.searchParams.append(key, String(value));
        }
    });

    try {
      logger.info({ url: url.toString() }, "Requesting actions from Xibo CMS.");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get actions. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = z.array(actionSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Get actions response validation failed.";
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
      const message = "An unexpected error occurred while getting actions.";
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 