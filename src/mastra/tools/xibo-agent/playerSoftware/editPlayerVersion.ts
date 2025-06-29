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
 * @module editPlayerVersion
 * @description This module provides functionality to edit a specific player software version's
 * information in the Xibo CMS. It implements the PUT /api/playersoftware/{versionId} endpoint.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the Player Version object returned by the API, based on error logs
const playerVersionSchema = z.object({
  versionId: z.number(),
  type: z.string().nullable(),
  version: z.string().nullable(),
  code: z.number().nullable(),
  playerShowVersion: z.string(),
  createdAt: z.string(),
  modifiedAt: z.string(),
  modifiedBy: z.string(),
  fileName: z.string(),
  size: z.number(),
  md5: z.string().nullable(),
});

// Schema for the overall response, which can be a success or error
const responseSchema = z.union([
    z.object({
        success: z.literal(true),
        data: playerVersionSchema,
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
        errorData: z.any().optional(),
    }),
]);

export const editPlayerVersion = createTool({
  id: "edit-player-version",
  description: "Edit a player software version.",
  inputSchema: z.object({
    versionId: z.number().describe("The ID of the player software version to edit."),
    playerShowVersion: z.string().describe("The display name for the player version."),
    version: z.string().describe("The version number."),
    code: z.number().describe("The code number."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`editPlayerVersion: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/playersoftware/${context.versionId}`;
    
    const body = new URLSearchParams();
    if (context.playerShowVersion) body.append("playerShowVersion", context.playerShowVersion);
    if (context.version) body.append("version", context.version);
    if (context.code) body.append("code", context.code.toString());

    let responseData: any;
    try {
      logger.info(`editPlayerVersion: Requesting URL: ${url}`);
      const response = await fetch(url, {
        method: "PUT",
        headers: {
            ...await getAuthHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body,
      });

      responseData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`editPlayerVersion: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const validatedData = playerVersionSchema.parse(responseData);
      logger.info("Player version edited successfully");
      return { success: true, data: validatedData };

    } catch (error) {
        if (error instanceof z.ZodError) {
            const message = "Validation error occurred while parsing the API response.";
            logger.error(`editPlayerVersion: ${message}`, { error: error.issues, errorData: responseData });
            return { success: false, message, error: error.issues, errorData: responseData };
        }
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        logger.error(`editPlayerVersion: ${message}`, { error });
        return { success: false, message, error };
    }
  },
}); 