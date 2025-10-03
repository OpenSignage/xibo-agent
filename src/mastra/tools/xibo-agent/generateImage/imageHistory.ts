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
 * Image History Management
 * 
 * This module manages the history of generated images, including their metadata
 * and generation parameters. It supports multiple concurrent generation processes
 * and maintains separate histories for each process.
 */

import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../../logger';
import { config } from '../config';

// Schema definition for image history
const imageHistorySchema = z.object({
  id: z.number(),
  filename: z.string(),
  prompt: z.string(),
  aspectRatio: z.string(),
  width: z.number(),
  height: z.number(),
  createdAt: z.string()
});

// Schema definition for generation process
const generatorSchema = z.object({
  images: z.array(imageHistorySchema),
});

// Schema definition for history data
const historySchema = z.record(z.string(), generatorSchema);

type ImageHistory = z.infer<typeof imageHistorySchema>;
type Generator = z.infer<typeof generatorSchema>;
type History = z.infer<typeof historySchema>;

// Path to history file
const HISTORY_FILE = path.join(config.generatedDir, 'imageHistory.json');

// Initialize history data
let history: History = loadHistory();

/**
 * Load history data
 * @returns History data
 */
function loadHistory(): History {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, any>;
      
      // Add imageUrl to each image in the history
      Object.values(parsed).forEach(generator => {
        if (generator.images) {
          generator.images.forEach((image: any) => {
            image.imageUrl = `http://localhost:4111/ext-api/getImage/${image.filename}`;
          });
        }
      });

      const history = historySchema.parse(parsed);
      
      // Remove empty generation processes
      Object.keys(history).forEach(generatorId => {
        if (history[generatorId].images.length === 0) {
          delete history[generatorId];
        }
      });
      
      return history;
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to load history file');
  }
  return {};
}

/**
 * Save history data
 * @param history History data to save
 */
function saveHistory(history: History): void {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to save history file');
  }
}

/**
 * Start a new generation process
 * @param generatorId Generation process ID
 * @returns Generation process ID
 */
export function startNewGeneration(generatorId: string): string {
  logger.info(`Starting new generation process for generatorId: ${generatorId}`);
  
  // Delete existing history and images
  if (history[generatorId]) {
    logger.info(`Found existing history for generatorId: ${generatorId}, cleaning up...`);
    const generator = history[generatorId];
    generator.images.forEach(image => {
      const imagePath = path.join(config.generatedDir, image.filename);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          logger.debug(`Deleted old image file: ${imagePath}`);
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, `Failed to delete image file: ${imagePath}`);
      }
    });
  } else {
    logger.info(`No existing history found for generatorId: ${generatorId}`);
  }

  // Create new history
  logger.info(`Creating new history for generatorId: ${generatorId}`);
  history[generatorId] = { images: [] };
  saveHistory(history);
  logger.info(`History created and saved for generatorId: ${generatorId}`);
  return generatorId;
}

/**
 * Add image to history
 * @param generatorId Generation process ID
 * @param image Image information
 */
export function addImage(generatorId: string, image: Omit<ImageHistory, 'id'>): void {
  logger.info(`Adding image to history for generatorId: ${generatorId}`);
  
  if (!history[generatorId]) {
    logger.error(`Generator ${generatorId} not found in history`);
    throw new Error(`Generator ${generatorId} not found`);
  }

  const generator = history[generatorId];
  const newImage: ImageHistory = {
    id: generator.images.length + 1,  // Use array length + 1 as ID
    ...image,
  };

  logger.info(`Adding image with ID: ${newImage.id}`);
  generator.images.push(newImage);
  saveHistory(history);
  logger.info(`Image added to history successfully for generatorId: ${generatorId}`);
}

/**
 * Get history for a generation process
 * @param generatorId Generation process ID
 * @returns Generation process history
 */
export function getHistory(generatorId: string): Generator {
  if (!history[generatorId]) {
    throw new Error(`Generator ${generatorId} not found`);
  }
  
  // Add imageUrl to each image
  const generator = { ...history[generatorId] };
  generator.images = generator.images.map(image => ({
    ...image,
    imageUrl: `http://localhost:4111/ext-api/getImage/${image.filename}`
  }));
  
  return generator;
}

/**
 * End generation process
 * @param generatorId Generation process ID
 * @param isSuccess Whether generation was successful
 */
export function endGeneration(generatorId: string, isSuccess: boolean = false): void {
  if (!history[generatorId]) {
    throw new Error(`Generator ${generatorId} not found`);
  }

  if (isSuccess) {
    // Clean up only the current generator's old images
    const outputDir = config.generatedDir;
    const generator = history[generatorId];
    
    generator.images.forEach(image => {
      const imagePath = path.join(outputDir, image.filename);
      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          logger.debug(`Deleted old image file: ${imagePath}`);
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, `Failed to delete image file: ${imagePath}`);
      }
    });
  }

  saveHistory(history);
}

/**
 * Get history for all generation processes
 * @returns History for all generation processes
 */
export function getAllHistory(): History {
  // Add imageUrl to each image in all generators
  const result: History = {};
  Object.entries(history).forEach(([generatorId, generator]) => {
    result[generatorId] = {
      images: generator.images.map(image => ({
        ...image,
        imageUrl: `http://localhost:4111/ext-api/getImage/${image.filename}`
      }))
    };
  });
  return result;
} 