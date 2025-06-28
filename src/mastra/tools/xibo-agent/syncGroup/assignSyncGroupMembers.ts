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
 * @module assignSyncGroupMembers
 * @description This module provides functionality to assign or unassign members
 * to a sync group. It implements the POST /api/syncgroup/{syncGroupId}/members
 * endpoint.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the response, which can be a success or error
const responseSchema = z.union([
  z.object({
    success: z.literal(true),
    message: z.string(),
  }),
  z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.any().optional(),
    errorData: z.any().optional(),
  }),
]);

/**
 * Tool to assign or unassign members to a sync group.
 * This tool manages the membership of displays within a sync group in the Xibo CMS.
 */
export const assignSyncGroupMembers = createTool({
  id: "assign-sync-group-members",
  description: "Assign or unassign members to a sync group",
  inputSchema: z.object({
    syncGroupId: z.number().describe("The ID of the sync group to modify."),
    displayId: z.array(z.number()).describe("An array of Display IDs to assign to the group."),
    unassignDisplayId: z.array(z.number()).optional().describe("An array of Display IDs to unassign from the group."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`assignSyncGroupMembers: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/syncgroup/${context.syncGroupId}/members`;
    const formData = new URLSearchParams();
    
    // The API expects JSON-encoded arrays for these parameters
    formData.append("displayId", JSON.stringify(context.displayId));
    if (context.unassignDisplayId) {
      formData.append("unassignDisplayId", JSON.stringify(context.unassignDisplayId));
    }

    try {
      logger.debug(`assignSyncGroupMembers: Requesting URL: ${url}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
            ...await getAuthHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => response.text());
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`assignSyncGroupMembers: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const successMessage = "Sync group members assigned/unassigned successfully";
      logger.info(successMessage);
      return { success: true, message: successMessage };

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error(`assignSyncGroupMembers: ${message}`, { error });
      return { success: false, message, error };
    }
  },
});

export default assignSyncGroupMembers; 