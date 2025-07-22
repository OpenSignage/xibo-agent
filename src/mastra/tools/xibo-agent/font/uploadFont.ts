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
import { logger } from "../../../logger";
import { decodeErrorMessage, processError } from "../utility/error";
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';

// Schema for the response of a successful font upload.
const successResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({
        files: z.array(z.object({
            id: z.number().describe("The new Media ID for the uploaded font."),
            name: z.string().describe("The name of the uploaded file."),
            fileName: z.string().describe("The file name of the uploaded font."),
            type: z.string().describe("The media type of the uploaded file, e.g., 'font/ttf'."),
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

        const form = new FormData();
        const fileBuffer = fs.readFileSync(fullPath);
        form.append('files', fileBuffer, { filename: fileName });
        
        if (rest.name) {
            form.append('name', rest.name);
        }

        const url = `${config.cmsUrl}/api/fonts`;
        logger.info({ url: url, path: fullPath }, `Uploading font '${fileName}'`);

        const authHeaders = await getAuthHeaders();
        const response = await axios.post(url, form, {
            headers: {
                ...authHeaders,
                ...form.getHeaders(),
            },
        });
        
        const responseData = response.data;

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
        if (error instanceof AxiosError) {
            const errorDetails = {
                status: error.response?.status,
                data: error.response?.data,
                headers: error.response?.headers,
            };
            const message = `HTTP error! status: ${error.response?.status}`;
            logger.error({ error: error.message, details: errorDetails }, message);
            return { 
                success: false as const, 
                message: message, 
                error: error.message,
                errorData: error.response?.data 
            };
        }

        const message = "An unexpected error occurred during font upload.";
        const processedError = processError(error);
        logger.error({ error: processedError }, message);
        return { success: false as const, message, error: processedError };
    }
  },
});
