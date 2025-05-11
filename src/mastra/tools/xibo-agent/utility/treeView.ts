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
 * ツリービュー生成ユーティリティ
 * 
 * このモジュールは、階層構造のデータを視覚的に表示するためのツリー構造を生成する
 * 汎用的な関数を提供します。レイアウト、フォルダなど様々な種類の階層データで利用できます。
 */

import { z } from 'zod';

/**
 * ツリーノードの基本インターフェース
 * すべてのツリーノードはこのインターフェースを実装する必要がある
 */
export interface TreeNode {
  id: number;
  name: string;
  type: string;
  children?: TreeNode[];
  [key: string]: any; // その他の追加プロパティを許可
}

/**
 * フラット化されたツリーノードの型定義
 */
export interface FlatTreeNode {
  id: number;
  name: string;
  type: string;
  depth: number;
  isLast: boolean;
  path: string;
  [key: string]: any; // その他の追加プロパティを許可
}

/**
 * ツリービュー用のレスポンススキーマ
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
 * ツリービューのテキスト表現を生成する
 * 
 * @param tree 階層構造のツリー
 * @param indent 現在のインデント文字列
 * @param nodeFormatter ノードの表示形式をカスタマイズするオプションの関数
 * @returns フォーマットされたツリービューの文字列
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
    
    // ノードの表示形式をフォーマット
    let nodeDisplay: string;
    if (nodeFormatter) {
      // カスタムフォーマッタがある場合はそれを使用
      nodeDisplay = nodeFormatter(node);
    } else {
      // デフォルトの表示形式
      nodeDisplay = `${node.type}: ${node.name}`;
      
      // 特定のノード型に特別な表示を適用
      if (node.type === 'widget' && node.duration !== undefined) {
        nodeDisplay += ` (${node.duration}s)`;
      }
    }
    
    output += `${indent}${linePrefix}${nodeDisplay}\n`;
    
    // 子ノードを処理
    if (node.children && node.children.length > 0) {
      const childIndent = indent + (isLast ? '   ' : '│  ');
      output += generateTreeView(node.children, childIndent, nodeFormatter);
    }
  });
  
  return output;
}

/**
 * ツリーを平坦化して、深さとパス情報を含む配列にする
 * 
 * @param tree 階層構造のツリー
 * @param depth 現在の深さ
 * @param path 現在のパス
 * @param result 平坦化した結果を集める配列
 * @param nodePathFormatter ノードのパス表示をカスタマイズするオプションの関数
 * @returns 深さとパス情報を含むノードの配列
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
    
    // ノードのパス表示をフォーマット
    let nodePath: string;
    if (nodePathFormatter) {
      nodePath = nodePathFormatter(node);
    } else {
      nodePath = node.name;
    }
    
    const currentPath = path ? `${path} > ${nodePath}` : nodePath;
    
    // 基本プロパティをコピー
    const flatNode: FlatTreeNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      depth,
      isLast,
      path: currentPath
    };
    
    // 特別な処理が必要なプロパティをコピー
    if (node.duration !== undefined) {
      flatNode.duration = node.duration;
    }
    
    result.push(flatNode);
    
    // 子ノードを処理
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, depth + 1, currentPath, result, nodePathFormatter);
    }
  });
  
  return result;
}

/**
 * ツリー表示用の結果オブジェクトを生成する
 * 
 * @param data 元のデータ（配列またはオブジェクト）
 * @param tree 構築済みのツリー構造
 * @param nodeFormatter オプションのノード表示フォーマッタ
 * @returns ツリー表示を含む結果オブジェクト
 */
export function createTreeViewResponse(
  data: any[] | object,
  tree: TreeNode[],
  nodeFormatter?: (node: TreeNode) => string
): any {
  const treeViewString = generateTreeView(tree, '', nodeFormatter);
  // マークダウンコードブロックとしてフォーマット
  const formattedTreeView = "```text\n" + treeViewString + "```";
  const flattenedTree = flattenTree(tree);
  
  return {
    success: true,
    data: data,
    tree: flattenedTree,
    treeViewText: formattedTreeView
  };
} 