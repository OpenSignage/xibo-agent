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
 * @module editSyncGroup
 * @description This module provides functionality to edit an existing sync group.
 * It implements the PUT /api/syncgroup/{id} endpoint and handles the necessary
 * validation and data transformation.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the sync group data returned by the API
const syncGroupSchema = z.object({
  syncGroupId: z.number(),
  name: z.string(),
  createdDt: z.string().nullable(),
  modifiedDt: z.string().nullable(),
  modifiedBy: z.number().nullable(),
  modifiedByName: z.string().nullable(),
  ownerId: z.number(),
  owner: z.string().nullable(),
  syncPublisherPort: z.number().nullable(),
  syncSwitchDelay: z.number().nullable(),
  syncVideoPauseDelay: z.number().nullable(),
});

// Schema for the overall response, which can be a success or error
const responseSchema = z.union([
  z.object({
    success: z.literal(true),
    data: syncGroupSchema,
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool to edit an existing sync group.
 * This tool updates an existing synchronization group in the Xibo CMS system.
 */
export const editSyncGroup = createTool({
  id: "edit-sync-group",
  description: "Edit an existing sync group",
  inputSchema: z.object({
    syncGroupId: z.number().describe("The ID of the sync group to edit."),
    name: z.string().describe("The new name for the sync group."),
    syncPublisherPort: z.number().optional().default(9590).describe("The publisher port for synchronization."),
    syncSwitchDelay: z.number().optional().describe("The delay for switching synchronization."),
    syncVideoPauseDelay: z.number().optional().describe("The delay for pausing video synchronization."),
    leadDisplayId: z.number().describe("The ID of the lead display for synchronization."),
    folderId: z.number().optional().describe("The ID of the folder to move the sync group to."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`editSyncGroup: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/syncgroup/${context.syncGroupId}`;
    const formData = new URLSearchParams();
    
    formData.append("name", context.name);
    formData.append("leadDisplayId", context.leadDisplayId.toString());
    if (context.syncPublisherPort) formData.append("syncPublisherPort", context.syncPublisherPort.toString());
    if (context.syncSwitchDelay) formData.append("syncSwitchDelay", context.syncSwitchDelay.toString());
    if (context.syncVideoPauseDelay) formData.append("syncVideoPauseDelay", context.syncVideoPauseDelay.toString());
    if (context.folderId) formData.append("folderId", context.folderId.toString());

    let responseData: any;
    try {
      logger.debug(`editSyncGroup: Requesting URL: ${url}`);
      const response = await fetch(url, {
        method: "PUT",
        headers: {
            ...await getAuthHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      responseData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`editSyncGroup: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const validatedData = syncGroupSchema.parse(responseData);
      logger.info("Sync group edited successfully");
      return { success: true, data: validatedData };

    } catch (error) {
        if (error instanceof z.ZodError) {
            const message = "Validation error occurred while parsing the API response.";
            logger.error(`editSyncGroup: ${message}`, { error: error.issues, errorData: responseData });
            return { success: false, message, error: error.issues, errorData: responseData };
        }
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        logger.error(`editSyncGroup: ${message}`, { error });
        return { success: false, message, error };
    }
  },
});

export default editSyncGroup; 