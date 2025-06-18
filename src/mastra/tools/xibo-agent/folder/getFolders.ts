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
 * Xibo CMS Folder Retrieval Tool
 * 
 * This module provides functionality to retrieve folder information from the Xibo CMS system.
 * It implements the folder search API endpoint and handles the necessary validation
 * and data transformation for retrieving folders with various filtering options.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";
import { 
  TreeNode, 
  treeResponseSchema, 
  generateTreeView, 
  flattenTree, 
  createTreeViewResponse 
} from "../utility/treeView";

/**
 * Folder interface representing folder data structure
 */
interface FolderData {
  id: number;
  type: string | null;
  text: string;
  parentId: number | string | null;
  isRoot: number | null;
  children: FolderData[] | null;
  permissionsFolderId?: number | null;
  folderId?: number;
  folderName?: string;
}

/**
 * Schema for folder data returned from the API
 * 
 * This defines the structure of folder data as returned from Xibo CMS.
 * The schema includes validation for all expected folder properties.
 * It uses a recursive definition to handle nested children folders.
 */
// Define folderSchema with recursion support
const folderSchema: z.ZodType<any> = z.lazy(() => 
  z.object({
    id: z.number(),
    type: z.string().nullable(),
    text: z.string(),
    parentId: z.union([z.number(), z.string()]).nullable(),
    isRoot: z.number().nullable(),
    // Allow children to be either an array of folders or null
    children: z.union([z.array(folderSchema), z.null()]),
    permissionsFolderId: z.number().nullable().optional(),
    // Additional fields that appear in the response
    folderId: z.number().optional(),
    folderName: z.string().optional()
  })
);

/**
 * Schema for API response after retrieving folders
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(folderSchema),
});

/**
 * Convert folder data to tree node structure
 * 
 * This function recursively converts the nested folder structure from the API
 * into a TreeNode structure that can be used for tree view rendering.
 * 
 * @param folder The folder data to convert
 * @returns The converted TreeNode
 */
function convertFolderToTreeNode(folder: FolderData): TreeNode {
  // Create base node
  const node: TreeNode = {
    id: folder.id,
    name: folder.text,
    type: 'folder',
    children: []
  };

  // Add detail nodes
  const details: TreeNode[] = [
    { type: 'folder-id', id: folder.id * 10 + 1, name: `ID: ${folder.id}` },
    { type: 'type', id: folder.id * 10 + 2, name: `Type: ${folder.type ?? 'N/A'}` },
    { type: 'parent-id', id: folder.id * 10 + 3, name: `Parent ID: ${folder.parentId ?? 'N/A'}` },
    { type: 'is-root', id: folder.id * 10 + 4, name: `isRoot: ${folder.isRoot ?? 'N/A'}` }
  ];
  if (folder.permissionsFolderId !== undefined) {
    details.push({ type: 'permissions-folder-id', id: folder.id * 10 + 5, name: `Permissions Folder ID: ${folder.permissionsFolderId}` });
  }
  if (folder.folderId !== undefined) {
    details.push({ type: 'folder-id-alt', id: folder.id * 10 + 6, name: `Folder ID (alt): ${folder.folderId}` });
  }
  if (folder.folderName !== undefined) {
    details.push({ type: 'folder-name', id: folder.id * 10 + 7, name: `Folder Name: ${folder.folderName}` });
  }
  node.children!.push(...details);

  // Process children if they exist
  if (folder.children && folder.children.length > 0) {
    node.children!.push(...folder.children.map(child => convertFolderToTreeNode(child)));
  }

  return node;
}

/**
 * Build a tree structure from folder data
 * 
 * @param folders Array of folder data from the API
 * @returns Array of TreeNode structures
 */
function buildFolderTree(folders: FolderData[]): TreeNode[] {
  // Convert each top-level folder to a TreeNode
  return folders.map(folder => convertFolderToTreeNode(folder));
}

/**
 * Folder node custom formatter
 */
function folderNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'folder':
      return `📁 ${node.name}`;
    case 'folder-id':
      return `└─ ${node.name}`;
    case 'type':
      return `└─ ${node.name}`;
    case 'parent-id':
      return `└─ ${node.name}`;
    case 'is-root':
      return `└─ ${node.name}`;
    case 'permissions-folder-id':
      return `└─ ${node.name}`;
    case 'folder-id-alt':
      return `└─ ${node.name}`;
    case 'folder-name':
      return `└─ ${node.name}`;
    default:
      return node.name;
  }
}

/**
 * Tool for retrieving folders from Xibo CMS
 * 
 * This tool allows searching for folders with various filtering options
 * such as folder ID, name, or view type.
 */
export const getFolders = createTool({
  id: "get-folders",
  description: "Retrieve folders from Xibo CMS",
  inputSchema: z.object({
    folderId: z.number().optional().describe('Filter by specific folder ID'),
    gridView: z.number().optional().describe('Set to 1 to use grid view'),
    folderName: z.string().optional().describe('Filter folders by name'),
    exactFolderName: z.number().optional().describe('Set to 1 to require exact name match'),
    treeView: z.boolean().optional().describe('Set to true to return folders in tree structure'),
  }),
  outputSchema: z.union([
    apiResponseSchema,
    treeResponseSchema
  ]),
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      throw new Error("CMS URL is not configured");
    }

    try {
      // Prepare the API endpoint URL
      const url = new URL(`${config.cmsUrl}/api/folders`);
      
      // Add query parameters if provided
      if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());
      if (context.gridView) url.searchParams.append("gridView", context.gridView.toString());
      if (context.folderName) url.searchParams.append("folderName", context.folderName);
      if (context.exactFolderName) url.searchParams.append("exactFolderName", context.exactFolderName.toString());

      logger.info(`Retrieving folders${context.folderName ? ` matching '${context.folderName}'` : ''}${context.treeView ? ' with tree view' : ''}`);

      // Get authentication headers
      const headers = await getAuthHeaders();

      // Send request to Xibo CMS API
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: headers,
      });

      // Get the complete response text
      let responseText = await response.text();
      
      // Check if response is successful
      if (!response.ok) {
        // Decode the error message for better readability
        const decodedText = decodeErrorMessage(responseText);
        
        logger.error(`Failed to retrieve folders: ${decodedText}`, { 
          status: response.status,
          url: url.toString()
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${decodedText}`);
      }

      // Parse the response text as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        logger.error(`Failed to parse response as JSON: ${responseText}`);
        throw new Error(`Invalid JSON response from server: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      // Generate tree view if requested
      if (context.treeView) {
        const folderTree = buildFolderTree(data);
        
        logger.info(`Retrieved ${data.length} folders successfully and generated tree view`);
        logger.debug(`Tree structure: ${JSON.stringify(folderTree)}`);
        return createTreeViewResponse(data, folderTree, folderNodeFormatter);
      }

      // Validate the response data against schema
      try {
        const validatedData = apiResponseSchema.parse({
          success: true,
          data: data
        });
        logger.info(`Retrieved ${data.length} folders successfully`);
        return validatedData;
      } catch (validationError) {
        logger.warn(`Response validation failed: ${validationError instanceof Error ? validationError.message : "Unknown error"}`, { 
          responseData: data 
        });
        
        // Return with basic validation even if full schema validation fails
        return {
          success: true,
          data: data
        };
      }
    } catch (error) {
      logger.error(`getFolders: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

export default getFolders; 