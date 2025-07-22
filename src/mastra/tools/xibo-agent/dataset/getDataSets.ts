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
 * @module getDataSets
 * @description Provides a tool to retrieve a list of datasets from the Xibo CMS,
 * with extensive filtering capabilities and an optional tree view of columns.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { dataSetSchema, dataSetColumnSchema } from "./schemas";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";
import { createTreeViewResponse, TreeNode, treeResponseSchema } from "../utility/treeView";

// Schema for a successful response, containing an array of datasets.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(dataSetSchema),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

/**
 * Schema for the tool's output, covering success, error, and tree view responses.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema, treeResponseSchema]);

/**
 * Tool for retrieving a list of datasets from the Xibo CMS.
 * It supports various filters and can return a tree view of datasets and their columns.
 */
export const getDataSets = createTool({
  id: "get-data-sets",
  description: "Retrieves a list of datasets from the Xibo CMS, with optional filtering and a tree view.",
  inputSchema: z.object({
    dataSetId: z.number().optional().describe("Filter by a specific Dataset ID."),
    dataSet: z.string().optional().describe("Filter by dataset name (or part of the name)."),
    code: z.string().optional().describe("Filter by dataset code."),
    isRealTime: z.number().optional().describe("Filter by whether the dataset is real-time (1 for true, 0 for false)."),
    userId: z.number().optional().describe("Filter by the ID of the owner user."),
    embed: z.string().optional().describe("Embed related data, such as 'columns'."),
    folderId: z.number().optional().describe("Filter by the ID of the folder containing the datasets."),
    treeView: z.boolean().optional().describe("If true, returns a tree view of datasets and their columns."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }
    
    const { treeView, ...restOfContext } = context;
    const requestContext = { ...restOfContext };

    if (treeView) {
      requestContext.embed = 'columns';
    }

    const url = new URL(`${config.cmsUrl}/api/dataset`);
    const params = new URLSearchParams();
    
    Object.entries(requestContext).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });
    url.search = params.toString();
    
    try {
      logger.info({ url: url.toString() }, "Requesting datasets from Xibo CMS.");
      
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to retrieve datasets. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const dataSetWithColumnsSchema = dataSetSchema.extend({
        columns: z.array(dataSetColumnSchema).optional(),
      });
      const validationResult = z.array(treeView ? dataSetWithColumnsSchema : dataSetSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Datasets response validation failed.";
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      const datasets = validationResult.data;
      logger.info({ count: datasets.length }, `Successfully retrieved ${datasets.length} datasets.`);

      if (treeView) {
        const tree: TreeNode[] = datasets.map(dataset => ({
          id: dataset.dataSetId,
          name: dataset.dataSet,
          type: 'dataset',
          isRemote: dataset.isRemote,
          isRealTime: dataset.isRealTime,
          uri: dataset.uri,
          children: (dataset.columns || []).map((column: z.infer<typeof dataSetColumnSchema>) => ({
            id: column.dataSetColumnId,
            name: column.heading,
            type: 'column',
          })),
        }));

        const nodeFormatter = (node: TreeNode) => {
          let label = 'ID';
          let status = '';
          if (node.type === 'dataset') {
            label = 'dataSetId';
            if (node.isRemote) {
              status += ' [Remote]';
              if (node.uri) {
                status += ` (${node.uri})`;
              }
            }
            if (node.isRealTime) status += ' [Real-time]';
          } else if (node.type === 'column') {
            label = 'columnId';
          }
          return `${node.type}: ${node.name} (${label}: ${node.id})${status}`;
        };

        return createTreeViewResponse(datasets, tree, nodeFormatter);
      }

      return {
        success: true as const,
        data: datasets,
      };
    } catch (error) {
      const message = "An unexpected error occurred while retrieving datasets.";
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return {
        success: false as const,
        message,
        error: processedError,
      };
    }
  },
}); 