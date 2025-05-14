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
 * Schema definition for font data returned after successful upload
 */
const fontSchema = z.object({
  id: z.number().describe("The Font ID"),
  createdAt: z.string().describe("The Font created date"),
  modifiedAt: z.string().describe("The Font modified date"),
  modifiedBy: z.string().describe("The name of the user that modified this font last"),
  name: z.string().describe("The Font name"),
  fileName: z.string().describe("The Font file name"),
  familyName: z.string().describe("The Font family name"),
  size: z.number().describe("The Font file size in bytes"),
  md5: z.string().describe("A MD5 checksum of the stored font file"),
});

/**
 * Schema for API response validation
 * Supports multiple response formats that the API might return
 */
const apiResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    data: fontSchema,
  }),
  fontSchema,
]);

/**
 * Tool for uploading font files to Xibo CMS
 * Supports multiple input methods for flexibility across different environments
 */
export const uploadFont = createTool({
  id: "upload-font",
  description: "Upload a font file to Xibo CMS",
  inputSchema: z.object({
    // Support multiple file source methods
    file: z.instanceof(File).optional().describe("The font file to upload (browser environment only)"),
    fileContent: z.string().optional().describe("Base64 encoded file content"),
    filePath: z.string().optional().describe("Path to font file on the agent server"),
    fileName: z.string().optional().describe("Original filename (required with fileContent)"),
    name: z.string().optional().describe("Custom name for the font (optional)"),
  }).refine(data => data.file || data.fileContent || data.filePath, {
    message: "At least one of file, fileContent, or filePath must be provided",
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      if (!config.cmsUrl) {
        logger.error("uploadFont: CMS URL is not set");
        throw new Error("CMS URL is not set");
      }

      const url = new URL(`${config.cmsUrl}/api/fonts`);
      const formData = new FormData();
      let tempFilePath = null;
      
      // Handle different file sources
      if (context.file) {
        // Direct file upload (browser environment)
        logger.info(`Using direct File object for upload: ${context.file.name}`);
        formData.append("files", context.file);
      } 
      else if (context.fileContent) {
        // Base64 encoded content - decode and save to temp file
        if (!context.fileName) {
          throw new Error("fileName is required when using fileContent");
        }
        
        logger.info(`Processing Base64 encoded file content for ${context.fileName}`);
        
        // Create temporary file
        const tmpDir = os.tmpdir();
        tempFilePath = path.join(tmpDir, `xibo-upload-${Date.now()}-${context.fileName}`);
        
        // Decode and write Base64 content to temp file
        const fileBuffer = Buffer.from(context.fileContent, 'base64');
        fs.writeFileSync(tempFilePath, fileBuffer);
        logger.debug(`Temporary file created at: ${tempFilePath}`);
        
        // Create file object from temp file
        const fileStream = fs.createReadStream(tempFilePath);
        const fileBlob = new Blob([await streamToBuffer(fileStream)]);
        const fileName = context.fileName;
        
        // Add to form data
        formData.append("files", new File([fileBlob], fileName));
      }
      else if (context.filePath) {
        // Local file path on agent server
        logger.info(`Using local file for upload: ${context.filePath}`);
        
        if (!fs.existsSync(context.filePath)) {
          throw new Error(`File not found: ${context.filePath}`);
        }
        
        // Create file object from local file
        const fileStream = fs.createReadStream(context.filePath);
        const fileBlob = new Blob([await streamToBuffer(fileStream)]);
        const fileName = context.fileName || path.basename(context.filePath);
        
        // Add to form data
        formData.append("files", new File([fileBlob], fileName));
      }
      
      // Add optional custom name
      if (context.name) {
        formData.append("name", context.name);
        logger.info(`Using custom font name: ${context.name}`);
      }
      
      logger.debug(`Request URL: ${url.toString()}`);

      // Get auth headers and make the request
      const headers = await getAuthHeaders();
      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: formData,
      });

      // Cleanup any temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.debug(`Temporary file deleted: ${tempFilePath}`);
        } catch (cleanupError) {
          logger.warn(`Failed to delete temporary file: ${tempFilePath}`, { error: cleanupError });
        }
      }

      // Handle error responses
      if (!response.ok) {
        const responseText = await response.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to upload font: ${errorMessage}`, {
          status: response.status,
          url: url.toString()
        });
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
      }

      // Parse and validate the response
      const rawData = await response.json();
      logger.debug(`Raw upload response: ${JSON.stringify(rawData)}`);
      
      // Handle different response formats
      try {
        const validatedData = apiResponseSchema.parse(rawData);
        
        // Standardize the response format and extract font ID safely
        let result;
        let fontId: number;
        
        if ('success' in validatedData && 'data' in validatedData) {
          // Standard format: { success: boolean, data: fontSchema }
          result = validatedData;
          fontId = validatedData.data.id;
        } else {
          // Direct font object format
          result = { success: true, data: validatedData };
          fontId = validatedData.id;
        }
        
        logger.info(`Font uploaded successfully with ID: ${fontId}`);
        return result;
      } catch (validationError) {
        logger.error(`Response validation error: ${validationError instanceof Error ? validationError.message : "Unknown validation error"}`, {
          rawData,
          error: validationError
        });
        
        // Fallback: Return raw data with success flag if validation fails
        logger.warn("Returning unvalidated response due to schema mismatch");
        return { 
          success: true, 
          data: rawData.data || rawData 
        };
      }
    } catch (error) {
      logger.error(`uploadFont: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      throw error;
    }
  },
});

/**
 * Helper function to convert a readable stream to a buffer
 */
async function streamToBuffer(stream: fs.ReadStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export default uploadFont; 