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
import { z } from 'zod';

/**
 * Schema for Display Group membership details.
 * This is often used when embedding display group information in other objects.
 */
export const displayGroupMembershipSchema = z.object({
  displayGroupId: z.number().describe('The ID of the display group.'),
  displayGroup: z.string().describe('The name of the display group.'),
});

/**
 * Core schema for a Display object, based on the Xibo API definition.
 * This schema is based on actual API response data to ensure compatibility.
 */
export const displaySchema = z.object({
  displayId: z.number().describe('The unique ID of the display.'),
  displayTypeId: z.number().optional().nullable().describe('The ID of the display type.'),
  venueId: z.number().optional().nullable().describe('The ID of the venue.'),
  address: z.string().optional().nullable().describe('The physical address of the display.'),
  isMobile: z.number().optional().nullable().describe('Flag indicating if the display is a mobile device (1 for yes).'),
  languages: z.string().optional().nullable().describe('Supported languages for the display location.'),
  displayType: z.string().optional().nullable().describe('The type of the display.'),
  screenSize: z.string().optional().nullable().describe('The physical screen size of the display.'),
  isOutdoor: z.number().optional().nullable().describe('Flag indicating if the display is outdoors (1 for yes).'),
  customId: z.string().optional().nullable().describe('A custom identifier, often from an external system.'),
  costPerPlay: z.string().optional().nullable().describe('The cost associated with each media play.'),
  impressionsPerPlay: z.string().optional().nullable().describe('The number of impressions generated per play.'),
  ref1: z.string().optional().nullable().describe('Custom reference field 1.'),
  ref2: z.string().optional().nullable().describe('Custom reference field 2.'),
  ref3: z.string().optional().nullable().describe('Custom reference field 3.'),
  ref4: z.string().optional().nullable().describe('Custom reference field 4.'),
  ref5: z.string().optional().nullable().describe('Custom reference field 5.'),
  auditingUntil: z.number().describe('Timestamp until which auditing is recorded.'),
  display: z.string().describe('The name of the display.'),
  description: z.string().nullable().describe('The description for the display.'),
  defaultLayoutId: z.number().describe('The ID of the default layout for this display.'),
  license: z.string().nullable().describe('The license key or identifier.'),
  licensed: z.number().describe('Flag indicating if the display is licensed.'),
  loggedIn: z.number().describe('Flag indicating if the display is currently logged in.'),
  lastAccessed: z.string().nullable().describe('The date and time the display last connected, in ISO 8601 format.'),
  incSchedule: z.number().describe('Flag indicating if the display is included in schedule calculations.'),
  emailAlert: z.number().describe('Flag indicating if email alerts are enabled for this display.'),
  alertTimeout: z.number().describe('The timeout in seconds before an alert is sent.'),
  clientAddress: z.string().nullable().describe('The IP address of the display client.'),
  mediaInventoryStatus: z.number().describe('The current media inventory status.'),
  macAddress: z.string().nullable().describe('The MAC address of the display.'),
  lastChanged: z.number().optional().nullable().describe('Timestamp of the last change to the display settings.'),
  numberOfMacAddressChanges: z.number().optional().nullable().describe('The number of times the MAC address has been changed.'),
  lastWakeOnLanCommandSent: z.number().optional().nullable().describe('Timestamp of the last Wake On LAN command sent.'),
  wakeOnLanEnabled: z.number().describe('Flag indicating if WOL is enabled.'),
  wakeOnLanTime: z.string().optional().nullable().describe('The scheduled time for Wake On LAN.'),
  broadCastAddress: z.string().optional().nullable().describe('The broadcast address for WOL.'),
  secureOn: z.string().optional().nullable().describe('Secure ON configuration details.'),
  cidr: z.string().optional().nullable().describe('The CIDR network configuration.'),
  latitude: z.number().optional().nullable().describe('The geographic latitude.'),
  longitude: z.number().optional().nullable().describe('The geographic longitude.'),
  clientType: z.string().nullable().describe('The type of the client software (e.g., windows, android).'),
  clientVersion: z.string().optional().nullable().describe('The version of the client software.'),
  clientCode: z.number().optional().nullable().describe('The version code of the client software.'),
  displayProfileId: z.number().nullable().describe('The ID of the assigned display profile.'),
  currentLayoutId: z.number().nullable().describe('The ID of the currently displayed layout.'),
  screenShotRequested: z.number().describe('Flag indicating if a screenshot has been requested.'),
  storageAvailableSpace: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Available storage space (e.g., "3.03 GiB" or bytes as number).'),
  storageTotalSpace: z
    .union([z.string(), z.number()])
    .nullable()
    .describe('Total storage space (e.g., "57.05 GiB" or bytes as number).'),
  displayGroupId: z.number().describe('The ID of the primary display group.'),
  currentLayout: z.string().nullable().describe('The name of the currently displayed layout.'),
  defaultLayout: z.string().nullable().describe('The name of the default layout.'),
  displayGroups: z.array(displayGroupMembershipSchema).optional().describe('A list of display groups this display is a member of.'),
  xmrChannel: z.string().describe('The XMR channel for real-time communication.'),
  xmrPubKey: z.string().describe('The public key for XMR communication.'),
  lastCommandSuccess: z.number().optional().describe('Flag indicating if the last command was successful.'),
  deviceName: z.string().optional().nullable().describe('The device name reported by the player.'),
  timeZone: z.string().optional().nullable().describe('The timezone setting for the display.'),
  tags: z.array(z.any()).describe('A list of tags associated with the display.'), // Keeping as z.any() for now as structure is not in log.
  overrideConfig: z.array(z.any()).describe('Array of override configuration settings.'), // Keeping as z.any() as structure is not in log.
  bandwidthLimit: z.number().describe('The bandwidth limit setting.'),
  newCmsAddress: z.string().optional().nullable().describe('A new CMS address, if the display is being migrated.'),
  newCmsKey: z.string().optional().nullable().describe('A new CMS key, if the display is being migrated.'),
  orientation: z.string().optional().nullable().describe('The display orientation (e.g., "landscape").'),
  resolution: z.string().optional().nullable().describe('The resolution of the display (e.g., "1024x768").'),
  commercialLicence: z.number().describe('The commercial license status.'),
  teamViewerSerial: z.string().optional().nullable().describe('The TeamViewer serial number, if applicable.'),
  webkeySerial: z.string().optional().nullable().describe('The Webkey serial number, if applicable.'),
  groupsWithPermissions: z.any().nullable().describe('Groups with permissions for this display.'), // Type unknown from log
  createdDt: z.string().describe('The creation date of the display record.'),
  modifiedDt: z.string().describe('The last modification date of the display record.'),
  folderId: z.number().describe('The ID of the folder containing this display.'),
  permissionsFolderId: z.number().describe('The ID of the folder used for permissions.'),
  countFaults: z.number().describe('The number of faults recorded for this display.'),
  lanIpAddress: z.string().optional().nullable().describe('The LAN IP address of the display.'),
  syncGroupId: z.number().describe('The ID of the sync group, if any.'),
  osVersion: z.string().describe('The operating system version of the player.'),
  osSdk: z.string().describe('The SDK version of the operating system.'),
  manufacturer: z.string().optional().nullable().describe('The manufacturer of the display hardware.'),
  brand: z.string().optional().nullable().describe('The brand of the display hardware.'),
  model: z.string().optional().nullable().describe('The model of the display hardware.'),
  currentMacAddress: z.string().describe('The currently reported MAC address.'),
  bandwidthLimitFormatted: z.number().optional().describe('The bandwidth limit, formatted for display.'),
  // These fields were in the old schema but not in the new response log, so commenting out.
  // ownerId: z.number().describe('The user ID of the display owner.'),
  // resolutionId: z.number().describe('The ID of the display resolution.'),
  // isAuthorized: z.number().describe('Flag indicating if the display is authorized (1 for yes, 0 for no).'),
});

/**
 * Schema for the Display Status object.
 * This schema is based on actual API response data.
 */
export const displayStatusSchema = z.object({
  lastActivity: z.string().describe('The date and time of the last player activity.'),
  applicationState: z.string().describe('The current state of the player application (e.g., "Running").'),
  xmdsLastActivity: z.string().describe('The date and time of the last XMDS activity.'),
  scheduleStatus: z.string().describe('The current schedule status message.'),
  requiredFilesStatus: z.string().describe('The status of required file downloads.'),
  xmrStatus: z.string().describe('The status of the XMR connection.'),
});

/**
 * Schema for the Display Licence object.
 */
export const displayLicenceSchema = z.object({
  isLicensed: z.boolean().describe('Whether the display is currently licensed.'),
  availableSlots: z.number().describe('The number of available license slots for this display type.'),
  message: z.string().describe('A message regarding the license status.'),
}); 