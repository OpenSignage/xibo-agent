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
 * @description Provides a tool to download a font file from the Xibo CMS
 * and save it to a persistent local directory.
 */
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";

// Schema for a successful download response.
const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  filePath: z.string().describe("The local path where the font was saved."),
  fileName: z.string().describe("The name of the downloaded file."),
  size: z.number().describe("The size of the downloaded file in bytes."),
});

// Schema for a failed operation.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
  errorData: z.any().optional(),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([successResponseSchema, errorResponseSchema]);

/**
 * A tool for downloading a font file from the Xibo CMS by its ID.
 * The file is saved to the directory specified in `config.downloadsDir`.
 */
export const downloadFont = createTool({
  id: "download-font",
  description: "Downloads a font by its ID and saves it to a persistent local directory.",
  inputSchema: z.object({
    id: z.number().describe("The unique ID of the font to download."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const url = new URL(`${config.cmsUrl}/api/fonts/download/${context.id}`);
    
    try {
      logger.info({ url: url.toString() }, `Requesting to download font ID: ${context.id}`);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        const responseData = await response.json().catch(() => response.text());
        const decodedError = decodeErrorMessage(responseData);
        const message = `Failed to download font. API responded with status ${response.status}.`;
        logger.error({ status: response.status, response: decodedError }, message);
        return { success: false as const, message, errorData: decodedError };
      }
      
      const contentDisposition = response.headers.get("content-disposition");
      let fileName = `font-${context.id}.tmp`; // Default fallback filename
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          fileName = path.basename(match[1]);
        }
      }

      const downloadDir = path.resolve(config.downloadsDir);
      if (!fs.existsSync(downloadDir)) {
          fs.mkdirSync(downloadDir, { recursive: true });
          logger.info({ directory: downloadDir }, "Created download directory.");
      }

      const filePath = path.join(downloadDir, fileName);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const message = `Font '${fileName}' downloaded successfully.`;
      logger.info({ filePath, size: buffer.length }, message);
      return {
        success: true,
        message,
        filePath,
        fileName,
        size: buffer.length,
      };
    } catch (error) {
      const message = "An unexpected error occurred during font download.";
      const processedError = processError(error);
      logger.error({ error: processedError }, message);
      return { success: false as const, message, error: processedError };
    }
  },
});
