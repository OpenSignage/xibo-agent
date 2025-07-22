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
 * @description Provides a tool to upload a new player software version to the Xibo CMS.
 * It implements the POST /playersoftware endpoint for file uploads.
 */
import { z } from 'zod';
import { createTool } from '@mastra/core';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { getAuthHeaders } from '../auth';
import { config } from '../config';
import { logger } from '../../../logger';
import { processError } from '../utility/error';

/**
 * Schema for a successfully uploaded file object.
 */
const successFileSchema = z.object({
  id: z.number().describe('The ID of the uploaded file record.'),
  name: z.string().describe('The original name of the uploaded file.'),
  fileName: z.string().describe('The stored file name.'),
  type: z.string().describe('The MIME type of the file.'),
  size: z.number().describe('The size of the file in bytes.'),
  md5: z.string().describe('The MD5 hash of the file.'),
});

/**
 * Schema for a file object that has an error reported by the CMS.
 */
const errorFileSchema = z.object({
  name: z.string().describe('The original name of the uploaded file.'),
  fileName: z
    .string()
    .optional()
    .describe('The stored file name (if available in the response).'),
  type: z.string().describe('The MIME type of the file.'),
  size: z.number().describe('The size of the file in bytes.'),
  error: z
    .string()
    .describe('An error message if the upload failed for this file.'),
});

/**
 * Union schema to handle both successful and errored file responses.
 */
const uploadedFileSchema = z.union([successFileSchema, errorFileSchema]);

/**
 * Schema for the full API response, which contains an array of file objects.
 */
const apiResponseSchema = z.object({
  files: z
    .array(uploadedFileSchema)
    .min(1, 'API response must contain at least one file.'),
});

/**
 * Schema for the successful response, containing the new player version details.
 */
const uploadPlayerSoftwareSuccessSchema = z.object({
  success: z.literal(true),
  data: successFileSchema,
});

/**
 * Schema for a standardized error response.
 */
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string().describe('A simple, readable error message.'),
  error: z
    .any()
    .optional()
    .describe('Detailed error information, e.g., from Zod.'),
  errorData: z.any().optional().describe('Raw response data from the CMS.'),
});

/**
 * Union schema for tool output, covering both success and error cases.
 */
const outputSchema = z.union([
  uploadPlayerSoftwareSuccessSchema,
  errorResponseSchema,
]);

/**
 * Tool to upload a new player software version to the Xibo CMS.
 */
export const uploadPlayerSoftware = createTool({
  id: 'upload-player-software',
  description: 'Uploads a new player software version.',
  inputSchema: z.object({
    fileName: z
      .string()
      .describe(
        'The file name of the player software to upload, located in the configured upload directory.'
      ),
  }),
  outputSchema,
  execute: async ({ context }) => {
    if (!config.cmsUrl) {
      const message = 'CMS URL is not configured.';
      logger.error({}, message);
      return { success: false as const, message };
    }

    try {
      const resolvedPath = path.join(config.uploadDir, context.fileName);
      if (!fs.existsSync(resolvedPath)) {
        const message = `File not found at path: ${resolvedPath}`;
        logger.error({ path: resolvedPath }, message);
        return { success: false as const, message };
      }

      const form = new FormData();
      form.append('files', fs.createReadStream(resolvedPath));

      const url = new URL(`${config.cmsUrl}/api/playersoftware`);
      const authHeaders = await getAuthHeaders();
      const formHeaders = form.getHeaders();

      const headers = {
        ...authHeaders,
        ...formHeaders,
      };

      logger.debug(
        { url: url.toString() },
        `Attempting to upload player software from ${resolvedPath}`
      );

      const response = await axios.post(url.toString(), form, { headers });
      const responseData = response.data;

      // Axios considers non-2xx statuses as errors and throws,
      // so we mostly handle success cases here.
      // The validation a few lines below will handle if the response body is not what we expect

      const validationResult = apiResponseSchema.safeParse(responseData);
      if (!validationResult.success) {
        const message = 'Upload player software response validation failed.';
        logger.error(
          { error: validationResult.error.flatten(), data: responseData },
          message
        );
        return {
          success: false as const,
          message,
          error: validationResult.error.flatten(),
          errorData: responseData,
        };
      }

      // We uploaded one file, so we expect one file object in the response.
      const uploadedFile = validationResult.data.files[0];

      // Check if the CMS returned a specific error for the file (e.g., duplicate)
      if ('error' in uploadedFile && uploadedFile.error) {
        const message = `CMS returned an error for the file: ${uploadedFile.error}`;
        logger.error({ file: uploadedFile }, message);
        return {
          success: false as const,
          message,
          error: uploadedFile.error,
          errorData: responseData,
        };
      }

      // If we are here, it should be a successful upload. We use a type guard to be safe.
      if ('id' in uploadedFile) {
        logger.info(
          { versionId: uploadedFile.id },
          `Successfully uploaded player software file. ID: ${uploadedFile.id}.`
        );
        return { success: true as const, data: uploadedFile };
      }

      // This case should not be reached if API behavior is consistent.
      const fallbackMessage = 'Unexpected API response structure after upload.';
      logger.error({ data: responseData }, fallbackMessage);
      return {
        success: false as const,
        message: fallbackMessage,
        error: 'Unexpected response format.',
        errorData: responseData,
      };
    } catch (error) {
      const processedError = processError(error);
      const message = 'An unexpected error occurred while uploading player software.';
      logger.error({ error: processedError }, message);
      
      // If the error is from axios, it might contain response data
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false as const,
          message: error.response.data?.message || message,
          error: processedError,
          errorData: error.response.data
        };
      }
      
      return { success: false as const, message, error: processedError };
    }
  },
});
