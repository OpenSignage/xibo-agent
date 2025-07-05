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
 * @module manageDataSetConnector
 * @description Provides a tool to manage the data connector for a dataset in the Xibo CMS.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Schema for the data connector configuration.
 */
const connectorSchema = z.object({
  name: z.string().describe("The name of the connector."),
  type: z.string().describe("The type of the connector."),
  config: z.record(z.any()).describe("A configuration object for the connector."),
  isActive: z.boolean().optional().describe("Flag indicating if the connector is active."),
  lastSync: z.string().optional().describe("Timestamp of the last sync."),
  lastSyncStatus: z.number().optional().describe("Status code of the last sync."),
  lastSyncMessage: z.string().optional().describe("Message from the last sync."),
});

/**
 * Schema for the tool's output, covering success and failure cases.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.any(),
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
 * Tool for managing a dataset's data connector.
 */
export const manageDataSetConnector = createTool({
  id: "manage-data-set-connector",
  description: "Manage the data connector for a dataset (get, add, edit, or delete).",
  inputSchema: z.object({
    dataSetId: z.number().describe("The ID of the dataset."),
    action: z.enum(["get", "add", "edit", "delete"]).describe("The action to perform."),
    data: connectorSchema.optional().describe("The connector data, required for 'add' and 'edit' actions."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/dataset/dataconnector/${context.dataSetId}`);
    logger.info(`Performing '${context.action}' action on data connector for dataset ID: ${context.dataSetId}`);

    try {
      let method: string;
      let body: string | undefined;

      switch (context.action) {
        case "get":
          method = "GET";
          break;
        case "add":
          method = "POST";
          body = JSON.stringify(context.data);
          break;
        case "edit":
          method = "PUT";
          body = JSON.stringify(context.data);
          break;
        case "delete":
          method = "DELETE";
          break;
        default:
          const message = `Invalid action provided: ${context.action}`;
          logger.error(message);
          return { success: false as const, message };
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          ...await getAuthHeaders(),
          ...(body && { "Content-Type": "application/json" }),
        },
        ...(body && { body }),
      });
      
      if (response.status === 204) {
        const message = `Successfully performed '${context.action}' action.`;
        logger.info(message);
        return { success: true as const, data: null, message };
      }

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to perform '${context.action}' action. API responded with status ${response.status}.`;
        logger.error(message, { response: decodedError });
        return { success: false as const, message, errorData: decodedError };
      }

      const message = `Successfully performed '${context.action}' action on data connector.`;
      logger.info(message, { response: responseData });
      return { success: true as const, data: responseData, message };

    } catch (error) {
      const message = `An unexpected error occurred while performing '${context.action}' action.`;
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 