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
 * Font Upload Tool
 * 
 * This module provides functionality to upload font files to the Xibo CMS.
 * It implements the POST /fonts API endpoint and handles file uploads with proper validation.
 * 
 * The tool supports three different upload methods:
 * 1. Direct file upload (web browser environments only)
 * 2. Base64 encoded file content
 * 3. File path on the agent server
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { config } from "../config";
import { getAuthHeaders } from "../auth";
import { logger } from "../../../index";
import { decodeErrorMessage } from "../utility/error";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Schema for the uploaded font data, which is a specific type of library media.
 */
const fontUploadResponseSchema = z.object({
    files: z.array(z.object({
        mediaId: z.number().describe("The new Media ID for the uploaded font."),
        name: z.string().describe("The name of the uploaded file."),
        fileName: z.string().describe("The file name of the uploaded font."),
        mediaType: z.literal("font").describe("The media type."),
        size: z.number().describe("The size of the file in bytes."),
        md5: z.string().describe("The MD5 checksum of the file."),
    })),
});

/**
 * Defines the schema for a successful response.
 */
const successSchema = z.object({
  success: z.literal(true),
  data: fontUploadResponseSchema,
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
 * Tool for uploading font files to Xibo CMS
 */
export const uploadFont = createTool({
  id: "upload-font",
  description: "Upload a font file to Xibo CMS.",
  inputSchema: z.object({
    fileContent: z.string().describe("Base64 encoded file content."),
    fileName: z.string().describe("Original filename (e.g., 'my-font.ttf')."),
    name: z.string().optional().describe("A custom name for the font in the library."),
    oldMediaId: z.number().optional().describe("The ID of an existing font to replace."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({ context: input }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    if (!config.cmsUrl) {
      const errorMessage = "CMS URL is not configured.";
      logger.error(`uploadFont: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }

    const { fileContent, fileName, name, oldMediaId } = input;
    let tempFilePath: string | null = null;
    
    try {
        const fileBuffer = Buffer.from(fileContent, 'base64');
        const tmpDir = os.tmpdir();
        tempFilePath = path.join(tmpDir, `xibo-upload-${Date.now()}-${path.basename(fileName)}`);
        fs.writeFileSync(tempFilePath, fileBuffer);
        logger.debug(`Temporary file created at: ${tempFilePath}`);
        
        const fileBlob = new Blob([fileBuffer]);
        const uploadFile = new File([fileBlob], fileName);

        const formData = new FormData();
        formData.append("files", uploadFile);
        if (name) formData.append("name", name);
        if (oldMediaId) formData.append("oldMediaId", oldMediaId.toString());

        const url = `${config.cmsUrl}/api/fonts`;
        logger.info(`Uploading font '${fileName}' to ${url}.`);

        const response = await fetch(url, {
            method: "POST",
            headers: await getAuthHeaders(),
            body: formData,
        });

        const responseText = await response.text();
        let responseData: any;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = responseText;
        }

        if (!response.ok) {
            const decodedText = decodeErrorMessage(responseText);
            const errorMessage = `Failed to upload font. API responded with status ${response.status}.`;
            logger.error(errorMessage, { status: response.status, response: decodedText });
            return {
                success: false,
                message: `${errorMessage} Message: ${decodedText}`,
                error: { statusCode: response.status, responseBody: responseData },
            };
        }

        const validationResult = fontUploadResponseSchema.safeParse(responseData);
        if (!validationResult.success) {
            const errorMessage = "Font upload response validation failed.";
            logger.error(errorMessage, { error: validationResult.error.issues, data: responseData });
            return {
                success: false,
                message: errorMessage,
                error: { validationIssues: validationResult.error.issues, receivedData: responseData },
            };
        }

        logger.info(`Font '${fileName}' uploaded successfully.`);
        return {
            success: true,
            data: validationResult.data,
        };

    } catch (error: any) {
        logger.error(`An unexpected error occurred during font upload: ${error.message}`, { error });
        return {
            success: false,
            message: `An unexpected error occurred: ${error.message}`,
            error,
        };
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                logger.debug(`Temporary file deleted: ${tempFilePath}`);
            } catch (cleanupError: any) {
                logger.warn(`Failed to delete temporary file '${tempFilePath}': ${cleanupError.message}`);
            }
        }
    }
  },
});

export default uploadFont;
