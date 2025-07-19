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
  setUserPermissions,getMultiEntityPermissions, editUserPref, getUserPref,
  addUserPref} from './user';  
import { getModules, getModuleProperties, getModuleTemplateProperties, getModuleTemplates } from './modules';
import { getDisplays, wakeDisplayOnLan, toggleAuthoriseForDisplay, setDefaultLayoutForDisplay,
  checkDisplayLicence, getDisplayStatus, purgeAllMediaFromDisplay, editDisplay,
  requestDisplayScreenshot, deleteDisplay } from './display';
import { getLayouts, addLayout, deleteLayout, retireLayout, unretireLayout,
  clearLayout, getLayoutStatus, checkoutLayout, discardLayout,editLayout,
  setLayoutEnableStat,editLayoutBackground,copyLayout,tagLayout,untagLayout,
  publishLayout,applyLayoutTemplate,addFullscreenLayout,addRegion,editRegion,
  addDrawerRegion,saveDrawerRegion,deleteRegion,positionAllRegions } from './layout';
import { getFolders, addFolder, editFolder, deleteFolder } from './folder';
import { getResolutions, addResolution, editResolution, deleteResolution } from './resolution';
import { getGoogleFonts, uploadGoogleFonts, getUploadFiles, deleteUploadFiles,
  generateQRCode, getLatestPlayer } from './etc';
import { getFonts, getFontDetails, uploadFont, downloadFont, deleteFont } from './font';
import { getUserGroups, addUserGroup, deleteUserGroup, editUserGroup, copyUserGroup,
  assignUserToGroup, unassignUserFromGroup } from './usergroup';
import { getPlaylists, addPlaylist, editPlaylist, deletePlaylist, copyPlaylist,
  assignLibraryItems, getPlaylistUsage, getPlaylistUsageByLayouts, setPlaylistEnableStat,
   selectPlaylistFolder } from './playlist';
import { getStats, getTimeDisconnected, getExportStatsCount } from './statistics';
import { getTags, addTag, editTag, deleteTag } from './tags';
import { getLibrary, addMedia, uploadMediaFromURL, downloadThumbnail, editMedia,
  deleteMedia, downloadMedia, assignTagsToMedia, unassignTagsFromMedia,
  setEnableStatToMedia, getMediaUsage, getMediaUsageLayouts, copyMedia, isMediaUsed,
  selectMediaFolder } from './library';
import { generateImage, updateImage, getImageHistory } from './generateImage';
import { videoGeneration, videoUpdate, getVideoHistory } from './generateVideo';
import { getNotifications, deleteNotification, addNotification, editNotification } from './notification';
import { getDisplayGroups, addDisplayGroup, editDisplayGroup, deleteDisplayGroup,
  assignDisplaysToDisplayGroup, unassignDisplaysFromDisplayGroup, collectNowForDisplayGroup,
  clearStatsAndLogsForDisplayGroup, revertDisplayGroupToSchedule, sendCommandToDisplayGroup,
  copyDisplayGroup, selectFolderForDisplayGroup, triggerWebhookForDisplayGroup } from './displayGroup';
import { getTemplate, addTemplate, addTemplateFromLayout } from './template';
import { getLogs, getAgentLog } from './log';
import { getTransition } from './transition';
import { getDayParts, addDayPart, editDayPart, deleteDayPart } from './dayPart';
import { changePassword } from './compound';
import { getDisplayVenues } from './displayVenue';
import { getXiboNews, getGoogleNews } from './news';
import { getWeather, getWeeklyWeather, getWeatherByCoordinates } from './weather';
import { getSyncGroups, addSyncGroup, editSyncGroup, deleteSyncGroup, getSyncGroupDisplays,
  assignSyncGroupMembers } from './syncGroup';
import { deletePlayerVersion, downloadPlayerVersion, editPlayerVersion, uploadPlayerSoftware } from './playerSoftware';
import { addWidget, editWidget, deleteWidget, editWidgetTransition, editWidgetAudio, deleteWidgetAudio,
  setWidgetRegion, saveWidgetElements, setWidgetDataType, getWidgetData, addWidgetData, editWidgetData,
  deleteWidgetData } from './widget';
import { addCommand, deleteCommand, editCommand, getCommands } from './command';
import { getDisplayProfiles, addDisplayProfile, editDisplayProfile, deleteDisplayProfile } from './displayprofile';
import { getDataSets, addDataSet, editDataSet, deleteDataSet, getDataSetColumns, addDataSetColumn,
  editDataSetColumn, deleteDataSetColumn, getDataSetData, addDataSetData, editDataSetData,
  deleteDataSetData, importDataSetData, exportDataSetData, importDataSetDataJson, copyDataSet,
  selectDataSetFolder, getDataSetRss, addDataSetRss, editDataSetRss, 
  deleteDataSetRss, editDataSetConnector } from './dataset';
import { addAction, deleteAction, getActions } from './action';
import { addCampaign, editCampaign, deleteCampaign, getCampaigns, assignLayoutToCampaign,
  removeLayoutFromCampaign, selectCampaignFolder } from './campaign';
import { addMenuBoard, addMenuBoardCategory, addMenuBoardProduct, deleteMenuBoard,
  deleteMenuBoardCategory, deleteMenuBoardProduct, editMenuBoard, editMenuBoardCategory,
  editMenuBoardProduct, getMenuBoardCategories, getMenuBoardProducts, getMenuBoards,
  selectMenuBoardFolder, getMenuBoardTree } from './menuBoard';
