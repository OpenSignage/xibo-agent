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
 * This module provides a tool to visualize the hierarchical structure of Menu Boards,
 * Categories, and Products in a tree view.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { logger } from '../../../index';
import { getMenuBoards } from './getMenuBoards';
import { getMenuBoardCategories } from './getMenuBoardCategories';
import { getMenuBoardProducts } from './getMenuBoardProducts';
import {
  createTreeViewResponse,
  TreeNode,
  treeResponseSchema,
} from '../utility/treeView';

const inputSchema = z.object({
  menuId: z
    .number()
    .optional()
    .describe(
      'The ID of a specific menu board to display. If not provided, all menu boards will be shown.',
    ),
});

const successResponseSchema = treeResponseSchema.extend({
  message: z.string(),
  success: z.literal(true),
});

const failureResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

const outputSchema = z.union([successResponseSchema, failureResponseSchema]);

/**
 * Tool to generate a tree view of Menu Boards.
 *
 * This tool fetches menu boards, their categories, and the products within those
 * categories to construct and display a hierarchical tree structure.
 */
export const getMenuBoardTree = createTool({
  id: 'get-menu-board-tree',
  description: 'Displays a tree view of menu boards, categories, and products.',
  inputSchema,
  outputSchema,
  execute: async ({
    context: input,
    runtimeContext,
  }): Promise<z.infer<typeof outputSchema>> => {
    logger.info('getMenuBoardTree: Starting tree generation process.', { menuId: input.menuId });
    try {
      // Step 1: Fetch all relevant menu boards
      const menuBoardsResponse = await getMenuBoards.execute({
        context: { menuId: input.menuId },
        runtimeContext,
      });

      // Abort if the initial fetch fails
      if (!menuBoardsResponse.success) {
        return {
          success: false,
          message: menuBoardsResponse.message,
          error: menuBoardsResponse.error,
        };
      }

      // Handle case where no menu boards are found
      if (menuBoardsResponse.data.length === 0) {
        logger.info('getMenuBoardTree: No menu boards found, returning empty tree.');
        const emptyTreeResponse = createTreeViewResponse([], []);
        return {
          ...emptyTreeResponse,
          message: 'No menu boards found to create a tree.',
        };
      }

      const menuBoards = menuBoardsResponse.data;
      const tree: TreeNode[] = [];

      // Step 2: Iterate through each menu board to build its branch of the tree
      for (const menuBoard of menuBoards) {
        const menuBoardNode: TreeNode = {
          id: menuBoard.menuId,
          name: menuBoard.name,
          type: 'MenuBoard',
          children: [],
        };

        // Fetch categories for the current menu board
        const categoriesResponse = await getMenuBoardCategories.execute({
          context: { menuId: menuBoard.menuId },
          runtimeContext,
        });

        if (categoriesResponse.success && categoriesResponse.data) {
          // Iterate through categories to fetch their products
          for (const category of categoriesResponse.data) {
            const categoryNode: TreeNode = {
              id: category.menuCategoryId,
              name: category.name,
              type: 'Category',
              children: [],
            };

            // Fetch products for the current category
            const productsResponse = await getMenuBoardProducts.execute({
              context: { menuCategoryId: category.menuCategoryId },
              runtimeContext,
            });

            if (productsResponse.success && productsResponse.data) {
              for (const product of productsResponse.data) {
                const productNode: TreeNode = {
                  id: product.menuProductId,
                  name: product.name,
                  type: 'Product',
                  price: product.price,
                  calories: product.calories,
                };
                categoryNode.children?.push(productNode);
              }
            }
            menuBoardNode.children?.push(categoryNode);
          }
        }
        tree.push(menuBoardNode);
      }

      // Step 3: Format the collected data into a tree view response
      // Custom formatter for the tree nodes to include extra details
      const nodeFormatter = (node: TreeNode) => {
        let display = `${node.type}: ${node.name} (ID: ${node.id})`;
        if (node.type === 'Product') {
          if (node.price != null) display += `, Price: ${node.price}`;
          if (node.calories != null) display += `, Calories: ${node.calories}`;
        }
        return display;
      };

      const treeResponse = createTreeViewResponse(menuBoards, tree, nodeFormatter);
      logger.info('getMenuBoardTree: Successfully generated menu board tree.');
      return {
        ...treeResponse,
        message: 'Menu board tree generated successfully.',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error('getMenuBoardTree: An unexpected error occurred', { error });

      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return {
          success: false,
          message: 'Validation error occurred.',
          error: error.issues,
        };
      }

      // Handle other unexpected errors
      return {
        success: false,
        message: `An unexpected error occurred: ${errorMessage}`,
        error,
      };
    }
  },
}); 