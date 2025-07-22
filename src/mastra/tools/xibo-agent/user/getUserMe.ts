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
 * @module getUserMe
 * @description This module provides a tool to retrieve the currently authenticated user's information
 * from the Xibo CMS, with optional tree view formatting.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { TreeNode, createTreeViewResponse } from '../utility/treeView';
import { logger } from '../../../logger';
import { decodeErrorMessage } from '../utility/error';
import {
  userSchema,
} from './schemas';

// The API returns a single user object, not in an array for this endpoint.
const userMeSuccessResponseSchema = z.object({
    success: z.literal(true),
    data: userSchema,
});

const treeViewSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: userSchema,
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

// Schema for the tool's output, supporting both a standard object and a tree view.
const outputSchema = z.union([
  userMeSuccessResponseSchema,
  treeViewSuccessResponseSchema,
  errorResponseSchema,
]);

/**
 * Builds a tree structure for the current user, including their groups and permissions.
 * @param {any} user - A single user data object from the API.
 * @returns {TreeNode[]} An array containing the single root TreeNode.
 */
function buildUserMeTree(user: any): TreeNode[] {
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

    return [userNode];
}

/**
 * Custom formatter for rendering user-related nodes in the tree view.
 * @param {TreeNode} node - The TreeNode to format.
 * @returns {string} A string representation of the node.
 */
function userMeNodeFormatter(node: TreeNode): string {
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
 * @tool getUserMe
 * @description A tool to retrieve the currently authenticated user's information from the Xibo CMS.
 * Supports embedding related data and a tree view.
 */
export const getUserMe = createTool({
  id: 'get-user-me',
  description: "Retrieve the authenticated user's information from the Xibo CMS.",
  inputSchema: z.object({
    embed: z.string().optional().describe('Embed related data, e.g., "permissions,groups".'),
    treeView: z.boolean().optional().describe('Set to true to return the user info in a structured, hierarchical tree view.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/user/me`);
    const params = new URLSearchParams();

    if (context.embed) params.append('embed', context.embed);
    url.search = params.toString();

    try {
        logger.info({ url: url.toString() }, "Attempting to retrieve current user's information.");

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: await getAuthHeaders(),
        });

        const responseData = await response.json();

        if (!response.ok) {
            const decodedError = decodeErrorMessage(responseData);
            const message = `Failed to get current user info. API responded with status ${response.status}.`;
            logger.error({ status: response.status, response: decodedError }, message);
            return { success: false as const, message, errorData: decodedError };
        }

        const validationResult = userSchema.safeParse(responseData);

        if (!validationResult.success) {
            const message = 'Current user response validation failed.';
            logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
            return { success: false as const, message, error: validationResult.error, errorData: responseData };
        }
        
        const user = validationResult.data;

        if (context.treeView) {
            const userTree = buildUserMeTree(user);
            const treeResponse = createTreeViewResponse([user], userTree, userMeNodeFormatter);
            return { ...treeResponse, success: true as const, data: user };
        }

        return { success: true as const, data: user };
    } catch (error: unknown) {
        const message = 'An unexpected error occurred while retrieving current user information.';
        logger.error({ error }, message);
        return {
            success: false as const,
            message,
            error: error instanceof Error ? { name: error.name, message: error.message } : error,
        };
    }
  },
});