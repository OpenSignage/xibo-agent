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
 * Xibo CMS API Tool Collection
 * 
 * This module exports all available tools for interacting with the Xibo CMS API.
 * Tools are organized by category and can be imported individually or as a complete set.
 */

// Import core tools individually to ensure they're always available for getTools()
import { getCmsTime, getAbout } from './misc';
import { getUser, getUsers, getUserMe, addUser } from './user';
import { getModules } from './modules';
import { getDisplays } from './display';
import { getLayouts, addLayout, deleteLayout, retireLayout, unretireLayout,
  clearLayout, getLayoutStatus, checkoutLayout, discardLayout } from './layout';
import { getFolders, addFolder, editFolder, deleteFolder } from './folder';
import { getResolutions, addResolution, editResolution, deleteResolution } from './resolution';

// Basic functionality - module exports
export * from './misc';         // System information and utilities
export * from './user';         // User management
export * from './modules';      // Module management
export * from './display';      // Display management
export * from './layout';       // Layout management
export * from './playlist';     // Playlist management
export * from './schedule';     // Schedule management
export * from './notification'; // Notification management
export * from './widget';       // Widget management
export * from './template';     // Template management
export * from './resolution';   // Resolution management
export * from './library';      // Media library management
export * from './displayGroup'; // Display group management
export * from './displayprofile'; // Display profile management
export * from './folder';       // Folder management

// Extendednctionality  fu- module exports
export * from './action';       // Action management
export * from './displayVenue'; // Display venue management
export * from './font';         // Font management
export * from './menuBoard';    // Menu board management
export * from './playerSoftware'; // Player software management
export * from './syncGroup';    // Synchronization group management
export * from './usergroup';    // User group management
export * from './tags';         // Tags management
export * from './dayPart';      // Day part management

/**
 * Returns all available Xibo API tools in a structured object
 * 
 * This function is the recommended way to get all tools at once.
 * It ensures consistent tool IDs and handles proper initialization.
 * 
 * @returns Object containing all tool instances with their IDs as keys
 */
