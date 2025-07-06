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
 * @module
 * This module provides a tool for searching and retrieving campaigns from Xibo CMS.
 * It implements the GET /campaign endpoint with various filtering options.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { config } from '../config';
import { getAuthHeaders } from '../auth';
import { logger } from '../../../index';
import { campaignSchema } from './schemas';
import {
  TreeNode,
  treeResponseSchema,
  createTreeViewResponse,
} from '../utility/treeView';

const inputSchema = z.object({
  campaignId: z.number().optional().describe('Filter by Campaign ID.'),
  name: z.string().optional().describe('Filter by campaign name (supports filtering with %).'),
  tags: z.string().optional().describe('Filter by a comma-separated list of tags.'),
  exactTags: z.number().optional().describe('Whether to treat the tag filter as an exact match.'),
  logicalOperator: z.string().optional().describe('Logical operator for multiple tags (AND|OR).'),
  hasLayouts: z.number().optional().describe('Filter by whether the campaign has layouts.'),
  isLayoutSpecific: z.number().optional().describe('Filter for layout-specific campaigns.'),
  retired: z.number().optional().describe('Filter for retired campaigns.'),
  totalDuration: z.number().optional().describe('Whether to include the total duration.'),
  embed: z.string().optional().default('layouts,permissions,tags,event').describe('Include related data (layouts, permissions, tags, event).'),
  folderId: z.number().optional().describe('Filter by folder ID.'),
  treeView: z.boolean().optional().describe('Set to true to return campaigns in a structured, hierarchical tree view.'),
});

const outputSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.array(campaignSchema),
  }),
  treeResponseSchema, // Use the schema from the utility
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
  }),
]);

