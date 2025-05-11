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
import { getLayouts, addLayout, deleteLayout } from './layout';
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
    'delete-layout': deleteLayout
  };

  // Additional tools could be added here conditionally if needed
  
  return tools;
}