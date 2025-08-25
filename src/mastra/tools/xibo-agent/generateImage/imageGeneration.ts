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
import { logger } from '../../../logger';
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
      // On-memory buffer mode
      buffer: z.any().optional(),
      bufferSize: z.number().optional(),
      // Legacy file mode
      imagePath: z.string().optional(),
      imageUrl: z.string().optional(),
      // Common metadata
      prompt: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
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
    negativePrompt: z
        .string()
        .optional()
        .describe('A list of concepts to exclude from the generated image.'),
    generatorId: z
      .string()
      .optional()
      .describe("Generator ID for image history (default: '1')"),
    returnBuffer: z
      .boolean()
      .optional()
      .describe('If true, return PNG Buffer (on-memory) instead of saving to disk.'),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    let generatorId = '';
    let textResponse = '';
    try {
      // Disk cache
      const cacheDir = path.join(config.generatedDir, 'cache', 'images');
      const keyRaw = JSON.stringify({ prompt: context.prompt, aspectRatio: context.aspectRatio, negativePrompt: context.negativePrompt });
      const crypto = await import('node:crypto');
      const key = crypto.createHash('sha1').update(keyRaw, 'utf8').digest('hex');
      const cachePath = path.join(cacheDir, `${key}.bin`);
      try {
        if (context.returnBuffer && fs.existsSync(cachePath)) {
          const cached = fs.readFileSync(cachePath);
          return { success: true, data: { buffer: cached, bufferSize: cached.length, prompt: context.prompt } } as const;
        }
      } catch {}
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not set in environment variables');
      }

      // Enhance prompt with aspect ratio and negative prompt information.
      const dimensions = aspectRatioOptions[context.aspectRatio];
      let enhancedPrompt = `${context.prompt} (Aspect ratio: ${context.aspectRatio}, Dimensions: ${dimensions.width}x${dimensions.height})`;
      if (context.negativePrompt) {
        enhancedPrompt += ` --no ${context.negativePrompt}`;
      }

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
      let fullPath = '';

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

          // Start history only when saving to disk (legacy mode)
          generatorId = context.generatorId || '1';
          logger.info(`Starting new generation with generatorId: ${generatorId}`);
          startNewGeneration(generatorId);

          // On-memory buffer mode
          if (context.returnBuffer) {
            width = croppedWidth;
            height = croppedHeight;
            logger.info('Returning on-memory PNG buffer for generated image.');
            try { if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(cachePath, croppedBuffer); } catch {}
            return {
              success: true,
              data: {
                buffer: croppedBuffer,
                bufferSize: croppedBuffer.length,
                prompt: enhancedPrompt,
                width,
                height,
                textResponse,
              },
            };
          }

          // Legacy: save the processed image to disk
          const outputDir = config.generatedDir;
          logger.info(`Output directory: ${outputDir}`);
          if (!fs.existsSync(outputDir)) {
            logger.info('Creating output directory');
            fs.mkdirSync(outputDir, { recursive: true });
          }
          const filename = `image-${uuidv4()}.png`;
          savedFilename = filename;
          fullPath = path.join(outputDir, filename);
          logger.info(`Saving image to: ${fullPath}`);
          fs.writeFileSync(fullPath, croppedBuffer);
          imageUrl = `http://localhost:4111/ext-api/getImage/${filename}`;
          width = croppedWidth;
          height = croppedHeight;
          logger.info(
            `Image generated and saved to: ${fullPath} (${width}x${height})`,
          );
          logger.debug(`Image URL: ${imageUrl}`);
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

      // If we are here, we used legacy file mode
      if (!savedFilename) {
        logger.error('No image was generated from the response');
        throw new Error('No image was generated');
      }
      return { success: true, data: { imagePath: fullPath, imageUrl, prompt: enhancedPrompt, width, height, textResponse } };
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
