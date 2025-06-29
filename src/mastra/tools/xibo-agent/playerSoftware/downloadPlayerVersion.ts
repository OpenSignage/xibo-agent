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
 * @module downloadPlayerVersion
 * @description This module provides functionality to download a specific player software version file
 * from the Xibo CMS. It implements the GET /api/playersoftware/download/{versionId} endpoint.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the response, which can be a success (with blob data) or error
const responseSchema = z.union([
    z.object({
        success: z.literal(true),
        data: z.instanceof(Buffer),
        message: z.string(),
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
        errorData: z.any().optional(),
    }),
]);

export const downloadPlayerVersion = createTool({
  id: "download-player-version",
  description: "Download a player software version file.",
  inputSchema: z.object({
    versionId: z.number().describe("The ID of the player software version to download."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`downloadPlayerVersion: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/playersoftware/download/${context.versionId}`;
    
    try {
      logger.debug(`downloadPlayerVersion: Requesting URL: ${url}`);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => response.text());
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`downloadPlayerVersion: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const successMessage = "Player version downloaded successfully";
      logger.info(successMessage);
      return {
        success: true,
        data: buffer,
        message: successMessage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      logger.error(`downloadPlayerVersion: ${message}`, { error });
      return { success: false, message, error };
    }
  },
}); 