import { deleteSchedule, deleteScheduleRecurrence, getSchedule, getScheduleDataEvents,
  getScheduleDisplayGroupIdEvents, addSchedule, editSchedule } from './schedule';

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
export * from './generateImage';     // Image  generate
export * from './generateVideo';     // Video generate
export * from './log';          // Log management
export * from './transition';   // Transition management
export * from './compound';     // Compound tools
export * from './displayVenue'; // Display venue management
export * from './news';         // News management
export * from './weather';      // Weather management
export * from './syncGroup';    // Synchronization group management
export * from './command';      // Command management
export * from './dataset';      // Dataset management
export * from './campaign';     // Campaign management

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
    getLogs,getAgentLog,
    // Transition
    getTransition,
    // User
    getUser,getUserMe,addUser,deleteUser,editUser,getUserPermissions,setUserPermissions,
    getMultiEntityPermissions,editUserPref,getUserPref,addUserPref,
    // Module 
    getModules,getModuleProperties,getModuleTemplateProperties,getModuleTemplates, 
    // Display
    getDisplays,wakeDisplayOnLan,toggleAuthoriseForDisplay,setDefaultLayoutForDisplay,
    checkDisplayLicence,getDisplayStatus,purgeAllMediaFromDisplay,editDisplay,
    requestDisplayScreenshot,deleteDisplay,
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
    getGoogleFonts,uploadGoogleFonts,getUploadFiles,deleteUploadFiles,
    getLatestPlayer,
    // Font
    getFonts,getFontDetails,uploadFont,downloadFont,deleteFont,
    // User group
    getUserGroups,addUserGroup,deleteUserGroup,editUserGroup,copyUserGroup,
    assignUserToGroup,unassignUserFromGroup,
    // Playlist
    getPlaylists,addPlaylist,editPlaylist,deletePlaylist,copyPlaylist,
    assignLibraryItems,getPlaylistUsage,getPlaylistUsageByLayouts,
    setPlaylistEnableStat,selectPlaylistFolder,
    // Statistics
    getStats,getTimeDisconnected,
    getExportStatsCount,
    // Tags
    getTags,addTag,editTag,deleteTag,
    // Library
    getLibrary,addMedia,uploadMediaFromURL,downloadThumbnail,editMedia,
      deleteMedia,downloadMedia,assignTagsToMedia,unassignTagsFromMedia,
      setEnableStatToMedia,getMediaUsage,getMediaUsageLayouts,
      copyMedia,isMediaUsed,selectMediaFolder,
    // Generation
    generateImage,updateImage,getImageHistory,generateQRCode,
    videoGeneration, videoUpdate, getVideoHistory,
    // Notification
    getNotifications,deleteNotification,addNotification,editNotification,
    // Display group
    getDisplayGroups,addDisplayGroup,editDisplayGroup,deleteDisplayGroup,
    assignDisplaysToDisplayGroup,unassignDisplaysFromDisplayGroup,
    collectNowForDisplayGroup,clearStatsAndLogsForDisplayGroup,
    revertDisplayGroupToSchedule,sendCommandToDisplayGroup,copyDisplayGroup,
    selectFolderForDisplayGroup,triggerWebhookForDisplayGroup,
    // Template
    getTemplate,addTemplate,addTemplateFromLayout,
    // Day part
    getDayParts,addDayPart,editDayPart,deleteDayPart,
    // Compound
    changePassword,
    // Display venue
    getDisplayVenues,
    // News
    getXiboNews,getGoogleNews,
    // Weather
    getWeather,getWeeklyWeather,getWeatherByCoordinates,
    // Sync group
    getSyncGroups,addSyncGroup,editSyncGroup,deleteSyncGroup,getSyncGroupDisplays,
    assignSyncGroupMembers,
    // Player software
    deletePlayerVersion,downloadPlayerVersion,editPlayerVersion,uploadPlayerSoftware,
    // Widget
    addWidget,editWidget,deleteWidget,editWidgetTransition,editWidgetAudio,deleteWidgetAudio,
    setWidgetRegion,saveWidgetElements,setWidgetDataType,getWidgetData,addWidgetData,
    editWidgetData,deleteWidgetData,
    // Command
    addCommand,deleteCommand,editCommand,getCommands,
    // Display profile
    getDisplayProfiles,addDisplayProfile,editDisplayProfile,deleteDisplayProfile,
    // Dataset
    getDataSets,addDataSet,editDataSet,deleteDataSet,
    getDataSetColumns,addDataSetColumn,editDataSetColumn,deleteDataSetColumn,
    getDataSetData,addDataSetData,editDataSetData,importDataSetDataJson,
    deleteDataSetData,importDataSetData,exportDataSetData,copyDataSet,
    selectDataSetFolder,getDataSetRss,addDataSetRss,editDataSetRss,
    deleteDataSetRss,editDataSetConnector,
    // Action
    addAction,deleteAction,getActions,
    // Campaign
    addCampaign,editCampaign,deleteCampaign,getCampaigns,
    assignLayoutToCampaign,removeLayoutFromCampaign,selectCampaignFolder,
    // Menu board
    addMenuBoard,addMenuBoardCategory,addMenuBoardProduct,deleteMenuBoard,
    deleteMenuBoardCategory,deleteMenuBoardProduct,editMenuBoard,editMenuBoardCategory,
    editMenuBoardProduct,getMenuBoardCategories,getMenuBoardProducts,getMenuBoards,
    selectMenuBoardFolder,getMenuBoardTree,
    // Schedule
    deleteSchedule,deleteScheduleRecurrence,getSchedule,getScheduleDataEvents,
    getScheduleDisplayGroupIdEvents,addSchedule,editSchedule,
  };
}