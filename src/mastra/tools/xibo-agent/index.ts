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

import { logger } from '../../index';

// Import core tools individually to ensure they're always available for getTools()
import { getCmsTime, getAbout } from './misc';
import { getUser, getUsers, getUserMe, addUser, deleteUser, editUser } from './user';
import { getModules, getModuleProperties, getModuleTemplateProperties } from './modules';
import { getDisplays } from './display';
import { getLayouts, addLayout, deleteLayout, retireLayout, unretireLayout,
  clearLayout, getLayoutStatus, checkoutLayout, discardLayout } from './layout';
import { getFolders, addFolder, editFolder, deleteFolder } from './folder';
import { getResolutions, addResolution, editResolution, deleteResolution } from './resolution';
import { getNews, getGoogleFonts, uploadGoogleFonts, getUploadFiles, deleteUploadFiles } from './etc';
import { getFonts, getFontDetails, uploadFont } from './font';
import { getUserGroups, addUserGroup } from './usergroup';
import { getPlaylists } from './playlist';
import { getStats } from './statistics';
import { getTags, addTag, editTag, deleteTag } from './tags';
import { getLibrary, searchAllLibrary, addMedia } from './library';

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
export * from './etc';          // Miscellaneous utilities
export * from './action';       // Action management
export * from './displayVenue'; // Display venue management
export * from './font';         // Font management
export * from './menuBoard';    // Menu board management
export * from './playerSoftware'; // Player software management
export * from './syncGroup';    // Synchronization group management
export * from './usergroup';    // User group management
export * from './tags';         // Tags management
export * from './dayPart';      // Day part management
export * from './statistics';   // Statistics management

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
    // Misc
    'get-cms-time': getCmsTime,
    'get-about': getAbout,
    // User
    'get-user': getUser,
    'get-users': getUsers,
    'get-user-me': getUserMe,
    'add-user': addUser,
    'delete-user': deleteUser,
    'edit-user': editUser,
    // Modules
    'get-modules': getModules,
    // Display
    'get-displays': getDisplays,
    'get-layouts': getLayouts,
    'add-layout': addLayout,
    // Folder
    'get-folders': getFolders,
    'add-folder': addFolder,
    'edit-folder': editFolder,
    'delete-folder': deleteFolder,
    // Resolution
    'get-resolutions': getResolutions,
    'add-resolution': addResolution,
    'edit-resolution': editResolution,
    'delete-resolution': deleteResolution,
    // Layout
    'delete-layout': deleteLayout,
    'retire-layout': retireLayout,
    'unretire-layout': unretireLayout,
    'clear-layout': clearLayout,
    'get-layout-status': getLayoutStatus,
    'checkout-layout': checkoutLayout,
    'discard-layout': discardLayout,
    // Etc
    'get-news': getNews,
    'get-google-fonts': getGoogleFonts,
    'upload-google-fonts': uploadGoogleFonts,
    'get-upload-files': getUploadFiles,
    'delete-upload-files': deleteUploadFiles,
    // Font
    'get-fonts': getFonts,
    'get-font-details': getFontDetails,
    'upload-font': uploadFont,
    // User group
    'get-user-groups': getUserGroups,
    'add-user-group': addUserGroup,
    // Playlist
    'get-playlists': getPlaylists,
    // Statistics
    'get-stats': getStats,
    // Tags
    'get-tags': getTags,
    'add-tag': addTag,
    'edit-tag': editTag,
    'delete-tag': deleteTag,
    // Library
    'get-library': getLibrary,
    'search-all-library': searchAllLibrary,
    'add-media': addMedia,
  };

  // List of tools that require confirmation due to potentially dangerous operations
  const dangerousTools = [
    'delete-layout',
    'delete-folder',
    'delete-resolution',
    'delete-user',
    'delete-tag', 
    'delete-upload-files',
    // Add other destructive tools here
  ];

  /* Temporarily disabled (commented out)
  // Function to request user confirmation
  const confirmDangerousOperation = async (toolId: string, context: any): Promise<boolean> => {
    // Log context for debugging
    logger.debug(`Confirmation process called. Tool ID: ${toolId}`);
    logger.debug(`Context:`, context);

    // If confirmed flag is true, bypass confirmation
    if (context && context.confirmed === true) {
      logger.info("Confirmation flag found. Proceeding with operation.");
      return true;
    }

    // Customize confirmation message based on tool ID
    let confirmMessage = "This operation cannot be undone. Do you want to continue?";
    
    // Tool-specific messages
    switch (toolId) {
      case 'delete-layout':
        confirmMessage = `You are about to delete layout (ID: ${context.layoutId}). This operation cannot be undone. Continue?`;
        break;
      case 'delete-folder':
        confirmMessage = `You are about to delete folder (ID: ${context.folderId}). This operation cannot be undone. Continue?`;
        break;
      case 'delete-resolution':
        confirmMessage = `You are about to delete resolution (ID: ${context.resolutionId}). This operation cannot be undone. Continue?`;
        break;
      // Add other cases here
    }
    
    // Display confirmation dialog (implementation depends on environment)
    logger.warn(`Warning: ${confirmMessage}`);
    
    // Auto-confirm mode via environment variable
    // If AUTO_CONFIRM=true, proceed without confirmation
    const autoConfirm = process.env.AUTO_CONFIRM === 'false';
    
    if (autoConfirm) {
      logger.info("Auto-confirm mode enabled. Proceeding without user confirmation.");
      return true;
    }
    
    // Special error to prompt confirmation in browser in Mastra environment
    throw {
      requiresConfirmation: true,
      message: confirmMessage,
      toolId: toolId,
      context: context
    };
  };
  */

  // Function to create tool wrappers
  const wrapWithConfirmation = (tool: any) => {
    // Save the original execute function
    const originalExecute = tool.execute;
    
    // Override the execute function
    tool.execute = async (params: any) => {
      // Confirmation for dangerous operations temporarily disabled (commented out)
      /* 
      logger.debug(`${tool.id} executed with parameters:`, JSON.stringify(params, null, 2));
      
      // Detect special "execute" command as confirmation
      const isConfirmedByCommand = 
        params?.context?.command === '実行する' || 
        params?.context?.message === '実行する';
      
      if (isConfirmedByCommand) {
        logger.info(`"Execute" command detected. Proceeding as confirmed.`);
        // Execute even if it's a dangerous command
        return await originalExecute(params);
      }
      
      try {
        // Check for confirmation flags (check multiple locations)
        const isConfirmed = 
          params?.context?.confirmed === true || 
          params?.confirmed === true || 
          params?.context?.context?.confirmed === true;
        
        logger.debug(`Confirmation flag status: ${isConfirmed}`);
        
        // If tool ID is in dangerous list and not confirmed
        if (dangerousTools.includes(tool.id) && !isConfirmed) {
          
          logger.info(`${tool.id} requires confirmation.`);
          
          try {
            // Request user confirmation
            await confirmDangerousOperation(tool.id, params.context);
            // Should not reach here (confirmation process throws exception)
          } catch (confirmError: any) {
            // If it's a confirmation required error
            if (confirmError && confirmError.requiresConfirmation) {
              logger.info(`Confirmation required error occurred: ${confirmError.message}`);
              
              // Response to client indicating confirmation is required
              return {
                success: false,
                requiresConfirmation: true,
                message: confirmError.message,
                toolId: confirmError.toolId,
                // Add confirmation flag to original context
                context: {
                  ...confirmError.context,
                  confirmed: true
                }
              };
            }
            // Re-throw other errors
            throw confirmError;
          }
        }
      } catch (error) {
        // Other error handling
        logger.error(`Tool execution error in ${tool.id}:`, error);
        return {
          success: false,
          message: error instanceof Error ? error.message : "An unknown error occurred."
        };
      }
      */
      
      // Skip confirmation and execute directly
      logger.info(`Executing ${tool.id} (confirmation dialog temporarily disabled)`);
      return await originalExecute(params);
    };
    
    return tool;
  };

  // Wrap all tools
  Object.keys(tools).forEach(key => {
    // @ts-ignore
    tools[key] = wrapWithConfirmation(tools[key]);
  });
  
  // Additional tools could be added here conditionally if needed
  
  return tools;
}