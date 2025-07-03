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
 * @description This module provides functionality to retrieve information about all available
 * modules in the Xibo CMS. It accesses the /api/module endpoint to get details
 * about module properties, configuration options, and compatibility.
 */

import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from '../../../index';
import { 
  TreeNode, 
  treeResponseSchema, 
  createTreeViewResponse 
} from '../utility/treeView';

/**
 * Schema for module property definition.
 * Represents configurable properties of Xibo modules.
 */
const propertySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  helpText: z.string().nullable(),
  default: z.union([z.string(), z.number(), z.null()]),
});

/**
 * Schema for module response data from the Xibo API.
 * Defines the comprehensive structure of module information, including metadata,
 * compatibility settings, and configuration options.
 */
const moduleSchema = z.object({
  moduleId: z.union([z.number(), z.string().transform(Number)]),
  name: z.string().nullable(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.string().nullable(),
  legacyTypes: z.union([z.array(z.string()), z.array(z.object({}))]),
  dataType: z.string().nullable(),
  group: z.union([z.array(z.string()), z.object({})]),
  dataCacheKey: z.string().nullable(),
  fallbackData: z.union([z.number(), z.string().transform(Number)]),
  regionSpecific: z.union([z.number(), z.string().transform(Number)]),
  schemaVersion: z.union([z.number(), z.string().transform(Number)]),
  compatibilityClass: z.string().nullable(),
  showIn: z.string().nullable(),
  assignable: z.union([z.number(), z.string().transform(Number)]),
  hasThumbnail: z.union([z.number(), z.string().transform(Number)]),
  thumbnail: z.string().nullable(),
  startWidth: z.union([z.number(), z.string().transform(Number)]).nullable(),
  startHeight: z.union([z.number(), z.string().transform(Number)]).nullable(),
  renderAs: z.string().nullable(),
  class: z.string().nullable(),
  validatorClass: z.array(z.string()),
  preview: z.any().nullable(),
  stencil: z.any().nullable(),
  properties: z.array(propertySchema),
  assets: z.any().nullable(),
  onInitialize: z.string().nullable(),
  onParseData: z.string().nullable(),
  onDataLoad: z.string().nullable(),
  onRender: z.string().nullable(),
  onVisible: z.string().nullable(),
  sampleData: z.union([z.string(), z.array(z.any()), z.null()]),
  enabled: z.union([z.number(), z.string().transform(Number)]),
  previewEnabled: z.union([z.number(), z.string().transform(Number)]),
  defaultDuration: z.union([z.number(), z.string().transform(Number)]),
  settings: z.array(propertySchema),
  propertyGroups: z.array(z.string()),
  requiredElements: z.array(z.string()),
  isInstalled: z.boolean(),
  isError: z.boolean(),
  errors: z.array(z.string()),
  allowPreview: z.union([z.number(), z.string().transform(Number)]).nullable(),
});

const successSchema = z.union([
  treeResponseSchema,
  z.array(moduleSchema),
]);

const outputSchema = z.union([
  successSchema,
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Builds a tree structure from a flat list of modules.
 * @param modules - The array of module data from the API.
 * @returns An array of TreeNode objects representing the module hierarchy.
 */
function buildModuleTree(modules: any[]): TreeNode[] {
  return modules.map(module => {
    const moduleNode: TreeNode = {
      id: module.moduleId,
      name: `${module.name || 'Unnamed Module'} (ID: ${module.moduleId})`,
      type: 'module',
      children: []
    };

    // Information Node
    const infoChildren: TreeNode[] = [];
    if (module.author) infoChildren.push({ id: -module.moduleId * 10 - 1, name: `Author: ${module.author}`, type: 'info-detail' });
    if (module.type) infoChildren.push({ id: -module.moduleId * 10 - 2, name: `Type: ${module.type}`, type: 'info-detail' });
    if (module.dataType) infoChildren.push({ id: -module.moduleId * 10 - 3, name: `Data Type: ${module.dataType}`, type: 'info-detail' });
    if (module.description) infoChildren.push({ id: -module.moduleId * 10 - 4, name: `Description: ${module.description}`, type: 'info-detail' });

    if (infoChildren.length > 0) {
      moduleNode.children?.push({
        id: -module.moduleId * 10,
        name: 'Information',
        type: 'info',
        children: infoChildren
      });
    }
    
    // Properties Node
    if (module.properties && module.properties.length > 0) {
      moduleNode.children?.push({
        id: -module.moduleId * 100,
        name: 'Properties',
        type: 'properties',
        children: module.properties.map((prop: any, index: number) => ({
          id: -module.moduleId * 100 - (index + 1),
          name: `${prop.title || prop.id}: ${prop.type}`,
          type: 'property'
        }))
      });
    }

    // Settings Node
    if (module.settings && module.settings.length > 0) {
      moduleNode.children?.push({
        id: -module.moduleId * 1000,
        name: 'Settings',
        type: 'settings',
        children: module.settings.map((setting: any, index: number) => ({
          id: -module.moduleId * 1000 - (index + 1),
          name: `${setting.title || setting.id}: ${setting.type}`,
          type: 'setting'
        }))
      });
    }

    return moduleNode;
  });
}

/**
 * Formats a tree node for display in the text-based tree view.
 * @param node - The TreeNode to format.
 * @returns A string representation of the node with an icon.
 */
function moduleNodeFormatter(node: TreeNode): string {
  switch (node.type) {
    case 'module':
      return `📦 ${node.name}`;
    case 'info':
      return `ℹ️ ${node.name}`;
    case 'properties':
      return `🔧 ${node.name}`;
    case 'settings':
      return `⚙️ ${node.name}`;
    case 'property':
    case 'setting':
    case 'info-detail':
      return node.name;
    default:
      return node.name;
  }
}

/**
 * Tool for retrieving all module information from the Xibo CMS.
 */
export const getModules = createTool({
  id: 'get-modules',
  description: 'Get information about all available Xibo CMS modules',
  inputSchema: z.object({
    treeView: z.boolean().optional().describe("Set to true to return modules in a tree structure."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${config.cmsUrl}/api/module`, {
        headers,
      });

      const rawData = await response.json();

      if (!response.ok) {
        const message = `Failed to get modules. API responded with status ${response.status}`;
        logger.error(message, { response: rawData });
        return { success: false as const, message, errorData: rawData };
      }

      const validationResult = z.array(moduleSchema).safeParse(rawData);
      if (!validationResult.success) {
        const message = "API response validation failed";
        logger.error(message, { error: validationResult.error, data: rawData });
        return { success: false as const, message, error: validationResult.error, errorData: rawData };
      }

      // If treeView is requested, build and return the tree structure.
      if (context.treeView) {
        const moduleTree = buildModuleTree(validationResult.data);
        return createTreeViewResponse(validationResult.data, moduleTree, moduleNodeFormatter);
      }

      return validationResult.data;
    } catch (error) {
      const message = "An unexpected error occurred while getting modules.";
      logger.error(message, { error });
      return {
        success: false as const,
        message,
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      };
    }
  },
});

export default getModules;