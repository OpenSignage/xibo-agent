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
 * @module getSyncGroups
 * @description This module provides functionality to retrieve sync groups
 * from the Xibo CMS. It implements the GET /api/syncgroups endpoint.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for a single sync group
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
  leadDisplayId: z.number().nullable(),
  leadDisplay: z.string().nullable(),
  folderId: z.number().nullable(),
  permissionsFolderId: z.number().nullable(),
});

// Schema for the overall response, which can be a success or error
const responseSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.array(syncGroupSchema),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool to retrieve a list of sync groups.
 * This tool fetches synchronization groups from the Xibo CMS, with optional filters.
 */
export const getSyncGroups = createTool({
  id: "get-sync-groups",
  description: "Retrieve a list of sync groups",
  inputSchema: z.object({
    syncGroupId: z.number().optional().describe("Filter by a specific sync group ID."),
    name: z.string().optional().describe("Filter by sync group name (supports partial matching)."),
    ownerId: z.number().optional().describe("Filter by the owner's user ID."),
    folderId: z.number().optional().describe("Filter by the folder ID."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`getSyncGroups: ${message}`);
      return { success: false, message };
    }

    const url = new URL(`${config.cmsUrl}/api/syncgroups`);
    
    // Append query parameters if they are provided
    if (context.syncGroupId) url.searchParams.append("syncGroupId", context.syncGroupId.toString());
    if (context.name) url.searchParams.append("name", context.name);
    if (context.ownerId) url.searchParams.append("ownerId", context.ownerId.toString());
    if (context.folderId) url.searchParams.append("folderId", context.folderId.toString());

    let responseData: any;
    try {
      logger.info(`getSyncGroups: Requesting URL: ${url.toString()}`);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      responseData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`getSyncGroups: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const validatedData = z.array(syncGroupSchema).parse(responseData);
      logger.info("Sync groups retrieved successfully");
      return { success: true, data: validatedData };

    } catch (error) {
        if (error instanceof z.ZodError) {
            const message = "Validation error occurred while parsing the API response.";
            logger.error(`getSyncGroups: ${message}`, { error: error.issues, errorData: responseData });
            return { success: false, message, error: error.issues, errorData: responseData };
        }
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        logger.error(`getSyncGroups: ${message}`, { error });
        return { success: false, message, error };
    }
  },
}); 