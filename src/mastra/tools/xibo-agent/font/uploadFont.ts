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
 * @module uploadFont
 * @description Provides a tool to upload a font file to the Xibo CMS.
 * It implements the POST /fonts API endpoint.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage, processError } from "../utility/error";
import * as fs from 'fs';
import * as path from 'path';

// Schema for the response of a successful font upload.
const successResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        files: z.array(z.object({
            mediaId: z.number().describe("The new Media ID for the uploaded font."),
            name: z.string().describe("The name of the uploaded file."),
            fileName: z.string().describe("The file name of the uploaded font."),
            mediaType: z.literal("font").describe("The media type."),
            size: z.number().describe("The size of the file in bytes."),
            md5: z.string().describe("The MD5 checksum of the file."),
        })),
    }),
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
 * Tool for uploading a font file to the Xibo CMS from the local filesystem.
 */
export const uploadFont = createTool({
  id: "upload-font",
  description: "Upload a font file to Xibo CMS from the local filesystem.",
  inputSchema: z.object({
    fileName: z.string().describe("The filename of the font to upload (e.g., 'my-font.ttf')."),
    filePath: z.string().optional().describe(`The path to the directory containing the font file. Defaults to the system's upload directory: ${config.uploadDir}`),
    name: z.string().optional().describe("A custom name for the font in the library."),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = "CMS URL is not configured.";
      logger.error(message);
      return { success: false as const, message };
    }

    const { fileName, filePath, ...rest } = context;
    
    try {
        const directory = filePath ? path.resolve(filePath) : config.uploadDir;
        const fullPath = path.join(directory, fileName);

        if (!fs.existsSync(fullPath)) {
            const message = `File not found at path: ${fullPath}`;
            logger.error(message);
            return { success: false as const, message };
        }

        const formData = new FormData();
        formData.append("files", new Blob([fs.readFileSync(fullPath)]), fileName);
        
        Object.entries(rest).forEach(([key, value]) => {
            if (value !== undefined) {
                formData.append(key, String(value));
            }
        });

        const url = new URL(`${config.cmsUrl}/api/fonts`);
        logger.info({ url: url.toString(), path: fullPath }, `Uploading font '${fileName}'`);

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: await getAuthHeaders(),
            body: formData,
        });
        
        const responseData = await response.json().catch(() => response.text());

        if (!response.ok) {
            const decodedError = decodeErrorMessage(responseData);
            const message = `Failed to upload font. API responded with status ${response.status}.`;
            logger.error({ status: response.status, response: decodedError }, message);
            return { success: false as const, message, errorData: decodedError };
        }

        const validationResult = successResponseSchema.safeParse({ success: true, data: responseData });
        if (!validationResult.success) {
            const message = "Font upload response validation failed.";
            logger.error({ error: validationResult.error.flatten(), data: responseData }, message);
            return {
                success: false as const,
                message,
                error: validationResult.error.flatten(),
                errorData: responseData,
            };
        }

        logger.info(`Font '${fileName}' uploaded successfully.`);
        return validationResult.data;

    } catch (error) {
        const message = "An unexpected error occurred during font upload.";
        const processedError = processError(error);
        logger.error({ error: processedError }, message);
        return { success: false as const, message, error: processedError };
    }
  },
});
