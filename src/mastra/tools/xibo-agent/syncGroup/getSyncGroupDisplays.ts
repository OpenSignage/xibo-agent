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
 * @module getSyncGroupDisplays
 * @description This module provides functionality to retrieve the displays
 * assigned to a sync group. It implements the GET /api/syncgroup/{id}/displays endpoint.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for a single Display, based on xibo-api.json #/definitions/Display
const displaySchema = z.object({
    displayId: z.number(),
    display: z.string(),
    description: z.string().nullable().optional(),
    defaultLayoutId: z.number(),
    defaultLayout: z.string().nullable().optional(),
    loggedIn: z.number(),
    lastAccessed: z.string(),
    incSchedule: z.number().nullable().optional(),
    emailAlert: z.number().nullable().optional(),
    alertTimeout: z.number().nullable().optional(),
    clientAddress: z.string().nullable().optional(),
    displayGroupId: z.number(),
    displayGroup: z.string().nullable().optional(),
    license: z.string(),
    licensed: z.number().nullable().optional(),
    version: z.string().nullable().optional(),
    playerSoftware: z.string().nullable().optional(),
    mediaInventoryStatus: z.string().nullable().optional(),
    macAddress: z.string().nullable().optional(),
    lastChanged: z.string().nullable().optional(),
    numberOfMacAddressChanges: z.number().nullable().optional(),
    currentLayoutId: z.number().nullable().optional(),
    currentLayout: z.string().nullable().optional(),
    displayProfileId: z.number().nullable().optional(),
    isAuditing: z.number().nullable().optional(),
    isAuthorized: z.number().nullable().optional(),
    wakeOnLanEnabled: z.number().nullable().optional(),
    wakeOnLanTime: z.string().nullable().optional(),
    wakeOnLanCommand: z.string().nullable().optional(),
    broadCastAddress: z.string().nullable().optional(),
    secureOn: z.string().nullable().optional(),
    cidr: z.string().nullable().optional(),
    lastSyncStatus: z.string().nullable().optional(),
    lastSyncMessage: z.string().nullable().optional(),
    deviceName: z.string().nullable().optional(),
    timeZone: z.string().nullable().optional(),
    storageAvailableSpace: z.number().nullable().optional(),
    storageTotalSpace: z.number().nullable().optional(),
    osVersion: z.string().nullable().optional(),
    osBuild: z.string().nullable().optional(),
    totalRam: z.number().nullable().optional(),
    availableRam: z.number().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    onAirTime: z.number().nullable().optional(),
    onAirTimeYesterday: z.number().nullable().optional(),
    lastOnAirTime: z.string().nullable().optional(),
    lastPowerOffTime: z.string().nullable().optional(),
    lastPowerOnTime: z.string().nullable().optional(),
    orientation: z.string().nullable().optional(),
    authToken: z.string().nullable().optional(),
    lastUpdateWindow: z.string().nullable().optional(),
    lastCommandSuccess: z.string().nullable().optional(),
    displayVenueId: z.number().nullable().optional(),
    displayVenue: z.string().nullable().optional(),
});

// Schema for the response object which contains the array of displays
const displaysResponseSchema = z.object({
  displays: z.array(displaySchema),
});

// Schema for the overall tool response, which can be a success or error
const responseSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(displaySchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool to get the displays assigned to a sync group.
 * This tool retrieves a list of all displays that are members of a specific sync group.
 */
export const getSyncGroupDisplays = createTool({
  id: "get-sync-group-displays",
  description: "Get the displays assigned to a sync group",
  inputSchema: z.object({
    syncGroupId: z.number().describe("The ID of the sync group."),
    eventId: z.number().optional().describe("Filter by a specific event ID."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`getSyncGroupDisplays: ${message}`);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/syncgroup/${context.syncGroupId}/displays`);
    if (context.eventId) url.searchParams.append("eventId", context.eventId.toString());

    let responseData: any;
    try {
      logger.debug(`getSyncGroupDisplays: Requesting URL: ${url.toString()}`);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      responseData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`getSyncGroupDisplays: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const validatedData = displaysResponseSchema.parse(responseData);
      logger.info("Sync group displays retrieved successfully");
      return { success: true, data: validatedData.displays };

    } catch (error) {
        if (error instanceof z.ZodError) {
            const message = "Validation error occurred while parsing the API response.";
            logger.error(`getSyncGroupDisplays: ${message}`, { error: error.issues, errorData: responseData });
            return { success: false, message, error: error.issues, errorData: responseData };
        }
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        logger.error(`getSyncGroupDisplays: ${message}`, { error });
        return { success: false, message, error };
    }
  },
});

export default getSyncGroupDisplays;

 