export function getTools() {
  // Core tools (guaranteed to be available)
  const tools = {
    'get-cms-time': getCmsTime,
    'get-about': getAbout,
    'get-user': getUser,
    'get-users': getUsers,
    'get-user-me': getUserMe,
    'add-user': addUser,
    'get-modules': getModules,
    'get-displays': getDisplays,
    'get-layouts': getLayouts,
    'add-layout': addLayout,
    'get-folders': getFolders,
    'add-folder': addFolder,
    'edit-folder': editFolder,
    'delete-folder': deleteFolder,
    'get-resolutions': getResolutions,
    'add-resolution': addResolution,
    'edit-resolution': editResolution,
    'delete-resolution': deleteResolution,
    'delete-layout': deleteLayout,
    'retire-layout': retireLayout,
    'unretire-layout': unretireLayout,
    'clear-layout': clearLayout,
    'get-layout-status': getLayoutStatus,
    'checkout-layout': checkoutLayout,
    'discard-layout': discardLayout
  };

  // 確認が必要な危険なツールのリスト
  const dangerousTools = [
    'delete-layout',
    'delete-folder',
    'delete-resolution',
    // 他の削除系ツールもここに追加
  ];

  /* 一時的に無効化（コメントアウト）
  // ユーザー確認を求める関数
  const confirmDangerousOperation = async (toolId: string, context: any): Promise<boolean> => {
    // コンテキストをログに出力（デバッグ用）
    console.log(`確認処理が呼び出されました。ツールID: ${toolId}`);
    console.log(`コンテキスト:`, context);

    // confirmed フラグが true なら無条件に確認済みとする
    if (context && context.confirmed === true) {
      console.log("確認済みフラグが見つかりました。操作を続行します。");
      return true;
    }

    // ツールIDに基づいて確認メッセージをカスタマイズ
    let confirmMessage = "この操作は取り消せません。続行しますか？";
    
    // ツール別のメッセージ
    switch (toolId) {
      case 'delete-layout':
        confirmMessage = `レイアウト(ID: ${context.layoutId})を削除します。この操作は取り消せません。続行しますか？`;
        break;
      case 'delete-folder':
        confirmMessage = `フォルダ(ID: ${context.folderId})を削除します。この操作は取り消せません。続行しますか？`;
        break;
      case 'delete-resolution':
        confirmMessage = `解像度(ID: ${context.resolutionId})を削除します。この操作は取り消せません。続行しますか？`;
        break;
      // 他のケースもここに追加
    }
    
    // 確認ダイアログ表示（実際の実装は環境に依存）
    console.warn(`警告: ${confirmMessage}`);
    
    // 環境変数による自動確認モード
    // AUTO_CONFIRM=true の場合、確認なしで自動的に処理を続行
    const autoConfirm = process.env.AUTO_CONFIRM === 'false';
    
    if (autoConfirm) {
      console.log("自動確認モードが有効です。ユーザー確認なしで操作を続行します。");
      return true;
    }
    
    // Mastraの環境でブラウザ側に確認を促すための特殊なエラー
    throw {
      requiresConfirmation: true,
      message: confirmMessage,
      toolId: toolId,
      context: context
    };
  };
  */

  // ツールのラッパー作成関数
  const wrapWithConfirmation = (tool: any) => {
    // オリジナルのexecute関数を保存
    const originalExecute = tool.execute;
    
    // execute関数をオーバーライド
    tool.execute = async (params: any) => {
      // 危険な操作の確認を一時的に無効化（コメントアウト）
      /* 
      console.log(`${tool.id} が実行されました。パラメータ:`, JSON.stringify(params, null, 2));
      
      // 特別な「実行する」コマンドを検出して確認済みとして処理
      const isConfirmedByCommand = 
        params?.context?.command === '実行する' || 
        params?.context?.message === '実行する';
      
      if (isConfirmedByCommand) {
        console.log(`「実行する」コマンドを検出しました。確認済みとして実行します。`);
        // 危険なコマンドでも確認済みとして実行
        return await originalExecute(params);
      }
      
      try {
        // 確認済みフラグをチェック (複数の場所をチェック)
        const isConfirmed = 
          params?.context?.confirmed === true || 
          params?.confirmed === true || 
          params?.context?.context?.confirmed === true;
        
        console.log(`確認済みフラグの状態: ${isConfirmed}`);
        
        // ツールIDが危険なリストに含まれていて、確認されていない場合
        if (dangerousTools.includes(tool.id) && !isConfirmed) {
          
          console.log(`${tool.id} は確認が必要です。`);
          
          try {
            // ユーザーに確認を求める
            await confirmDangerousOperation(tool.id, params.context);
            // ここには到達しないはず（確認処理は例外をスロー）
          } catch (confirmError: any) {
            // 確認が必要なエラーの場合
            if (confirmError && confirmError.requiresConfirmation) {
              console.log(`確認が必要なエラーが発生しました: ${confirmError.message}`);
              
              // クライアント側に確認が必要なことを伝えるレスポンス
              return {
                success: false,
                requiresConfirmation: true,
                message: confirmError.message,
                toolId: confirmError.toolId,
                // 元のコンテキストに確認済みフラグを追加
                context: {
                  ...confirmError.context,
                  confirmed: true
                }
              };
            }
            // その他のエラーは再スロー
            throw confirmError;
          }
        }
      } catch (error) {
        // その他のエラー処理
        console.error(`Tool execution error in ${tool.id}:`, error);
        return {
          success: false,
          message: error instanceof Error ? error.message : "不明なエラーが発生しました。"
        };
      }
      */
      
      // 確認をスキップして直接実行
      console.log(`${tool.id} を実行します（確認ダイアログを一時的に無効化）`);
      return await originalExecute(params);
    };
    
    return tool;
  };

  // すべてのツールをラップ
  Object.keys(tools).forEach(key => {
    // @ts-ignore
    tools[key] = wrapWithConfirmation(tools[key]);
  });
  
  // Additional tools could be added here conditionally if needed
  
  return tools;
}