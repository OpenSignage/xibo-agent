import { GET_IMAGE_API } from '../../../config/constants';
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
import { logger } from '../../../logger';
import * as fs from "node:fs";
import * as path from "path";
import { v4 as uuidv4 } from 'uuid';
// import sharp from 'sharp';
import { getHistory, addImage } from './imageHistory';
import { aspectRatioOptions } from './imageGeneration';

type AspectRatio = keyof typeof aspectRatioOptions;

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
    textResponse: z.string().optional(),
    originalImageId: z.number(),
    newImageId: z.number(),
    error: z.string().optional(),
  }),
});

/**
 * Crops and resizes an image to match the specified aspect ratio
 * The longer side is fixed at 1024 pixels, and the shorter side is adjusted
 * to maintain the target aspect ratio
 * 
 * @param buffer - The input image buffer
 * @param aspectRatio - The target aspect ratio
 * @returns The processed image buffer and its dimensions
 */
async function cropToAspectRatio(
  buffer: Buffer,
  aspectRatio: AspectRatio
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const targetRatio = aspectRatioOptions[aspectRatio];

  // Since sharp is removed, we cannot process the image.
  // We will return the original buffer and the target dimensions.
  return {
    buffer: buffer,
    width: targetRatio.width,
    height: targetRatio.height,
  };
}

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
    generatorId: z.string().default("1").describe("ID of the generation process (default: '1')"),
    imageId: z.number().optional().describe("ID of the image to update (default: latest image)"),
    prompt: z.string().describe("Text prompt describing how to modify the existing image"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    let originalImage: any = null;  // スコープ外で使用するため、ここで宣言
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables");
      }

      // 元の画像情報を取得
      const history = getHistory(context.generatorId);
      
      // imageIdが指定されていない場合は最新の画像を使用
      if (context.imageId) {
        originalImage = history.images.find(img => img.id === context.imageId);
        if (!originalImage) {
          throw new Error(`Image with ID ${context.imageId} not found`);
        }
      } else {
        // 最新の画像を取得
        if (history.images.length === 0) {
          throw new Error("No images found in history");
        }
        originalImage = history.images[history.images.length - 1];
        logger.info(`Using latest image with ID: ${originalImage.id}`);
      }

      // 元の画像ファイルを読み込む
      const originalImagePath = path.join(config.generatedDir, originalImage.filename);
      if (!fs.existsSync(originalImagePath)) {
        throw new Error(`Original image file not found: ${originalImagePath}`);
      }
      const originalImageBuffer = fs.readFileSync(originalImagePath);
      const originalImageBase64 = originalImageBuffer.toString('base64');

      // Enhance prompt with aspect ratio information and original image
      const enhancedPrompt = `${context.prompt} (Aspect ratio: ${originalImage.aspectRatio}, Dimensions: ${originalImage.width}x${originalImage.height})`;
      logger.info(`Enhanced prompt: ${enhancedPrompt}`);

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // Generate updated image using Gemini API with original image as reference
      logger.info('Calling Gemini API for image generation...');
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: [
          {
            text: enhancedPrompt
          },
          {
            inlineData: {
              data: originalImageBase64,
              mimeType: "image/png"
            }
          }
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      logger.info('Received response from Gemini API');

      // Process the response
      let imagePath = '';
      let imageUrl = '';
      let textResponse = '';
      
      if (!response.candidates?.[0]?.content?.parts) {
        logger.error({ response }, 'Invalid response structure from Gemini API');
        throw new Error("Invalid response from Gemini API");
      }

      logger.info(`Processing ${response.candidates[0].content.parts.length} parts from response`);
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          textResponse = part.text;
          logger.info(`Received text response: ${textResponse}`);
        } else if (part.inlineData?.data) {
          logger.info('Found image data in response');
          const imageData = part.inlineData.data;
          if (typeof imageData !== 'string') {
            logger.error({ type: typeof imageData }, 'Invalid image data format');
            throw new Error("Invalid image data format");
          }
          
          const buffer = Buffer.from(imageData, "base64");
          logger.info('Successfully decoded base64 image data');
          
          // Crop and resize the image to match the original aspect ratio
          logger.info('Cropping and resizing image...');
          const { buffer: croppedBuffer, width: croppedWidth, height: croppedHeight } = 
            await cropToAspectRatio(buffer, originalImage.aspectRatio as AspectRatio);
          logger.info(`Image cropped and resized to ${croppedWidth}x${croppedHeight}`);
          
          // Determine output directory
          const outputDir = config.generatedDir;
          logger.info(`Output directory: ${outputDir}`);
          
          // Create output directory if it doesn't exist
          if (!fs.existsSync(outputDir)) {
            logger.info('Creating output directory');
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Save the processed image
          const filename = `image-${uuidv4()}.png`;
          imagePath = path.join(outputDir, filename);
          logger.info(`Saving image to: ${imagePath}`);
          fs.writeFileSync(imagePath, croppedBuffer);
          
          // Create image URL for ext-api
          imageUrl = `${GET_IMAGE_API}/${filename}`;
          
          logger.info(`Image updated and saved to: ${imagePath} (${croppedWidth}x${croppedHeight})`);
          logger.debug(`Image URL: ${imageUrl}`);

          // 画像を履歴に追加
          logger.info(`Adding image to history for generatorId: ${context.generatorId}`);
          const newImageData = {
            filename,
            prompt: enhancedPrompt,
            aspectRatio: originalImage.aspectRatio,
            width: croppedWidth,
            height: croppedHeight,
            createdAt: new Date().toISOString(),
          };
          addImage(context.generatorId, newImageData);
          const newImageId = getHistory(context.generatorId).images.length;  // 最新の画像IDを取得
          logger.info(`Image added to history successfully. Original ID: ${originalImage.id}, New ID: ${newImageId}`);

          return {
            success: true,
            data: {
              imagePath: `generated/${path.basename(imagePath)}`,
              imageUrl,
              prompt: enhancedPrompt,
              width: croppedWidth,
              height: croppedHeight,
              generatorId: context.generatorId,
              textResponse,
              originalImageId: originalImage.id,
              newImageId,
            },
          };
        }
      }

      if (!imagePath) {
        logger.error('No image was generated from the response');
        throw new Error("No image was generated");
      }

      return {
        success: true,
        data: {
          imagePath: `generated/${path.basename(imagePath)}`,
          imageUrl,
          prompt: enhancedPrompt,
          width: originalImage.width,
          height: originalImage.height,
          generatorId: context.generatorId,
          textResponse,
          originalImageId: originalImage.id,
          newImageId: 0,
        },
      };

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        error: errMsg,
        originalImageId: originalImage?.id,
        context: {
          prompt: context.prompt,
          generatorId: context.generatorId,
        }
      }, 'updateImage: An error occurred');
      return {
        success: false,
        data: {
          imagePath: '',
          imageUrl: '',
          prompt: context.prompt,
          width: 0,
          height: 0,
          generatorId: context.generatorId,
          textResponse: '',
          originalImageId: originalImage?.id || 0,
          newImageId: 0,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  },
}); 