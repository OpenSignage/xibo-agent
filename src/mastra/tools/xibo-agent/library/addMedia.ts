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
 * Add Media Tool
 *
 * This module provides a tool to upload a local media file to the Xibo CMS library.
 * It implements the 'POST /library' endpoint and handles the multipart/form-data upload.
 */
import { z } from "zod";
import { createTool } from '@mastra/core';
import { logger } from '../../../index';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { librarySchema } from './schemas';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';

// Schema for a successful file upload entry in the response
const uploadSuccessSchema = z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    mediaId: z.number(),
    storedas: z.string(),
    duration: z.number(),
    retired: z.number(),
    fileSize: z.number(),
    md5: z.string(),
    enableStat: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    mediaType: z.string(),
    fileName: z.string(),
});

// Schema for a failed file upload entry in the response
const uploadErrorSchema = z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
    error: z.string(),
});

// This specific tool has a unique response structure which can contain success and error objects.
const addMediaResponseSchema = z.object({
    files: z.array(z.union([uploadSuccessSchema, uploadErrorSchema])),
});

// Schema for the input, based on the POST /library endpoint parameters
const inputSchema = z.object({
    fileName: z.string().describe("The name of the file to upload (e.g., 'image.png')."),
    filePath: z.string().optional().default('persistent_data/uploads/').describe("The relative path to the file from the project root. Defaults to 'persistent_data/uploads/'."),
    name: z.string().optional().describe("Optional name for the new media item."),
    oldMediaId: z.number().optional().describe("Id of an existing media file which should be replaced with the new upload."),
    updateInLayouts: z.number().optional().describe("Flag (0, 1), set to 1 to update this media in all layouts (use with oldMediaId)."),
    deleteOldRevisions: z.number().optional().describe("Flag (0, 1), to either remove or leave the old file revisions (use with oldMediaId)."),
    tags: z.string().optional().describe("Comma separated string of Tags that should be assigned to uploaded Media."),
    expires: z.string().optional().describe("Date in Y-m-d H:i:s format, will set expiration date on the uploaded Media."),
    playlistId: z.number().optional().describe("A playlistId to add this uploaded media to."),
    widgetFromDt: z.string().optional().describe("Date in Y-m-d H:i:s format, will set widget start date. Requires a playlistId."),
    widgetToDt: z.string().optional().describe("Date in Y-m-d H:i:s format, will set widget end date. Requires a playlistId."),
    deleteOnExpiry: z.number().optional().describe("Flag (0, 1), set to 1 to remove the Widget from the Playlist when the widgetToDt has been reached."),
    applyToMedia: z.number().optional().describe("Flag (0, 1), set to 1 to apply the widgetFromDt as the expiry date on the Media."),
    folderId: z.number().optional().describe("Folder ID to which this object should be assigned to."),
});

// The API returns an array containing the new media object.
const outputSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    data: addMediaResponseSchema.optional(),
    error: z.any().optional(),
    errorData: z.any().optional(),
});

/**
 * Tool for Uploading a Local Media File
 *
 * This tool uploads a file from the local filesystem to the Xibo Library.
 * It uses the 'form-data' library for robust multipart/form-data request creation.
 */
export const addMedia = createTool({
    id: 'add-media',
    description: 'Uploads a local media file to the Library.',
    inputSchema,
    outputSchema,
    execute: async ({ context: input }) => {
        const { fileName, filePath, ...otherParams } = input;

        if (!config.cmsUrl) {
            logger.error({}, 'addMedia: CMS URL is not configured.');
            return { success: false, message: 'CMS URL is not configured.' };
        }

        const absoluteFilePath = path.resolve(config.projectRoot, filePath, fileName);

        try {
            // Read the file from the local path
            const fileBuffer = await fs.readFile(absoluteFilePath);
            
            const form = new FormData();

            // Append the file with an explicit filename. This is the key to solving the issue.
            form.append('files', fileBuffer, { filename: fileName });

            // Append other optional parameters
            for (const [key, value] of Object.entries(otherParams)) {
                if (value !== undefined) {
                    form.append(key, String(value));
                }
            }

            const url = `${config.cmsUrl}/api/library`;
            logger.debug(`addMedia: Posting to URL: ${url}`);
            
            const authHeaders = await getAuthHeaders();
            
            // Use form.getHeaders() to get the correct Content-Type with boundary
            const response = await axios.post(url, form, {
                headers: {
                    ...authHeaders,
                    ...form.getHeaders(),
                },
            });

            // The success response for adding a single media item is an object with a "files" key containing an array.
            const parsedData = addMediaResponseSchema.safeParse(response.data);

            if (!parsedData.success) {
                logger.error(
                    { error: parsedData.error.format(), rawData: response.data },
                    'addMedia: Zod validation failed'
                );
                return { success: false, message: 'Validation failed for the API response.', error: parsedData.error.format(), errorData: response.data };
            }

            // Check for business logic errors within the successful response
            const firstError = parsedData.data.files.find(file => 'error' in file && file.error);
            if (firstError && 'error' in firstError) {
                logger.warn({ error: firstError.error, rawData: parsedData.data }, 'addMedia: Business logic error reported by CMS');
                return {
                    success: false,
                    message: firstError.error,
                    errorData: parsedData.data,
                };
            }

            return { success: true, data: parsedData.data };

        } catch (error) {
            if (error instanceof AxiosError) {
                const errorDetails = {
                    status: error.response?.status,
                    data: error.response?.data,
                    headers: error.response?.headers,
                };
                logger.error({ error: error.message, details: errorDetails }, 'addMedia: HTTP error');
                return { 
                    success: false, 
                    message: `HTTP error! status: ${error.response?.status}`, 
                    error: error.message,
                    errorData: error.response?.data 
                };
            }
            
            let errorMessage = "An unexpected error occurred.";
            if (error instanceof Error) {
                errorMessage = error.message;
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    errorMessage = `File not found at path: ${absoluteFilePath}`;
                }
            }
            logger.error({ error: errorMessage, details: error }, 'addMedia: Unexpected error');
            return { success: false, message: errorMessage, errorData: error };
        }
    },
}); 