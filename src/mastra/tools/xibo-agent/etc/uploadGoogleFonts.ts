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
 * Google Fonts Download and Upload Tool
 * 
 * This module provides functionality to download a font from Google Fonts
 * and automatically upload it to the Xibo CMS system.
 * 
 * It combines the Google Fonts API metadata retrieval with direct font file 
 * download and Xibo CMS upload capabilities.
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
import * as https from 'https';
import { getGoogleFonts } from './getGoogleFonts';

/**
 * Schema for font varieties (weights and styles)
 */
const fontVarietySchema = z.object({
  weight: z.number().describe("Font weight (e.g., 400 for normal, 700 for bold)"),
  style: z.string().describe("Font style (normal, italic)"),
}).optional();

/**
 * Schema for API response validation for the font upload
 */
const apiResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    data: z.object({
      id: z.number(),
      name: z.string(),
      // Other fields are optional since we only need these for confirmation
    }).passthrough(),
  }),
  z.object({
    id: z.number(),
    name: z.string(),
  }).passthrough(),
]);

/**
 * Tool for downloading Google Fonts and uploading to Xibo CMS
 */
export const uploadGoogleFonts = createTool({
  id: "upload-google-fonts",
  description: "Download a font from Google Fonts and upload it to Xibo CMS",
  inputSchema: z.object({
    family: z.string().describe("The font family name to download (e.g., 'Roboto', 'Noto Sans JP')"),
    variety: fontVarietySchema.describe("Font weight and style (optional)"),
    displayName: z.string().optional().describe("Custom display name in Xibo CMS (defaults to family name)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    fontData: apiResponseSchema.optional(),
  }),
  execute: async ({ context }) => {
    let tempFilePath = null;
    
    try {
      if (!config.cmsUrl) {
        logger.error("uploadGoogleFonts: CMS URL is not set");
        throw new Error("CMS URL is not set");
      }

      // 直接Google Fonts APIを呼び出す（getGoogleFontsツールを使わず）
      const apiKey = process.env.GOOGLE_FONTS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Google Fonts API Key is not set in environment variables (GOOGLE_FONTS_API_KEY)');
      }
      
      // リクエストパラメータを設定
      const params = new URLSearchParams();
      params.append('key', apiKey);
      params.append('family', context.family);
      
      const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?${params.toString()}`;
      logger.info(`Fetching Google Fonts data for family: ${context.family}`);
      
      // Google Fonts APIを呼び出す
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Fonts API returned an error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        logger.error(`Font family '${context.family}' not found in Google Fonts`);
        return {
          success: false,
          message: `Font family '${context.family}' not found in Google Fonts API`
        };
      }
      
      // 最初のフォント情報を抽出
      const fontInfo = data.items[0];
      logger.info(`Found font: ${fontInfo.family} with ${Object.keys(fontInfo.files).length} varieties`);
      
      // Step 2: Determine which font file to download
      const varieties = Object.keys(fontInfo.files);
      let selectedVariety = varieties[0]; // Default to first variety
      
      // If user specified a variety (weight+style), try to find the closest match
      if (context.variety) {
        const { weight, style } = context.variety;
        const weightStr = weight ? weight.toString() : '400';
        const styleStr = style || 'normal';
        
        // Try to find exact match
        const exactMatch = varieties.find(v => v === `${weightStr}${styleStr !== 'normal' ? styleStr : ''}`);
        if (exactMatch) {
          selectedVariety = exactMatch;
        } else {
          // Find closest weight
          const availableWeights = varieties.map(v => {
            const numWeight = parseInt(v.replace(/[^\d]/g, '')) || 400;
            return {
              variety: v,
              weight: numWeight,
              distance: Math.abs(numWeight - (weight || 400))
            };
          }).sort((a, b) => a.distance - b.distance);
          
          selectedVariety = availableWeights[0].variety;
        }
      }
      
      // Get download URL for the selected variety
      const downloadUrl = fontInfo.files[selectedVariety];
      const fontName = context.displayName || fontInfo.family;
      const fileName = `${fontName.replace(/\s+/g, '-')}-${selectedVariety}.ttf`;
      
      logger.info(`Selected font variety: ${selectedVariety}, URL: ${downloadUrl}`);
      
      // Step 3: Download the font file to a temporary location
      const tmpDir = os.tmpdir();
      tempFilePath = path.join(tmpDir, `xibo-google-font-${Date.now()}-${fileName}`);
      
      await downloadFile(downloadUrl, tempFilePath);
      logger.info(`Font downloaded to temporary file: ${tempFilePath}`);
      
      // Step 4: Upload the font to Xibo CMS
      const url = new URL(`${config.cmsUrl}/api/fonts`);
      const formData = new FormData();
      
      // Create file object from temp file
      const fileStream = fs.createReadStream(tempFilePath);
      const fileBlob = new Blob([await streamToBuffer(fileStream)]);
      
      // Add to form data
      formData.append("files", new File([fileBlob], fileName));
      
      // Add display name if provided
      if (context.displayName) {
        formData.append("name", context.displayName);
      }
      
      logger.info(`Uploading font to Xibo CMS: ${url.toString()}`);
      
      // Get auth headers and make the request
      const headers = await getAuthHeaders();
      const responseUpload = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: formData,
      });
      
      // Handle error responses
      if (!responseUpload.ok) {
        const responseText = await responseUpload.text();
        const errorMessage = decodeErrorMessage(responseText);
        logger.error(`Failed to upload Google Font: ${errorMessage}`, {
          status: responseUpload.status,
          url: url.toString()
        });
        throw new Error(`HTTP error! status: ${responseUpload.status}, message: ${errorMessage}`);
      }
      
      // Parse and validate the response
      const rawData = await responseUpload.json();
      logger.debug(`Raw upload response: ${JSON.stringify(rawData)}`);
      
      // Handle response format
      const validatedData = apiResponseSchema.parse(rawData);
      let fontId: number;
      let fontDisplayName: string;
      
      if ('data' in validatedData && validatedData.data) {
        // 型アサーションを使用して安全にアクセス
        const dataObj = validatedData.data as { id: number, name: string };
        fontId = dataObj.id;
        fontDisplayName = dataObj.name;
      } else {
        // 型アサーションを使用して安全にアクセス
        const dataObj = validatedData as { id: number, name: string };
        fontId = dataObj.id;
        fontDisplayName = dataObj.name;
      }
      
      logger.info(`Google Font uploaded successfully to Xibo CMS with ID: ${fontId}`);
      
      return {
        success: true,
        message: `Successfully downloaded and uploaded Google Font '${fontInfo.family}' (${selectedVariety}) to Xibo CMS with name '${fontDisplayName}'`,
        fontData: validatedData
      };
    } catch (error) {
      logger.error(`uploadGoogleFonts: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to download and upload Google Font"
      };
    } finally {
      // Cleanup temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.debug(`Temporary font file deleted: ${tempFilePath}`);
        } catch (cleanupError) {
          logger.warn(`Failed to delete temporary font file: ${tempFilePath}`, { error: cleanupError });
        }
      }
    }
  },
});

/**
 * Helper function to download a file from a URL to a local path
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download font. Status Code: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath); // Clean up failed download
      reject(err);
    });
  });
}

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

export default uploadGoogleFonts; 