export const getCampaigns = createTool({
  id: 'get-campaigns',
  description: 'Searches for and retrieves campaigns from the Xibo CMS.',
  inputSchema,
  outputSchema,
  execute: async ({ context: input }): Promise<z.infer<typeof outputSchema>> => {
    if (!config.cmsUrl) {
      return { success: false, message: 'CMS URL is not configured.' };
    }

    if (input.treeView) {
      try {
        const authHeaders = await getAuthHeaders();
        const campaignParams = new URLSearchParams();
        // When tree view is enabled, always use the default embed to get all info
        campaignParams.append('embed', 'layouts,permissions,tags,event');

        // 1. Fetch all folders and campaigns in parallel
        const [foldersResponse, campaignsResponse] = await Promise.all([
          fetch(`${config.cmsUrl}/api/folders?gridView=1`, { headers: authHeaders }),
          fetch(`${config.cmsUrl}/api/campaign?${campaignParams.toString()}`, { headers: authHeaders })
        ]);

        if (!foldersResponse.ok) throw new Error(`Failed to fetch folders: ${foldersResponse.statusText}`);
        if (!campaignsResponse.ok) throw new Error(`Failed to fetch campaigns: ${campaignsResponse.statusText}`);

        const foldersData = await foldersResponse.json();
        const campaignsData: z.infer<typeof campaignSchema>[] = await campaignsResponse.json();

        // 2. Map all folders and campaigns to TreeNode objects
        const nodes: { [id: string]: TreeNode } = {};

        foldersData.forEach((folder: any) => {
          const id = `folder-${folder.folderId}`;
          nodes[id] = {
            id: folder.folderId,
            parentId: folder.parentId ? `folder-${folder.parentId}` : 'root',
            name: folder.folderName,
            type: 'folder',
            children: []
          };
        });

        campaignsData.forEach(campaign => {
          const campaignNodeId = campaign.campaignId + 1000000; // Offset to avoid collision with folder IDs
          const id = `campaign-${campaign.campaignId}`;
          const parentId = campaign.folderId ? `folder-${campaign.folderId}` : 'root';

          const detailNodes: TreeNode[] = [];
          let detailIdCounter = 1;

          const addDetailNode = (name: string, type: string) => {
            detailNodes.push({
              id: campaignNodeId * 100 + detailIdCounter++, // Unique ID for detail node
              name,
              type,
            });
          };

          addDetailNode(`Type: ${campaign.type}`, 'detail');
          addDetailNode(`Number of Layouts: ${campaign.numberLayouts}`, 'detail');

          if (campaign.totalDuration) {
            addDetailNode(`Total Duration: ${campaign.totalDuration}s`, 'detail');
          }
          if (campaign.tags && campaign.tags.length > 0) {
            const tagNames = campaign.tags.map(t => t.tag).join(', ');
            addDetailNode(`Tags: [${tagNames}]`, 'detail');
          }
          if (campaign.layouts && Array.isArray(campaign.layouts) && campaign.layouts.length > 0) {
            const layoutParentNode: TreeNode = {
              id: campaignNodeId * 100 + detailIdCounter++,
              name: 'Layouts',
              type: 'detail-group',
              children: [],
            };
            campaign.layouts.forEach((layout: any, index: number) => {
              // Ensure unique ID for layout items
              const layoutId = layout.layoutId ? campaignNodeId * 1000 + layout.layoutId : campaignNodeId * 10000 + index;
              layoutParentNode.children?.push({
                id: layoutId,
                name: layout.layout,
                type: 'layout-item',
                layoutId: layout.layoutId,
              });
            });
            detailNodes.push(layoutParentNode);
          }

          const { type, ...restOfCampaign } = campaign;
          nodes[id] = {
            id: campaignNodeId, // Use the unique, offsetted ID for the campaign node
            parentId: parentId,
            name: campaign.campaign,
            type: 'campaign',
            children: detailNodes,
            ...restOfCampaign
          };
        });
        
        // 3. Build the tree from the flat list of nodes
        const tree: TreeNode[] = [];
        Object.values(nodes).forEach(node => {
          if (node.parentId && node.parentId !== 'root' && nodes[node.parentId]) {
            const parent = nodes[node.parentId];
            parent.children = parent.children || [];
            parent.children.push(node);
          } else {
            // It's a root node
            tree.push(node);
          }
        });

        // 4. Prune empty folders from the tree
        const pruneEmptyFolders = (node: TreeNode): boolean => {
          if (node.type === 'campaign') {
            return true;
          }
          if (node.children && node.children.length > 0) {
            // Recursively prune children and keep the ones that have campaigns.
            node.children = node.children.filter(pruneEmptyFolders);
            // Keep the folder if it still has children after pruning.
            return node.children.length > 0;
          }
          // Remove folder if it's empty.
          return false;
        };

        const finalTree = tree.filter(pruneEmptyFolders);

        return createTreeViewResponse(campaignsData, finalTree, (node) => {
            if (node.type === 'folder') return `📁 ${node.name}`;
            if (node.type === 'campaign') return `🎬 ${node.name} (ID: ${node.campaignId})`;
            if (node.type === 'detail-group') return `ℹ️ ${node.name}`;
            if (node.type === 'layout-item') return `${node.name} (ID: ${node.layoutId})`;
            // For simple details and layout items, just return the name.
            // generateTreeView will handle the prefix characters (├─, └─).
            return node.name;
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        logger.error('getCampaigns (tree view): An unexpected error occurred', { error });
        return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
      }
    }

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Do not include 'treeView' in the params for the flat list API call
          if (key === 'treeView') return;
          params.append(key, String(value));
        }
      });

      const url = `${config.cmsUrl}/api/campaign?${params.toString()}`;
      logger.debug(`getCampaigns: Requesting URL = ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error(`getCampaigns: HTTP error: ${response.status}`, { error: responseData });
        return { success: false, message: `HTTP error! status: ${response.status}`, error: responseData };
      }

      const validatedData = z.array(campaignSchema).parse(responseData);
      logger.info('getCampaigns: Successfully retrieved and validated campaigns.');
      return { success: true, message: 'Campaigns retrieved successfully.', data: validatedData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getCampaigns: An unexpected error occurred', { error });
      
      if (error instanceof z.ZodError) {
        return { success: false, message: 'Validation error occurred.', error: error.issues };
      }
      
      return { success: false, message: `An unexpected error occurred: ${errorMessage}` };
    }
  },
}); 