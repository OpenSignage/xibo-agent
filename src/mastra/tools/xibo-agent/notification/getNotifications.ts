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
 * @module GetNotifications
 * @description This module provides a tool to retrieve notifications from the Xibo CMS.
 * It supports filtering by notification ID and subject, and can embed related data like
 * user groups and display groups. It also supports generating a tree view.
 */
import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { decodeErrorMessage } from "../utility/error";
import { notificationSchema } from './schemas';
import { createTreeViewResponse, TreeNode } from '../utility/treeView';

/**
 * Defines the output schema for the getNotifications tool.
 * It can be a successful response with an array of notifications or a failure response.
 * It also supports an optional tree view structure.
 */
const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(notificationSchema),
    message: z.string(),
    tree: z.array(z.any()).optional(),
    treeViewText: z.string().optional(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool to retrieve notifications from the Xibo CMS.
 * It allows filtering, embedding of related data, and generating a tree view.
 */
export const getNotifications = createTool({
  id: 'get-notifications',
  description: 'Retrieve notifications from the Xibo CMS, with optional filters and tree view.',
  inputSchema: z.object({
    notificationId: z.number().optional().describe('Filter by a specific notification ID.'),
    subject: z.string().optional().describe('Filter notifications by subject (supports LIKE %...%).'),
    embed: z.string().optional().describe('Embed related data, e.g., "userGroups,displayGroups".'),
    treeView: z.boolean().optional().describe('If true, generates a tree view of notifications and their assigned groups.'),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/notification`);
    try {
      let embedValue = context.embed || '';
      if (context.treeView) {
        const requiredEmbeds = ['userGroups', 'displayGroups'];
        const existingEmbeds = embedValue.split(',').map(s => s.trim()).filter(Boolean);
        const newEmbeds = [...new Set([...existingEmbeds, ...requiredEmbeds])];
        embedValue = newEmbeds.join(',');
      }

      const params = new URLSearchParams();
      if (context.notificationId) {
        params.append('notificationId', context.notificationId.toString());
      }
      if (context.subject) {
        params.append('subject', context.subject);
      }
      if (embedValue) {
        params.append('embed', embedValue);
      }
      url.search = params.toString();
      
      logger.info({ url: url.toString() }, "Attempting to retrieve notifications.");

      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers
      });
      
      const responseData = await response.json();

      if (!response.ok) {
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to retrieve notifications. API responded with status ${response.status}.`;
        logger.error({ response: decodedError, status: response.status }, message);
        return {
          success: false as const,
          message,
          errorData: decodedError,
        };
      }

      const validationResult = z.array(notificationSchema).safeParse(responseData);

      if (!validationResult.success) {
        const message = "Notification response validation failed.";
        logger.error({ error: validationResult.error, data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error,
          errorData: responseData,
        };
      }

      const message = `Successfully retrieved ${validationResult.data.length} notifications.`;
      logger.info({ count: validationResult.data.length }, message);

      if (context.treeView) {
        const tree: TreeNode[] = validationResult.data.map(notification => {
          const children: TreeNode[] = [];
          if (notification.displayGroups) {
            children.push(...notification.displayGroups.map(dg => {
              const node: TreeNode = {
                id: (dg as any).displayGroupId,
                name: (dg as any).displayGroup,
                type: 'Display Group',
                description: (dg as any).description,
              };
              return node;
            }));
          }
          if (notification.userGroups) {
            children.push(...notification.userGroups.map(ug => {
              const node: TreeNode = {
                id: (ug as any).userGroupId,
                name: (ug as any).userGroup,
                type: 'User Group',
                description: (ug as any).description,
              };
              return node;
            }));
          }

          return {
            id: notification.notificationId,
            name: notification.subject,
            type: 'Notification',
            children: children,
            isInterrupt: notification.isInterrupt,
            body: notification.body,
          };
        });

        const nodeFormatter = (node: TreeNode) => {
          if (node.type === 'Notification') {
            const isInterrupt = (node as any).isInterrupt;
            const body = (node as any).body;
            let result = `${node.type}: ${node.name} (ID: ${node.id}, Interrupt: ${isInterrupt === 1 ? 'Yes' : 'No'})`;
            if (body) {
              result += `\n` + ' '.repeat(node.depth * 3 + 3) + `└─ Body: ${body}`;
            }
            return result;
          }
          if (node.type === 'Display Group' || node.type === 'User Group') {
            const description = (node as any).description;
            let result = `${node.type}: ${node.name} (ID: ${node.id})`;
            if (description) {
                result += ` - ${description}`;
            }
            return result;
          }
          return `${node.type}: ${node.name} (ID: ${node.id})`;
        };
        
        const treeResponse = createTreeViewResponse(validationResult.data, tree, nodeFormatter);
        const { success, ...restOfTreeResponse } = treeResponse;

        return {
          ...restOfTreeResponse,
          success: true as const,
          message,
        };
      }

      return { success: true as const, data: validationResult.data, message };

    } catch (error: unknown) {
      const message = "An unexpected error occurred while retrieving notifications.";
      logger.error({ error }, message);
      return { 
        success: false as const, 
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error
      };
    }
  },
}); 