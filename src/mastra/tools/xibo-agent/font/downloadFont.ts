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
 * @module downloadFont
 * @description Provides a tool to download a specific font file from the Xibo CMS
 * and save it to the local filesystem.
 * It implements the /api/fonts/download/{id} endpoint.
 */
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";

/**
 * Defines the schema for a successful response, containing the path to the downloaded file.
 */
const successSchema = z.object({
  success: z.literal(true),
  filePath: z.string().describe("The local file path where the font was saved in persistent_data/downloads."),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z
    .any()
    .optional()
    .describe("Optional technical details about the error."),
});

/**
 * A tool for downloading a specific font file from the Xibo CMS and saving it locally.
 */
export const downloadFont = createTool({
  id: "download-font",
  description: "Downloads a specific font by its ID and saves it to the 'persistent_data/downloads' directory.",
  inputSchema: z.object({
    id: z.number().describe("The unique ID of the font to download."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(`downloadFont: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }

    // Construct the API endpoint URL for the font download.
    const url = `${config.cmsUrl}/api/fonts/download/${input.id}`;
    logger.info(`Requesting to download font from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: await getAuthHeaders(),
    });

    // Handle non-successful HTTP responses.
    if (!response.ok) {
        const responseText = await response.text();
        const decodedText = decodeErrorMessage(responseText);
        const errorMessage = `Failed to download font. API responded with status ${response.status}.`;
        logger.error(errorMessage, {
            status: response.status,
            response: decodedText,
        });
        return {
            success: false,
            message: `${errorMessage} Message: ${decodedText}`,
            error: {
            statusCode: response.status,
            responseBody: responseText,
            },
        };
    }
    
    // Extract the filename from the 'content-disposition' header.
    // Falls back to a default name if the header is not present.
    const contentDisposition = response.headers.get("content-disposition");
    let fileName = `font-${input.id}.ttf`; // Default filename
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    // Try to save the downloaded font file to the persistent storage directory.
    try {
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        // Get the target directory from the central config and create it if it doesn't exist.
        const downloadDir = config.downloadsDir;
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
            logger.info(`Created download directory: ${downloadDir}`);
        }

        // Write the font data to a new file.
        const filePath = path.join(downloadDir, fileName);
        fs.writeFileSync(filePath, buffer);

        logger.info(`Font '${fileName}' downloaded successfully and saved to ${filePath}.`);
        return {
          success: true,
          filePath,
        };
    } catch (error: any) {
        // Handle any errors that occur during file system operations.
        logger.error(`Failed to save downloaded font to disk: ${error.message}`, { error });
        return {
            success: false,
            message: `Failed to save file: ${error.message}`,
            error,
        };
    }
  },
});

export default downloadFont;
