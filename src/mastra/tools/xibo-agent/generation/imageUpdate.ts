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
 * Image Update Tool using Google Gemini API
 * 
 * This module provides functionality to update existing images using Google's Gemini API.
 * It maintains the same aspect ratio and dimensions as the original image.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "../config";
import { logger } from '../../../index';
import * as fs from "node:fs";
import * as path from "path";
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { getHistory, addImage } from './imageHistory';

/**
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    imagePath: z.string(),
    imageUrl: z.string(),
    prompt: z.string(),
    width: z.number(),
    height: z.number(),
    generatorId: z.string(),
    error: z.string().optional(),
  }),
});

/**
 * Tool for updating images using Google Gemini API
 * 
 * Features:
 * - Update existing images based on new prompts
 * - Maintain original aspect ratio and dimensions
 * - Automatic image processing and resizing
 * - Error handling and logging
 * - Image generation history management
 */
export const updateImage = createTool({
  id: "update-image",
  description: "Update existing images using Google Gemini API",
  inputSchema: z.object({
    generatorId: z.string().describe("ID of the generation process"),
    imageId: z.number().describe("ID of the image to update"),
    prompt: z.string().describe("New text prompt for image generation"),
    outputDir: z.string().optional().describe("Directory to save the generated image"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables");
      }

      // 元の画像情報を取得
      const history = getHistory(context.generatorId);
      const originalImage = history.images.find(img => img.id === context.imageId);
      if (!originalImage) {
        throw new Error(`Image with ID ${context.imageId} not found`);
      }

      // Enhance prompt with aspect ratio information
      const enhancedPrompt = `${context.prompt} (Aspect ratio: ${originalImage.aspectRatio}, Dimensions: ${originalImage.width}x${originalImage.height})`;

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // Generate updated image using Gemini API
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: enhancedPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      // Process the response
      let imagePath = '';
      let imageUrl = '';
      
      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error("Invalid response from Gemini API");
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const imageData = part.inlineData.data;
          if (typeof imageData !== 'string') {
            throw new Error("Invalid image data format");
          }
          
          const buffer = Buffer.from(imageData, "base64");
          
          // Resize the image to match the original dimensions
          const resizedBuffer = await sharp(buffer)
            .resize(originalImage.width, originalImage.height, {
              fit: 'contain',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();
          
          // Determine output directory
          const outputDir = context.outputDir || path.join(process.cwd(), 'generated');
          
          // Create output directory if it doesn't exist
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Save the processed image
          const filename = `image-${uuidv4()}.png`;
          imagePath = path.join(outputDir, filename);
          fs.writeFileSync(imagePath, resizedBuffer);
          
          // Create image URL for localhost server
          const relativePath = path.relative(process.cwd(), imagePath);
          imageUrl = `http://localhost:4111/${relativePath.replace(/\\/g, '/')}`;

          // 画像を履歴に追加
          addImage(context.generatorId, {
            filename,
            prompt: enhancedPrompt,
            aspectRatio: originalImage.aspectRatio,
            width: originalImage.width,
            height: originalImage.height,
            createdAt: new Date().toISOString(),
          });
          
          logger.info(`Image updated and saved to: ${imagePath} (${originalImage.width}x${originalImage.height})`);
          logger.debug(`Image URL: ${imageUrl}`);
        }
      }

      if (!imagePath) {
        throw new Error("No image was generated");
      }

      return {
        success: true,
        data: {
          imagePath,
          imageUrl,
          prompt: enhancedPrompt,
          width: originalImage.width,
          height: originalImage.height,
          generatorId: context.generatorId,
        },
      };

    } catch (error) {
      logger.error(`updateImage: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        data: {
          imagePath: '',
          imageUrl: '',
          prompt: context.prompt,
          width: 0,
          height: 0,
          generatorId: context.generatorId,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  },
}); 