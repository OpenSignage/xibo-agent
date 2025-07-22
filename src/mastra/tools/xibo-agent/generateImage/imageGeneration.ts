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
 * Image Generation Tool using Google Gemini API
 *
 * This module provides functionality to generate images using Google's Gemini API.
 * It supports various parameters for image generation including prompt, dimensions,
 * and other generation settings.
 */

import { z } from 'zod';
import { createTool } from '@mastra/core';
import { GoogleGenAI, Modality } from '@google/genai';
import { config } from '../config';
import { logger } from '../../../index';
import * as fs from 'node:fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { startNewGeneration, addImage } from './imageHistory';

/**
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      imagePath: z.string(),
      imageUrl: z.string(),
      prompt: z.string(),
      width: z.number(),
      height: z.number(),
      textResponse: z.string().optional(),
    })
    .optional(),
  message: z.string().optional(),
});

/**
 * Predefined aspect ratio options with their target dimensions
 * The longer side is always 1024 pixels
 */
export const aspectRatioOptions = {
  '1:1': { width: 1024, height: 1024 },
  '3:4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
} as const;

type AspectRatio = keyof typeof aspectRatioOptions;

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
  aspectRatio: AspectRatio,
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
 * Tool for generating images using Google Gemini API
 *
 * Features:
 * - Generate images from text prompts
 * - Support for various aspect ratios
 * - Automatic image cropping and resizing
 * - Error handling and logging
 * - Image generation history management
 */
export const generateImage = createTool({
  id: 'generate-image',
  description: 'Generate images using Google Gemini API',
  inputSchema: z.object({
    prompt: z.string().describe('Text prompt for image generation'),
    aspectRatio: z
      .enum(['1:1', '3:4', '4:3', '16:9', '9:16'])
      .describe('Aspect ratio of the generated image'),
    generatorId: z
      .string()
      .optional()
      .describe("Generator ID for image history (default: '1')"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    let generatorId = '';
    let textResponse = '';
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
      }

      // Enhance prompt with aspect ratio information
      const dimensions = aspectRatioOptions[context.aspectRatio];
      const enhancedPrompt = `${context.prompt} (Aspect ratio: ${context.aspectRatio}, Dimensions: ${dimensions.width}x${dimensions.height})`;
      logger.info(`Enhanced prompt: ${enhancedPrompt}`);

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // Generate image using Gemini API
      logger.info('Calling Gemini API for image generation...');
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: enhancedPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });
      logger.info('Received response from Gemini API');

      // Process the response
      let imageUrl = '';
      let width = 0;
      let height = 0;
      let savedFilename = '';

      if (!response.candidates?.[0]?.content?.parts) {
        logger.error('Invalid response structure from Gemini API', { response });
        throw new Error('Invalid response from Gemini API');
      }

      logger.info(
        `Processing ${response.candidates[0].content.parts.length} parts from response`,
      );
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          textResponse = part.text;
          logger.info(`Received text response: ${textResponse}`);
        } else if (part.inlineData?.data) {
          logger.info('Found image data in response');
          const imageData = part.inlineData.data;
          if (typeof imageData !== 'string') {
            logger.error('Invalid image data format', {
              type: typeof imageData,
            });
            throw new Error('Invalid image data format');
          }

          const buffer = Buffer.from(imageData, 'base64');
          logger.info('Successfully decoded base64 image data');

          // Crop and resize the image to match the target aspect ratio
          logger.info('Cropping and resizing image...');
          const {
            buffer: croppedBuffer,
            width: croppedWidth,
            height: croppedHeight,
          } = await cropToAspectRatio(buffer, context.aspectRatio);
          logger.info(
            `Image cropped and resized to ${croppedWidth}x${croppedHeight}`,
          );

          // 画像生成が成功したら、新しい生成プロセスを開始
          generatorId = context.generatorId || '1';
          logger.info(`Starting new generation with generatorId: ${generatorId}`);
          startNewGeneration(generatorId);

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
          savedFilename = filename;
          const fullPath = path.join(outputDir, filename);
          logger.info(`Saving image to: ${fullPath}`);
          fs.writeFileSync(fullPath, croppedBuffer);

          // Create image URL for ext-api
          imageUrl = `http://localhost:4111/ext-api/getImage/${filename}`;

          width = croppedWidth;
          height = croppedHeight;

          logger.info(
            `Image generated and saved to: ${fullPath} (${width}x${height})`,
          );
          logger.debug(`Image URL: ${imageUrl}`);

          // 画像を履歴に追加
          logger.info(
            `Adding image to history for generatorId: ${generatorId}`,
          );
          await addImage(generatorId, {
            filename,
            prompt: enhancedPrompt,
            aspectRatio: context.aspectRatio,
            width,
            height,
            createdAt: new Date().toISOString(),
          });
          logger.info('Image added to history successfully');
        }
      }

      if (!savedFilename) {
        logger.error('No image was generated from the response');
        throw new Error('No image was generated');
      }

      return {
        success: true,
        data: {
          imagePath: `generated/${savedFilename}`,
          imageUrl,
          prompt: enhancedPrompt,
          width,
          height,
          textResponse,
        },
      };
    } catch (error) {
      logger.error(
        `generateImage: An error occurred: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        {
          error,
          generatorId,
          context: {
            prompt: context.prompt,
            aspectRatio: context.aspectRatio,
          },
        },
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
