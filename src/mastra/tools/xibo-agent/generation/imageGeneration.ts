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

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "../config";
import { logger } from '../../../index';
import * as fs from "node:fs";
import * as path from "path";
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

/**
 * Schema for API response validation
 */
const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    imagePath: z.string(),
    prompt: z.string(),
    width: z.number(),
    height: z.number(),
    error: z.string().optional(),
  }),
});

/**
 * Tool for generating images using Google Gemini API
 * 
 * This tool provides functionality to:
 * - Generate images from text prompts
 * - Specify image dimensions
 * - Save generated images
 * - Handle generation errors
 */
export const generateImage = createTool({
  id: "generate-image",
  description: "Generate images using Google Gemini API",
  inputSchema: z.object({
    prompt: z.string().describe("Text prompt for image generation. You must specify aspect ratio in the prompt, e.g., 'Create an image with 16:9 aspect ratio'. Note: When using Imagen 3, prompts must be in English."),
    useImagen3: z.boolean().default(false).describe("Use Imagen 3 instead of Gemini for image generation. Imagen 3 provides more detailed control but requires a paid plan. Note: Imagen 3 only supports English prompts."),
    // Note: Currently, Gemini API does not support direct image size configuration.
    // Image dimensions can be specified in the prompt, e.g., "Create an image with 16:9 aspect ratio"
    // TODO: Update when Gemini API supports direct image size configuration
    /*
    width: z.number().min(256).max(1024).default(512).describe("Width of the generated image"),
    height: z.number().min(256).max(1024).default(512).describe("Height of the generated image"),
    */
    outputDir: z.string().optional().describe("Directory to save the generated image"),
  }),
  outputSchema: apiResponseSchema,
  execute: async ({ context }) => {
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables");
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      // Set responseModalities to include "Image" so the model can generate an image
      const response = await ai.models.generateContent({
        model: context.useImagen3 ? "imagen-3.0-generate-002" : "gemini-2.0-flash-preview-image-generation",
        contents: context.prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          // Note: Currently, Gemini API does not support direct image size configuration.
          // Image dimensions can be specified in the prompt, e.g., "Create an image with 16:9 aspect ratio"
          // TODO: Update when Gemini API supports direct image size configuration
          /*
          generationConfig: {
            width: context.width,
            height: context.height,
          },
          */
        },
      });

      // Process the response
      let imagePath = '';
      let width = 0;
      let height = 0;
      
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
          
          // Determine output directory
          const outputDir = context.outputDir || path.join(process.cwd(), 'generated');
          
          // Create output directory if it doesn't exist
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Save the image
          const filename = `image-${uuidv4()}.png`;
          imagePath = path.join(outputDir, filename);
          fs.writeFileSync(imagePath, buffer);
          
          // Get image metadata
          const metadata = await sharp(buffer).metadata();
          width = metadata.width || 0;
          height = metadata.height || 0;
          
          logger.info(`Image generated and saved to: ${imagePath} (${width}x${height})`);
        }
      }

      if (!imagePath) {
        throw new Error("No image was generated");
      }

      return {
        success: true,
        data: {
          imagePath,
          prompt: context.prompt,
          width,
          height,
        },
      };

    } catch (error) {
      logger.error(`generateImage: An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`, { error });
      return {
        success: false,
        data: {
          imagePath: '',
          prompt: context.prompt,
          width: 0,
          height: 0,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  },
});
