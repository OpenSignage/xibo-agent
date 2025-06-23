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

import 'dotenv/config';

// Import core tools individually to ensure they're always available for getTools()
import { getCmsTime, getAbout } from './misc';
import { getUser, getUserMe, addUser, deleteUser, editUser, getUserPermissions,
  setUserPermissions, getUserPreferences, setUserPreferences,
  getMultiEntityPermissions, editUserPreferences } from './user';
import { getModules, getModuleProperties, getModuleTemplateProperties, getModuleTemplates } from './modules';
import { getDisplays } from './display';
import { getLayouts, addLayout, deleteLayout, retireLayout, unretireLayout,
  clearLayout, getLayoutStatus, checkoutLayout, discardLayout,editLayout,
  setLayoutEnableStat,editLayoutBackground,copyLayout,tagLayout,untagLayout,
  publishLayout,applyLayoutTemplate,addFullscreenLayout,addRegion,editRegion,
  addDrawerRegion,saveDrawerRegion,deleteRegion,positionAllRegions } from './layout';
import { getFolders, addFolder, editFolder, deleteFolder } from './folder';
import { getResolutions, addResolution, editResolution, deleteResolution } from './resolution';
import { getNews, getGoogleFonts, uploadGoogleFonts, getUploadFiles, deleteUploadFiles } from './etc';
import { getFonts, getFontDetails, uploadFont } from './font';
import { getUserGroups, addUserGroup } from './usergroup';
import { getPlaylists, addPlaylist, editPlaylist } from './playlist';
import { getStats } from './statistics';
import { getTags, addTag, editTag, deleteTag } from './tags';
import { getLibrary, searchAllLibrary, addMedia, uploadMediaFromURL } from './library';
import { generateImage, updateImage, getImageHistory } from './generate';
  import { getNotifications, deleteNotification, addNotification, editNotification } from './notification';
import { getDisplayGroups } from './displayGroup';
import { getTemplate, searchAllTemplates, addTemplate, addTemplateFromLayout } from './template';
import { getLogs } from './log';
import { getTransition } from './transition';
import { getDayParts, addDayPart, editDayPart, deleteDayPart } from './dayPart';
import { changePassword } from './compound';

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
export * from './generate';     // Image and Video generate
export * from './log';          // Log management
export * from './transition';   // Transition management
export * from './compound';     // Compound tools

/**
 * Returns all available Xibo API tools in a structured object
 * 
 * This function is the recommended way to get all tools at once.
 * It ensures consistent tool IDs and handles proper initialization.
 * 
 * @returns Object containing all tool instances with their IDs as keys
 */
export function getTools() {
  return {
    // Misc
    getCmsTime,getAbout,
    // Log
    getLogs,
    // Transition
    getTransition,
    // User
    getUser,getUserMe,addUser,deleteUser,editUser,getUserPermissions,
    setUserPermissions,getUserPreferences,setUserPreferences,
    getMultiEntityPermissions,editUserPreferences,
    // Module 
    getModules,getModuleProperties,getModuleTemplateProperties,getModuleTemplates, 
    // Display
    getDisplays,
    // Layout    
    getLayouts,addLayout,deleteLayout,retireLayout,unretireLayout,clearLayout,
    getLayoutStatus,checkoutLayout,discardLayout,setLayoutEnableStat,editLayout,
    editLayoutBackground,copyLayout,tagLayout,untagLayout,publishLayout,
    applyLayoutTemplate,addFullscreenLayout,addRegion,editRegion,addDrawerRegion,
    saveDrawerRegion,deleteRegion,positionAllRegions,
    // Folder
    getFolders,addFolder,editFolder,deleteFolder,
    // Resolution
    getResolutions,addResolution,editResolution,deleteResolution,
    // Etc
    getNews,getGoogleFonts,uploadGoogleFonts,getUploadFiles,deleteUploadFiles,
    // Font
    getFonts,getFontDetails,uploadFont,
    // User group
    getUserGroups,addUserGroup,
    // Playlist
    getPlaylists,addPlaylist,editPlaylist,
    // Statistics
    getStats,
    // Tags
    getTags,addTag,editTag,deleteTag,
    // Library
    getLibrary,searchAllLibrary,addMedia,uploadMediaFromURL,
    // Generation
    generateImage,updateImage,getImageHistory,
    // Notification
    getNotifications,deleteNotification,addNotification,editNotification,
    // Display group
    getDisplayGroups,
    // Template
    getTemplate,searchAllTemplates,addTemplate,addTemplateFromLayout,
    // Day part
    getDayParts,addDayPart,editDayPart,deleteDayPart,
    // Compound
    changePassword
  };
}