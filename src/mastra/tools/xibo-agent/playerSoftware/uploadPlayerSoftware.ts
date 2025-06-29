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
 * @module uploadPlayerSoftware
 * @description This module provides functionality to upload a new player software version
 * to the Xibo CMS. It implements the POST /api/playersoftware endpoint.
 */
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";

// Schema for the Media object returned by the API, based on xibo-api.json
const mediaSchema = z.object({
    mediaId: z.number(),
    ownerId: z.number(),
    parentId: z.number().nullable(),
    name: z.string(),
    mediaType: z.string(),
    storedAs: z.string(),
    fileName: z.string(),
    fileSize: z.number(),
    duration: z.number(),
    valid: z.number(),
    moduleSystemFile: z.number(),
    expires: z.number(),
    retired: z.number(),
    isEdited: z.number(),
    md5: z.string().nullable(),
    owner: z.string(),
    groupsWithPermissions: z.string().nullable(),
    released: z.number(),
    apiRef: z.string().nullable(),
    createdDt: z.string(),
    modifiedDt: z.string(),
    enableStat: z.string().nullable(),
    orientation: z.string().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    folderId: z.number().nullable(),
    permissionsFolderId: z.number().nullable(),
    tags: z.array(z.any()).optional(), // Assuming TagLink structure is not critical here
});

// The API returns an array of media objects
const uploadResponseSchema = z.array(mediaSchema);

// Schema for the overall response, which can be a success or error
const responseSchema = z.union([
    z.object({
        success: z.literal(true),
        data: uploadResponseSchema,
    }),
    z.object({
        success: z.literal(false),
        message: z.string(),
        error: z.any().optional(),
        errorData: z.any().optional(),
    }),
]);

export const uploadPlayerSoftware = createTool({
  id: "upload-player-software",
  description: "Upload a player software file.",
  inputSchema: z.object({
    fileContent: z.instanceof(Buffer).describe("The content of the file as a Buffer."),
    fileName: z.string().describe("The name of the file."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<z.infer<typeof responseSchema>> => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured";
      logger.error(`uploadPlayerSoftware: ${message}`);
      return { success: false, message };
    }

    const url = `${config.cmsUrl}/api/playersoftware`;
    
    const formData = new FormData();
    formData.append("files", new Blob([context.fileContent]), context.fileName);

    let responseData: any;
    try {
      logger.debug(`uploadPlayerSoftware: Requesting URL: ${url}`);
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
            ...(await getAuthHeaders()),
            // Content-Type is set automatically by browser/fetch with FormData
        },
        body: formData,
      });

      responseData = await response.json();

      if (!response.ok) {
        const message = `HTTP error! status: ${response.status}`;
        logger.error(`uploadPlayerSoftware: ${message}`, { errorData: responseData });
        return { success: false, message, errorData: responseData };
      }

      const validatedData = uploadResponseSchema.parse(responseData);
      logger.info("Player software uploaded successfully");
      return { success: true, data: validatedData };

    } catch (error) {
        if (error instanceof z.ZodError) {
            const message = "Validation error occurred while parsing the API response.";
            logger.error(`uploadPlayerSoftware: ${message}`, { error: error.issues, errorData: responseData });
            return { success: false, message, error: error.issues, errorData: responseData };
        }
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        logger.error(`uploadPlayerSoftware: ${message}`, { error });
        return { success: false, message, error };
    }
  },
}); 