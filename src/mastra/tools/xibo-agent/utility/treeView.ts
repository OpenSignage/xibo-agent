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
 * Tree View Generation Utility
 * 
 * This module provides generic functions for generating tree structures
 * to visually display hierarchical data. It can be used with various types
 * of hierarchical data such as layouts, folders, etc.
 */

import { z } from 'zod';

/**
 * Basic interface for tree nodes
 * All tree nodes must implement this interface
 */
export interface TreeNode {
  id: number;
  name: string;
  type: string;
  children?: TreeNode[];
  [key: string]: any; // Allow additional properties
}

/**
 * Type definition for flattened tree nodes
 */
export interface FlatTreeNode {
  id: number;
  name: string;
  type: string;
  depth: number;
  isLast: boolean;
  path: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Response schema for tree view
 */
export const treeResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.any()),
  tree: z.array(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    depth: z.number(),
    isLast: z.boolean(),
    path: z.string()
  })),
  treeViewText: z.string()
});

/**
 * Generates a text representation of the tree view
 * 
 * @param tree Hierarchical tree structure
 * @param indent Current indentation string
 * @param nodeFormatter Optional function to customize node display format
 * @returns Formatted tree view string
 */
export function generateTreeView(
  tree: TreeNode[], 
  indent = '',
  nodeFormatter?: (node: TreeNode) => string
): string {
  let output = '';
  
  tree.forEach((node, index, array) => {
    const isLast = index === array.length - 1;
    const linePrefix = isLast ? '└─ ' : '├─ ';
    
    // Format node display
    let nodeDisplay: string;
    if (nodeFormatter) {
      // Use custom formatter for the node's content
      nodeDisplay = nodeFormatter(node);
    } else {
      // Default display format
      nodeDisplay = `${node.type}: ${node.name}`;
      
      // Apply special display for specific node types
      if (node.type === 'widget' && node.duration !== undefined) {
        nodeDisplay += ` (${node.duration}s)`;
      }
    }
    
    output += `${indent}${linePrefix}${nodeDisplay}\n`;
    
    // Process child nodes
    if (node.children && node.children.length > 0) {
      const childIndent = indent + (isLast ? '   ' : '│  ');
      output += generateTreeView(node.children, childIndent, nodeFormatter);
    }
  });
  
  return output;
}

/**
 * Flattens a tree into an array with depth and path information
 * 
 * @param tree Hierarchical tree structure
 * @param depth Current depth
 * @param path Current path
 * @param result Array to collect flattened results
 * @param nodePathFormatter Optional function to customize node path display
 * @returns Array of nodes with depth and path information
 */
export function flattenTree(
  tree: TreeNode[],
  depth = 0,
  path = '',
  result: FlatTreeNode[] = [],
  nodePathFormatter?: (node: TreeNode) => string
): FlatTreeNode[] {
  tree.forEach((node, index, array) => {
    const isLast = index === array.length - 1;
    
    // Format node path display
    let nodePath: string;
    if (nodePathFormatter) {
      nodePath = nodePathFormatter(node);
    } else {
      nodePath = node.name;
    }
    
    const currentPath = path ? `${path} > ${nodePath}` : nodePath;
    
    // Copy basic properties
    const flatNode: FlatTreeNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      depth,
      isLast,
      path: currentPath
    };
    
    // Copy properties that need special handling
    if (node.duration !== undefined) {
      flatNode.duration = node.duration;
    }
    
    result.push(flatNode);
    
    // Process child nodes
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, depth + 1, currentPath, result, nodePathFormatter);
    }
  });
  
  return result;
}

/**
 * Creates a response object for tree view display
 * 
 * @param data Original data (array or object)
 * @param tree Constructed tree structure
 * @param nodeFormatter Optional node display formatter
 * @returns Response object containing tree view
 */
export function createTreeViewResponse(
  data: any[] | object,
  tree: TreeNode[],
  nodeFormatter?: (node: TreeNode) => string
): any {
  const treeViewString = generateTreeView(tree, '', nodeFormatter);
  // Format as markdown code block
  const formattedTreeView = "```text\n" + treeViewString + "```";
  const flattenedTree = flattenTree(tree);
  
  return {
    success: true,
    data: data,
    tree: flattenedTree,
    treeViewText: formattedTreeView
  };
} 