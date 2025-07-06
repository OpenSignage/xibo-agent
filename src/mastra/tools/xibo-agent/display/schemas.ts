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
 * This module defines common Zod schemas for the Display tools in the Xibo Agent.
 * These schemas are used for data validation and type inference across multiple tools.
 */

import { z } from 'zod';

/**
 * Schema for tag data associated with displays or display groups.
 */
export const tagSchema = z.object({
  tag: z.string().describe('The name of the tag.'),
  tagId: z.number().describe('The unique identifier for the tag.'),
  value: z.string().describe('The value associated with the tag.'),
});

/**
 * Schema for display group data.
 */
export const displayGroupSchema = z.object({
  displayGroupId: z.number().describe('The unique identifier for the display group.'),
  displayGroup: z.string().describe('The name of the display group.'),
  description: z.string().describe('A description for the display group.'),
  isDisplaySpecific: z.number().describe('Flag indicating if the group is display-specific.'),
  isDynamic: z.number().describe('Flag indicating if the group is dynamic.'),
  dynamicCriteria: z.string().describe('The criteria for a dynamic group.'),
  dynamicCriteriaLogicalOperator: z.string().describe('The logical operator for dynamic criteria.'),
  dynamicCriteriaTags: z.string().describe('Tags used for dynamic criteria.'),
  dynamicCriteriaExactTags: z.number().describe('Flag for exact tag matching in dynamic criteria.'),
  dynamicCriteriaTagsLogicalOperator: z.string().describe('The logical operator for dynamic tag criteria.'),
  userId: z.number().describe('The user ID of the group owner.'),
  tags: z.array(tagSchema).describe('An array of tags associated with the display group.'),
  bandwidthLimit: z.number().describe('The bandwidth limit for the group.'),
  groupsWithPermissions: z.string().describe('Permissions for the group.'),
  createdDt: z.string().describe('The creation date of the group.'),
  modifiedDt: z.string().describe('The last modification date of the group.'),
  folderId: z.number().describe('The ID of the folder containing the group.'),
  permissionsFolderId: z.number().describe('The ID of the folder that defines permissions.'),
  ref1: z.string().describe('Optional reference field 1.'),
  ref2: z.string().describe('Optional reference field 2.'),
  ref3: z.string().describe('Optional reference field 3.'),
  ref4: z.string().describe('Optional reference field 4.'),
  ref5: z.string().describe('Optional reference field 5.'),
});

/**
 * Schema for a single display object.
 */
