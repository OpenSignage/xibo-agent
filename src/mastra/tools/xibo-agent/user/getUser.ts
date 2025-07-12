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
 * @module getUser
 * @description This module provides a tool to retrieve user information from the Xibo CMS,
 * with optional tree view formatting.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { TreeNode, createTreeViewResponse } from '../utility/treeView';
import { logger } from '../../../index';
import { decodeErrorMessage } from '../utility/error';
import {
  userSchema,
} from './schemas';

// Schema for a successful response with a list of users.
const userSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(userSchema),
});

// Schema for a successful response with a tree view.
const treeViewSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(userSchema),
  tree: z.array(z.any()),
  treeViewText: z.string(),
});

// Schema for a generic error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
  errorData: z.any().optional(),
});

// Schema for the tool's output, supporting both a standard list and a tree view.
const outputSchema = z.union([
  userSuccessResponseSchema,
  treeViewSuccessResponseSchema,
  errorResponseSchema,
]);

/**
 * Recursively builds a tree structure for a user, including their groups and permissions.
 * @param {any[]} users - Array of user data from the API.
 * @returns {TreeNode[]} An array of root-level TreeNode objects.
 */
function buildUserTree(users: any[]): TreeNode[] {
  return users.map((user) => {
    const userNode: TreeNode = {
      id: user.userId,
      name: user.userName,
      type: 'User',
      children: [],
    };

    if (user.groups && user.groups.length > 0) {
      const groupsNode: TreeNode = {
        id: -1,
        name: 'Groups',
        type: 'Category',
        children: user.groups.map((group: any) => ({
          id: group.groupId,
          name: group.group,
          type: 'Group',
        })),
      };
      userNode.children!.push(groupsNode);
    }

    if (user.permissions && user.permissions.length > 0) {
      const permissionsNode: TreeNode = {
        id: -2,
        name: 'Permissions',
        type: 'Category',
        children: user.permissions.map((p: any) => ({
          id: p.permissionId,
          name: `${p.entity} (ID: ${p.objectId})`,
          type: 'Permission',
        })),
      };
      userNode.children!.push(permissionsNode);
    }

    return userNode;
  });
}

/**
 * Custom formatter for rendering user-related nodes in the tree view.
 * @param {TreeNode} node - The TreeNode to format.
 * @returns {string} A string representation of the node.
 */
function userNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'User':
      return `👤 ${node.name}`;
    case 'Category':
      return `📁 ${node.name}`;
    case 'Group':
      return `👥 ${node.name}`;
    case 'Permission':
      return `🔑 ${node.name}`;
    default:
      return node.name;
  }
}

/**
 * @tool getUser
 * @description A tool to retrieve one or more users from the Xibo CMS.
 * Supports filtering by user ID or name, embedding related data, and a tree view.
 */
export const getUser = createTool({
  id: 'get-user',
  description: 'Retrieve user(s) from the Xibo CMS.',
  inputSchema: z.object({
    userId: z.number().optional().describe('A specific User ID to find.'),
    userName: z.string().optional().describe('A username to find (case-insensitive).'),
    embed: z.string().optional().describe('Embed related data, e.g., "permissions,groups".'),
    treeView: z.boolean().optional().describe('Set to true to return users in a structured, hierarchical tree view.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/user`);
    const params = new URLSearchParams();

    if (context.userId) params.append('userId', context.userId.toString());
    if (context.userName) params.append('userName', context.userName);
    if (context.embed) params.append('embed', context.embed);
    url.search = params.toString();

    try {
      logger.info({ url: url.toString() }, 'Attempting to retrieve user(s).');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      const responseData = await response.json();
      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to get user(s). API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }

      const validationResult = z.array(userSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = 'User response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return { success: false as const, message, error: validationResult.error, errorData: responseData };
      }
      
      const users = validationResult.data;

      if (context.treeView) {
        const userTree = buildUserTree(users);
        const treeResponse = createTreeViewResponse(users, userTree, userNodeFormatter);
        return { ...treeResponse, success: true as const };
      }

      return { success: true as const, data: users };
    } catch (error: unknown) {
      const message = 'An unexpected error occurred while retrieving users.';
      logger.error({ error }, message);
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});