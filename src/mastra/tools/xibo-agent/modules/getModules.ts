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
 * @module getModules
 * @description Provides a tool to retrieve information about all available modules in the Xibo CMS.
 * It implements the GET /module API endpoint.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';
import { moduleSchema } from './schemas';
import { TreeNode, createTreeViewResponse } from '../utility/treeView';

/**
 * Schema for the successful response, containing an array of modules.
 */
const getModulesSuccessSchema = z.object({
  success: z.literal(true),
  data: z.array(moduleSchema.passthrough()),
});

/**
 * Schema for the successful tree view response.
 */
const getModulesTreeSuccessSchema = z.object({
  success: z.literal(true),
  data: z.array(z.any()),
  tree: z.string(),
  message: z.string(),
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z.any().optional().describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([
  getModulesSuccessSchema,
  getModulesTreeSuccessSchema,
  errorResponseSchema,
]);

/**
 * Builds a tree structure from a flat list of modules for the tree view.
 */
function buildModuleTree(modules: z.infer<typeof moduleSchema>[]): TreeNode[] {
  let idCounter = 0;

  return modules.map(module => {
    const moduleNode: TreeNode = {
      id: idCounter++,
      name: `(ID: ${module.moduleId ?? 'N/A'}) ${
        module.name || 'Unnamed Module'
      } (Type: ${module.type || 'N/A'})`,
      type: 'module',
      children: [],
    };

    const infoChildren: TreeNode[] = [];
    if (module.author) {
      infoChildren.push({
        id: idCounter++,
        name: `Author: ${module.author}`,
        type: 'info-detail',
      });
    }
    if (module.description) {
      infoChildren.push({
        id: idCounter++,
        name: `Description: ${module.description}`,
        type: 'info-detail',
      });
    }

    if (infoChildren.length > 0) {
      moduleNode.children?.push({
        id: idCounter++,
        name: 'Information',
        type: 'info',
        children: infoChildren,
      });
    }

    if (module.properties && module.properties.length > 0) {
      moduleNode.children?.push({
        id: idCounter++,
        name: 'Properties',
        type: 'properties',
        children: module.properties.map(prop => ({
          id: idCounter++,
          name: `${prop.title || prop.id}: ${prop.type}`,
          type: 'property',
        })),
      });
    }

    return moduleNode;
  });
}

/**
 * Formats a tree node for the text-based tree view.
 */
function moduleNodeFormatter(node: TreeNode): string {
  const iconMap: { [key: string]: string } = {
    module: '📦',
    info: 'ℹ️',
    properties: '🔧',
    property: '🔹',
    'info-detail': '🔸',
    default: '•',
  };
  const icon = iconMap[node.type] || iconMap.default;
  return `${icon} ${node.name}`;
}

/**
 * Tool for retrieving all available modules from the Xibo CMS.
 */
export const getModules = createTool({
  id: 'get-modules',
  description: 'Gets a list of all available modules in the Xibo CMS.',
  inputSchema: z.object({
    treeView: z.boolean().optional().describe("Set to true to return modules in a hierarchical tree structure."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${config.cmsUrl}/api/module`);
      
      logger.debug({ url: url.toString() }, 'Attempting to get all modules');
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const message = `Failed to get modules. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: responseData }, message);
        return { success: false as const, message, errorData: responseData };
      }
      
      // Use passthrough to allow extra fields not defined in the schema
      const validationResult = z.array(moduleSchema.passthrough()).safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Get modules response validation failed.';
        logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }
      
      const modules = validationResult.data as z.infer<typeof moduleSchema>[];

      if (context.treeView) {
        const moduleTree = buildModuleTree(modules);
        return createTreeViewResponse(modules, moduleTree, moduleNodeFormatter);
      }

      logger.info(`Successfully retrieved ${modules.length} modules.`);
      return { success: true as const, data: modules };

    } catch (error) {
      const message = 'An unexpected error occurred while getting modules.';
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});

export default getModules;