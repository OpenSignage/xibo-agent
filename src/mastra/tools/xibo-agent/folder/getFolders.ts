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
 * @description This module provides a tool to retrieve folder information from the Xibo CMS.
 * It supports various filtering options and can return data as a flat list or a formatted tree view.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import {
  TreeNode,
  createTreeViewResponse,
} from '../utility/treeView';
import {
  folderSchema,
  FolderData,
  errorResponseSchema,
  successResponseSchema,
} from './schemas';

/**
 * The output schema is a union of possible responses:
 * - A successful response with folder data.
 * - A successful response with a tree view.
 * - An error response.
 */
const outputSchema = z.union([
  successResponseSchema,
  z.object({
    success: z.literal(true),
    data: z.array(folderSchema),
    tree: z.array(z.any()),
    treeViewText: z.string(),
  }),
  errorResponseSchema,
]);

/**
 * Recursively converts the nested folder structure from the API into a TreeNode structure.
 * This is a helper function for building the tree view.
 * @param {FolderData} folder - The folder data to convert.
 * @returns {TreeNode} The converted TreeNode.
 */
function convertFolderToTreeNode(folder: FolderData): TreeNode {
  const node: TreeNode = {
    id: folder.id,
    name: folder.text,
    type: 'folder',
    children: [],
  };

  if (Array.isArray(folder.children)) {
    node.children = folder.children.map(convertFolderToTreeNode);
  }

  return node;
}

/**
 * Builds a tree structure from a flat list of folder data.
 * @param {FolderData[]} folders - Array of folder data from the API.
 * @returns {TreeNode[]} Array of root-level TreeNode objects.
 */
function buildFolderTree(folders: FolderData[]): TreeNode[] {
  return folders.map(convertFolderToTreeNode);
}

/**
 * @tool getFolders
 * @description A tool to retrieve folders from the Xibo CMS.
 * It allows searching for folders with various filters and supports a tree view output.
 */
export const getFolders = createTool({
  id: 'get-folders',
  description: 'Retrieve folders from Xibo CMS, with optional filtering and tree view.',
  inputSchema: z.object({
    folderId: z
      .number()
      .optional()
      .describe('Filter by a specific folder ID to get its details and children.'),
    gridView: z
      .number()
      .optional()
      .describe('Set to 1 for a grid-like flat list of folders.'),
    folderName: z
      .string()
      .optional()
      .describe('Filter folders by name. Can be a partial match.'),
    exactFolderName: z
      .number()
      .optional()
      .describe('Set to 1 to require an exact match for folderName.'),
    treeView: z
      .boolean()
      .optional()
      .describe('Set to true to return folders in a structured, hierarchical tree view.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/folders`);
    const params = new URLSearchParams();

    if (context.folderId) params.append('folderId', String(context.folderId));
    if (context.gridView) params.append('gridView', String(context.gridView));
    if (context.folderName) params.append('folderName', context.folderName);
    if (context.exactFolderName) {
      params.append('exactFolderName', String(context.exactFolderName));
    }
    url.search = params.toString();

    try {
      logger.info({ url: url.toString() }, 'Attempting to retrieve folders.');

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to retrieve folders. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }

      const validationResult = z.array(folderSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'Folder response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }
      
      const folders = validationResult.data;

      if (context.treeView) {
        const folderTree = buildFolderTree(folders);
        const nodeFormatter = (node: TreeNode) => `📁 ${node.name}`;
        const treeResponse = createTreeViewResponse(folders, folderTree, nodeFormatter);
        return { ...treeResponse, success: true as const };
      }

      return { success: true as const, data: folders };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while retrieving folders.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
}); 