export const displaySchema = z.object({
  displayId: z.number().describe('The unique identifier for the display.'),
  displayTypeId: z.number().describe('The ID of the display type.'),
  venueId: z.number().describe('The ID of the venue.'),
  address: z.string().describe('The physical address of the display.'),
  isMobile: z.number().describe('Flag indicating if the display is mobile.'),
  languages: z.string().describe('Languages supported by the display.'),
  displayType: z.string().describe('The type of the display.'),
  screenSize: z.number().describe('The screen size.'),
  isOutdoor: z.number().describe('Flag indicating if the display is outdoors.'),
  customId: z.string().describe('A custom identifier for the display.'),
  costPerPlay: z.number().describe('The cost per play for advertising.'),
  impressionsPerPlay: z.number().describe('The number of impressions per play.'),
  ref1: z.string().describe('Optional reference field 1.'),
  ref2: z.string().describe('Optional reference field 2.'),
  ref3: z.string().describe('Optional reference field 3.'),
  ref4: z.string().describe('Optional reference field 4.'),
  ref5: z.string().describe('Optional reference field 5.'),
  auditingUntil: z.number().describe('Timestamp until which auditing is active.'),
  display: z.string().describe('The name of the display.'),
  description: z.string().describe('A description for the display.'),
  defaultLayoutId: z.number().describe('The ID of the default layout.'),
  license: z.string().describe('The license key for the display.'),
  licensed: z.number().describe('Flag indicating if the display is licensed.'),
  loggedIn: z.number().describe('Flag indicating if the display is logged in.'),
  lastAccessed: z.number().describe('Timestamp of the last access.'),
  incSchedule: z.number().describe('Flag to include in schedule.'),
  emailAlert: z.number().describe('Flag for email alerts.'),
  alertTimeout: z.number().describe('The timeout for alerts.'),
  clientAddress: z.string().describe('The IP address of the client.'),
  mediaInventoryStatus: z.number().describe('The status of the media inventory.'),
  macAddress: z.string().describe('The MAC address of the display.'),
  lastChanged: z.number().describe('Timestamp of the last change.'),
  numberOfMacAddressChanges: z.number().describe('The number of MAC address changes.'),
  lastWakeOnLanCommandSent: z.number().describe('Timestamp of the last WoL command.'),
  wakeOnLanEnabled: z.number().describe('Flag indicating if WoL is enabled.'),
  wakeOnLanTime: z.string().describe('The time for WoL.'),
  broadCastAddress: z.string().describe('The broadcast address for WoL.'),
  secureOn: z.string().describe('SecureOn settings.'),
  cidr: z.string().describe('CIDR notation for the network.'),
  latitude: z.number().describe('The latitude coordinate of the display.'),
  longitude: z.number().describe('The longitude coordinate of the display.'),
  clientType: z.string().describe('The type of the client software.'),
  clientVersion: z.string().describe('The version of the client software.'),
  clientCode: z.number().describe('The code of the client software.'),
  displayProfileId: z.number().describe('The ID of the display profile.'),
  currentLayoutId: z.number().describe('The ID of the currently displayed layout.'),
  screenShotRequested: z.number().describe('Flag indicating if a screenshot has been requested.'),
  storageAvailableSpace: z.number().describe('Available storage space on the device.'),
  storageTotalSpace: z.number().describe('Total storage space on the device.'),
  displayGroupId: z.number().describe('The ID of the primary display group.'),
  currentLayout: z.string().describe('The name of the current layout.'),
  defaultLayout: z.string().describe('The name of the default layout.'),
  displayGroups: z.array(displayGroupSchema).describe('An array of display groups this display belongs to.'),
  xmrChannel: z.string().describe('The XMR channel for real-time communication.'),
  xmrPubKey: z.string().describe('The XMR public key.'),
  lastCommandSuccess: z.number().describe('Timestamp of the last successful command.'),
  deviceName: z.string().describe('The name of the device.'),
  timeZone: z.string().describe('The time zone of the display.'),
  tags: z.array(tagSchema).describe('An array of tags associated with the display.'),
  overrideConfig: z.string().describe('JSON string for overriding configuration.'),
  bandwidthLimit: z.number().describe('The bandwidth limit for the display.'),
  newCmsAddress: z.string().describe('A new CMS address for redirection.'),
  newCmsKey: z.string().describe('A new CMS key for redirection.'),
  orientation: z.string().describe('The screen orientation.'),
  resolution: z.string().describe('The screen resolution.'),
  commercialLicence: z.number().describe('Flag for commercial license.'),
  teamViewerSerial: z.string().describe('The TeamViewer serial number.'),
  webkeySerial: z.string().describe('The Webkey serial number.'),
  groupsWithPermissions: z.string().describe('Permissions for the groups.'),
  createdDt: z.string().describe('The creation date of the display.'),
  modifiedDt: z.string().describe('The last modification date of the display.'),
  folderId: z.number().describe('The ID of the folder containing the display.'),
  permissionsFolderId: z.number().describe('The ID of the folder that defines permissions.'),
  countFaults: z.number().describe('The number of faults recorded.'),
  lanIpAddress: z.string().describe('The LAN IP address of the display.'),
  syncGroupId: z.number().describe('The ID of the sync group.'),
  osVersion: z.string().describe('The operating system version.'),
  osSdk: z.string().describe('The operating system SDK version.'),
  manufacturer: z.string().describe('The manufacturer of the device.'),
  brand: z.string().describe('The brand of the device.'),
  model: z.string().describe('The model of the device.'),
}); 