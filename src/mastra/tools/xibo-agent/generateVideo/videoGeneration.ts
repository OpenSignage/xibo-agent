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
 * Video Generation Tool
 * 
 * This module provides functionality to generate videos using a generative AI model.
 * It handles the entire process from receiving a prompt to saving the generated
 * video and recording its metadata in a history log.
 */

import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "path";
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../logger';
import { addVideoHistory, updateVideoHistory, videoHistorySchema } from './videoHistory';
import { config } from '../config';

// Defines the storage path for video files.
const VIDEO_DIR = config.generatedDir;

// Defines the schema for a successful response.
const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    videoPath: z.string(),
    videoUrl: z.string(),
    prompt: z.string(),
    negativePrompt: z.string().optional(),
    aspectRatio: z.string(),
  }),
});

// Defines the schema for an error response.
const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  error: z.any().optional(),
});

// Creates a union schema for consistent response validation.
const responseSchema = z.union([successResponseSchema, errorResponseSchema]);
type ResponseSchema = z.infer<typeof responseSchema>;

/**
 * A tool to generate videos from text prompts using a generative AI model.
 * It manages the video generation lifecycle, including history tracking.
 */
export const videoGeneration = createTool({
  id: "generate-video",
  description: "Generate a video from a text prompt.",
  inputSchema: z.object({
    prompt: z.string().describe("A descriptive text prompt for the video generation."),
    negativePrompt: z.string().optional().describe("A text prompt of concepts to avoid in the video."),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9").describe("The desired aspect ratio for the video."),
  }),
  outputSchema: responseSchema,
  execute: async ({ context }): Promise<ResponseSchema> => {
    const videoId = uuidv4();
    let historyEntry;

    try {
      const { prompt, negativePrompt, aspectRatio } = context;

      // 1. Log initial history record
      historyEntry = addVideoHistory({
        id: videoId,
        prompt,
        negativePrompt,
        aspectRatio,
        status: "pending",
        createdAt: new Date().toISOString(),
        isFavorite: false,
      });
      logger.info(`Video generation started. ID: ${videoId}`);

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables");
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Using "veo" as per docs.

      // 2. Generate video content
      let fullPrompt = prompt;
      if (negativePrompt) {
        fullPrompt += ` | negative_prompt: ${negativePrompt}`;
      }

      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const videoDataB64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!videoDataB64) {
        throw new Error("No video data received from the API.");
      }
      
      // 3. Save video file
      const videoBuffer = Buffer.from(videoDataB64, 'base64');
      const fileName = `video-${videoId}.mp4`;
      
      // Create output directory if it doesn't exist
      if (!fs.existsSync(VIDEO_DIR)) {
        logger.info(`Creating directory: ${VIDEO_DIR}`);
        fs.mkdirSync(VIDEO_DIR, { recursive: true });
      }

      const filePath = path.join(VIDEO_DIR, fileName);
      fs.writeFileSync(filePath, videoBuffer);
      logger.info(`Video saved to ${filePath}`);

      // 4. Update history record to 'completed'
      const updatedEntry = updateVideoHistory(videoId, {
        status: "completed",
        filePath,
      });

      if (!updatedEntry) {
          throw new Error("Failed to update video history after saving the video.");
      }

      const videoUrl = `http://localhost:4111/ext-api/getVideo/${fileName}`;

      return {
        success: true,
        data: {
          videoPath: filePath,
          videoUrl,
          prompt: updatedEntry.prompt,
          negativePrompt: updatedEntry.negativePrompt,
          aspectRatio: updatedEntry.aspectRatio,
        },
      };

    } catch (error) {
      const message = "An error occurred during video generation.";
      logger.error(message, {
        videoId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // 5. Update history record to 'failed'
      if (historyEntry) {
          updateVideoHistory(videoId, { status: "failed" });
      }

      return {
        success: false,
        message,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
