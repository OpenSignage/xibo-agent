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
 * @module uploadGoogleFonts
 * @description A comprehensive tool to download a font from Google Fonts and upload it to the Xibo CMS.
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
import { getGoogleFonts } from './getGoogleFonts';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

/**
 * Schema for a successful font upload response from Xibo.
 */
const xiboFontUploadResponseSchema = z.object({
    files: z.array(z.object({
        mediaId: z.number(),
        name: z.string(),
    })),
});

/**
 * Defines the schema for a successful tool execution.
 */
const successSchema = z.object({
  success: z.literal(true),
  message: z.string().describe("A summary of the successful operation."),
  fontData: xiboFontUploadResponseSchema.describe("The response data from Xibo CMS after the upload."),
});

/**
 * Defines the schema for a failed operation.
 */
const errorSchema = z.object({
  success: z.literal(false),
  message: z.string().describe("A human-readable error message."),
  error: z.any().optional().describe("Optional technical details about the error."),
});

/**
 * A tool for downloading a Google Font and uploading it to Xibo CMS.
 */
export const uploadGoogleFonts = createTool({
  id: "upload-google-fonts",
  description: "Downloads a font from Google Fonts and uploads it to Xibo CMS.",
  inputSchema: z.object({
    family: z.string().describe("The font family name to download (e.g., 'Roboto', 'Noto Sans JP')."),
    variant: z.string().optional().default('regular').describe("The font variant to download (e.g., 'regular', 'italic', '700', '700italic')."),
    displayName: z.string().optional().describe("Custom display name in Xibo CMS (defaults to the family name)."),
  }),
  outputSchema: z.union([successSchema, errorSchema]),
  execute: async ({
    context: input,
    runtimeContext,
  }): Promise<z.infer<typeof successSchema> | z.infer<typeof errorSchema>> => {
    // Step 1: Get font metadata from Google Fonts using the existing tool.
    const fontInfoResult = await getGoogleFonts.execute({
      context: {
        family: input.family,
        limit: 1,
        subset: 'latin',
        capability: ['VF'],
      },
      runtimeContext,
    });

    if (!fontInfoResult.success) {
      const message = `Font family '${input.family}' not found on Google Fonts.`;
      logger.error(message, { cause: fontInfoResult.message });
      return { success: false, message: fontInfoResult.message, error: fontInfoResult };
    }

    if (fontInfoResult.fonts.length === 0) {
      const message = `Font family '${input.family}' not found on Google Fonts.`;
      logger.error(message, { cause: 'No fonts returned' });
      return { success: false, message, error: 'No fonts returned from API' };
    }
    
    const fontInfo = fontInfoResult.fonts[0];
    const selectedVariant = input.variant || 'regular';

    if (!fontInfo.files[selectedVariant]) {
      const message = `Variant '${selectedVariant}' not found for font '${input.family}'. Available variants: ${Object.keys(fontInfo.files).join(', ')}.`;
      logger.error(message);
      return { success: false, message };
    }
    
    const downloadUrl = fontInfo.files[selectedVariant];
    const fontNameForXibo = input.displayName || fontInfo.family;
    const tempFileName = `${fontNameForXibo.replace(/\s+/g, '-')}-${selectedVariant}-${Date.now()}.ttf`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    // Step 2: Download the font file to a temporary location.
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        const message = `Failed to download font file from Google. Status: ${response.status}`;
        logger.error(message, { url: downloadUrl });
        return { success: false, message, error: { statusCode: response.status } };
      }
      if (!response.body) {
        const message = "The font download response did not contain a body.";
        logger.error(message);
        return { success: false, message };
      }
      const fileStream = fs.createWriteStream(tempFilePath);
      // @ts-ignore - response.body is a ReadableStream
      await finished(Readable.fromWeb(response.body).pipe(fileStream));
      logger.info(`Font successfully downloaded to temporary file: ${tempFilePath}`);
    } catch (error: any) {
      const message = `Error downloading font file: ${error.message}`;
      logger.error(message, { error });
      return { success: false, message, error };
    }

    // Step 3: Upload the font to Xibo CMS.
    try {
        const formData = new FormData();
        const fileBlob = new Blob([fs.readFileSync(tempFilePath)]);
        formData.append("files", fileBlob, `${fontNameForXibo}-${selectedVariant}.ttf`);
        formData.append("name", fontNameForXibo);

        const uploadUrl = `${config.cmsUrl}/api/library`;
        const uploadResponse = await fetch(uploadUrl, {
            method: "POST",
            headers: await getAuthHeaders(),
            body: formData,
        });

        const responseText = await uploadResponse.text();
        const responseData = JSON.parse(responseText);

        if (!uploadResponse.ok) {
            const decodedText = decodeErrorMessage(responseText);
            const message = `Failed to upload font to Xibo CMS. Status: ${uploadResponse.status}.`;
            logger.error(message, { response: decodedText });
            return { success: false, message, error: { statusCode: uploadResponse.status, responseBody: responseData } };
        }

        const validationResult = xiboFontUploadResponseSchema.safeParse(responseData);
        if (!validationResult.success) {
            const message = "Xibo CMS upload response validation failed.";
            logger.error(message, { error: validationResult.error.issues, data: responseData });
            return { success: false, message, error: { validationIssues: validationResult.error.issues, receivedData: responseData } };
        }

        logger.info(`Font '${fontNameForXibo}' successfully uploaded to Xibo CMS.`);
        return {
            success: true,
            message: `Successfully uploaded font '${fontNameForXibo}' (${selectedVariant}).`,
            fontData: validationResult.data,
        };
    } catch (error: any) {
        const message = `An unexpected error occurred during Xibo CMS upload: ${error.message}`;
        logger.error(message, { error });
        return { success: false, message, error };
    } finally {
        if (fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                logger.debug(`Temporary font file deleted: ${tempFilePath}`);
            } catch (cleanupError: any) {
                logger.warn(`Failed to delete temporary font file: ${cleanupError.message}`, { error: cleanupError });
            }
        }
    }
  },
}); 