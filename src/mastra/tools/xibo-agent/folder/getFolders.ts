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
 * @module getFolders
 * @description Provides a tool to retrieve folder information from the Xibo CMS.
 * It supports various filtering options and can return data as a flat list or a formatted tree view.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import {
  TreeNode,
  treeResponseSchema,
  createTreeViewResponse,
} from "../utility/treeView";

/**
 * Schema for folder data returned from the API.
 * This schema uses recursion via `z.lazy()` to handle nested child folders,
 * ensuring that the entire folder hierarchy is correctly validated.
 */
const folderSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.number().describe("The unique identifier for the folder."),
    type: z.string().nullable().describe("The type of the folder, if specified."),
    text: z.string().describe("The display name of the folder."),
    parentId: z
      .union([z.number(), z.string()])
      .nullable()
      .describe("The ID of the parent folder."),
    isRoot: z.number().nullable().describe("Flag indicating if this is a root folder."),
    children: z
      .union([z.array(folderSchema), z.string(), z.null()])
      .describe("A list of child folders, a string representation, or null if there are none."),
    permissionsFolderId: z
      .number()
      .nullable()
      .optional()
      .describe("The ID of the folder that defines permissions for this folder."),
    folderId: z.number().optional().describe("An alternative folder ID field."),
    folderName: z.string().optional().describe("An alternative folder name field."),
  }),
);

// Infer the TypeScript type from the Zod schema for type safety.
type FolderData = z.infer<typeof folderSchema>;

/**
 * Schema for the standard API response when not in tree view mode.
 */
const apiResponseSchema = z.object({
  success: z
    .boolean()
    .describe("Indicates whether the API call was successful."),
  data: z.array(folderSchema).describe("An array of folder objects."),
});

/**
 * Recursively converts the nested folder structure from the API into a TreeNode structure.
 * This is a helper function for building the tree view.
 * @param folder The folder data to convert.
 * @returns The converted TreeNode.
 */
function convertFolderToTreeNode(folder: FolderData): TreeNode {
  const node: TreeNode = {
    id: folder.id,
    name: folder.text,
    type: "folder",
    children: [],
  };

  // Add detail nodes for clarity in the tree view.
  const details: TreeNode[] = [
    { type: "folder-id", id: folder.id * 10 + 1, name: `ID: ${folder.id}` },
    { type: "type", id: folder.id * 10 + 2, name: `Type: ${folder.type ?? "N/A"}` },
    {
      type: "parent-id",
      id: folder.id * 10 + 3,
      name: `Parent ID: ${folder.parentId ?? "N/A"}`,
    },
    { type: "is-root", id: folder.id * 10 + 4, name: `isRoot: ${folder.isRoot ?? "N/A"}` },
  ];
  if (folder.permissionsFolderId !== undefined) {
    details.push({
      type: "permissions-folder-id",
      id: folder.id * 10 + 5,
      name: `Permissions Folder ID: ${folder.permissionsFolderId}`,
    });
  }
  // Recursively process child folders.
  if (folder.children && folder.children.length > 0) {
    node.children!.push(...folder.children.map(convertFolderToTreeNode));
  }

  return node;
}

/**
 * Builds a tree structure from a flat list of folder data.
 * @param folders Array of folder data from the API.
 * @returns Array of root-level TreeNode objects.
 */
function buildFolderTree(folders: FolderData[]): TreeNode[] {
  return folders.map(convertFolderToTreeNode);
}

/**
 * A custom formatter for rendering folder nodes in the tree view.
 * @param node The TreeNode to format.
 * @returns A string representation of the node.
 */
function folderNodeFormatter(node: TreeNode): string {
  if (node.type === "folder") {
    return `📁 ${node.name}`;
  }
  return node.name; // For detail nodes
}

/**
 * A tool to retrieve folders from the Xibo CMS.
 * It allows searching for folders with various filters and supports a tree view output.
 */
export const getFolders = createTool({
  id: "get-folders",
  description: "Retrieve folders from Xibo CMS, with optional filtering and tree view.",
  inputSchema: z.object({
    folderId: z
      .number()
      .optional()
      .describe("Filter by a specific folder ID to get its details and children."),
    gridView: z
      .number()
      .optional()
      .describe("Set to 1 for a grid-like flat list of folders."),
    folderName: z
      .string()
      .optional()
      .describe("Filter folders by name. Can be a partial match."),
    exactFolderName: z
      .number()
      .optional()
      .describe("Set to 1 to require an exact match for folderName."),
    treeView: z
      .boolean()
      .optional()
      .describe("Set to true to return folders in a structured, hierarchical tree view."),
  }),
  outputSchema: z.union([apiResponseSchema, treeResponseSchema]),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      const url = new URL(`${config.cmsUrl}/api/folders`);
      if (context.folderId) url.searchParams.append("folderId", String(context.folderId));
      if (context.gridView) url.searchParams.append("gridView", String(context.gridView));
      if (context.folderName) url.searchParams.append("folderName", context.folderName);
      if (context.exactFolderName) url.searchParams.append("exactFolderName", String(context.exactFolderName));

      logger.info(`Retrieving folders from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      const responseText = await response.text();
      let responseData: any;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        // If parsing fails, it might be an error message string.
        responseData = responseText;
      }

      if (!response.ok) {
        const decodedText = decodeErrorMessage(responseText);
        const errorMessage = `Failed to retrieve folders. API responded with status ${response.status}.`;
        logger.error(errorMessage, {
          status: response.status,
          response: decodedText,
        });
        throw new Error(`${errorMessage} Message: ${decodedText}`);
      }
      
      // The API returns a raw array of folder objects.
      const validationResult = z.array(folderSchema).safeParse(responseData);

      if (!validationResult.success) {
          const errorMessage = "Folder response validation failed.";
          logger.error(errorMessage, { error: validationResult.error.issues, data: responseData });
          throw new Error(errorMessage, { cause: validationResult.error });
      }
      
      const folders = validationResult.data;

      // Generate and return a tree view if requested.
      if (context.treeView) {
        const folderTree = buildFolderTree(folders);
        logger.info(`Successfully retrieved ${folders.length} folders and generated tree view.`);
        return createTreeViewResponse(folders, folderTree, folderNodeFormatter);
      }

      // Otherwise, return the standard success response.
      logger.info(`Successfully retrieved ${folders.length} folders.`);
      return {
        success: true,
        data: folders,
      };

    } catch (error: any) {
        const errorMessage = `An unexpected error occurred in getFolders: ${error.message}`;
        logger.error(errorMessage, { error });
        throw error;
    }
  },
});

export default getFolders; 